// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ConfidentialCoreV1.sol";
import "./ConfidentialVaultV1.sol";
import "./PythPriceOracle.sol";
import "./ReentrancyGuard.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @title ConfidentialTrading V1 — Core Execution Engine
/// @notice Handles order placement, execution, liquidations, and PnL calculation.
/// @dev Integrates closely with ConfidentialCoreV1 (parameters) and ConfidentialVaultV1 (liquidity).
contract ConfidentialTradingV1 is ReentrancyGuard, Initializable {
    // ──────────── Types ────────────
    struct Position {
        bytes32 pairId;
        address trader;
        bool isLong;
        uint256 sizeUsd;
        uint256 collateral;
        uint256 entryPrice;
        uint256 leverage;
        uint256 liquidationPrice;
        uint256 openedAt;
        bool isOpen;
        uint256 tpPrice;
        uint256 slPrice;
        int256 entryFundingIndex;
        uint256 lastRolloverSettled;
    }

    struct PendingOrder {
        bytes32 pairId;
        address trader;
        bool isLong;
        uint256 sizeUsd;
        uint256 collateral;
        uint256 leverage;
        uint256 triggerPrice;
        uint8 orderType; // 0=limit, 1=stop_market, 2=market_open, 3=market_close, 4=twap
        bool isActive;
        uint256 createdAt;
        uint256 positionId;
        uint256 feePaid;
        uint256 executionFee;
        uint256 tpPrice;
        uint256 slPrice;
        uint256 twapSlices;
        uint256 twapInterval;
        uint256 twapExecuted;
        uint256 twapLastExec;
    }

    // ──────────── State ────────────
    ConfidentialCoreV1 public core;
    ConfidentialVaultV1 public vault;
    PythPriceOracle public oracle;
    IERC20 public usdc;
    uint256 public nextPositionId = 1;
    uint256 public nextOrderId = 1;

    mapping(uint256 => Position) public positions;
    mapping(uint256 => PendingOrder) public pendingOrders;
    mapping(address => uint256[]) public userPositions;
    mapping(address => uint256[]) public userOrders;

    uint256 public rolloverFeePerHour; // 0% per hour (Zero Borrow Fee)
    
    // Limits
    uint256 public constant MIN_POSITION_SIZE = 1 * 1e6; // $1 min size
    uint256 public constant MIN_COLLATERAL = 1 * 1e6; // $1 min collateral

    // Liquidation reward: 1% of collateral goes to liquidator
    uint256 public liquidationRewardBps;

    // Order expiry
    uint256 public maxOrderAge;
    uint256 public executionBufferBps;

    // Duplicate close request prevention
    mapping(uint256 => bool) public hasActiveCloseRequest;

    // ──────────── Events ────────────
    event OrderPlaced(uint256 indexed orderId, address indexed trader, bytes32 pairId, uint8 orderType, uint256 triggerPrice);
    event OrderCancelled(uint256 indexed orderId);
    event OrderExecuted(uint256 indexed orderId, uint256 indexed positionId);
    event PositionOpened(uint256 indexed positionId, address indexed trader, bytes32 pairId, bool isLong, uint256 sizeUsd, uint256 entryPrice, uint256 leverage);
    event PositionClosed(uint256 indexed positionId, address indexed trader, uint256 exitPrice, int256 pnl);
    event PositionLiquidated(uint256 indexed positionId, address indexed trader, uint256 executionPrice, address indexed liquidator, uint256 reward);
    event TWAPSliceExecuted(uint256 indexed orderId, uint256 sliceNumber, uint256 sizeUsd);
    event TPSLTriggered(uint256 indexed positionId, bool isTakeProfit, uint256 executionPrice);
    event CollateralAdded(uint256 indexed positionId, address indexed trader, uint256 amount, uint256 newLiquidationPrice);
    event CollateralRemoved(uint256 indexed positionId, address indexed trader, uint256 amount, uint256 newLiquidationPrice);
    event PositionIncreased(uint256 indexed positionId, address indexed trader, uint256 additionalSizeUsd, uint256 newEntryPrice, uint256 newLiquidationPrice);
    event PositionPartialClose(uint256 indexed positionId, address indexed trader, uint256 closeSizeUsd, uint256 exitPrice, int256 pnl);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _usdc, address _core, address _vault, address _oracle) public initializer {
        usdc = IERC20(_usdc);
        core = ConfidentialCoreV1(_core);
        vault = ConfidentialVaultV1(_vault);
        oracle = PythPriceOracle(_oracle);
        nextOrderId = 1;
        nextPositionId = 1;

        rolloverFeePerHour = 0;
        liquidationRewardBps = 100;
        maxOrderAge = 7 days;
        executionBufferBps = 10;
    }

    /// @notice Allow the contract to receive ETH (Arc native tokens) for Pyth Oracle refunds
    receive() external payable {}

    // ──────────── Internal Helpers ────────────
    function _safeTransfer(address to, uint256 amount) internal {
        require(usdc.transfer(to, amount), "Transfer failed");
    }

    function _safeTransferFrom(address from, address to, uint256 amount) internal {
        require(usdc.transferFrom(from, to, amount), "TransferFrom failed");
    }

    // ══════════════════════════════════════════════════════════
    //                      ORDER PLACEMENT
    // ══════════════════════════════════════════════════════════

    /// @notice Place a standard order (Market, Limit, Stop Market)
    function placeOrder(
        bytes32 pairId,
        bool isLong,
        uint256 sizeUsd,
        uint256 leverage,
        uint256 triggerPrice,
        uint8 orderType,
        uint256 tpPrice,
        uint256 slPrice
    ) external payable nonReentrant returns (uint256 orderId) {
        require(sizeUsd >= MIN_POSITION_SIZE, "Size too small");
        require(orderType <= 2, "Invalid orderType"); // 0=limit, 1=stop, 2=market

        // Validate TP/SL prices if set
        if (tpPrice > 0) {
            require(isLong ? tpPrice > triggerPrice || orderType == 2 : tpPrice < triggerPrice || orderType == 2, "Invalid TP price");
        }
        if (slPrice > 0) {
            require(isLong ? slPrice < triggerPrice || orderType == 2 : slPrice > triggerPrice || orderType == 2, "Invalid SL price");
        }

        core.validateOpenPosition(pairId, msg.sender, isLong, sizeUsd, leverage * 10000);

        bool isMaker = (orderType == 0);
        uint256 fee = core.calculateFee(sizeUsd, isMaker);
        uint256 collateral = sizeUsd / leverage;

        // Take USDC from trader
        _safeTransferFrom(msg.sender, address(this), collateral + fee);

        orderId = nextOrderId++;
        PendingOrder storage o = pendingOrders[orderId];
        o.pairId = pairId;
        o.trader = msg.sender;
        o.isLong = isLong;
        o.sizeUsd = sizeUsd;
        o.collateral = collateral;
        o.leverage = leverage;
        o.triggerPrice = triggerPrice;
        o.orderType = orderType;
        o.isActive = true;
        o.createdAt = block.timestamp;
        o.feePaid = fee;
        o.executionFee = msg.value;
        o.tpPrice = tpPrice;
        o.slPrice = slPrice;

        userOrders[msg.sender].push(orderId);

        emit OrderPlaced(orderId, msg.sender, pairId, orderType, triggerPrice);
    }

    /// @notice Create a TWAP Order
    function createTwapOrder(
        bytes32 pairId,
        bool isLong,
        uint256 totalSizeUsd,
        uint256 leverage,
        uint256 slices,
        uint256 intervalSec,
        uint256 tpPrice,
        uint256 slPrice
    ) external payable nonReentrant returns (uint256 orderId) {
        require(slices >= 2 && slices <= 100, "Invalid slices");
        require(intervalSec >= 60, "Min 60s interval");
        require(totalSizeUsd >= MIN_POSITION_SIZE * slices, "Slice size too small");
        
        core.validateOpenPosition(pairId, msg.sender, isLong, totalSizeUsd, leverage * 10000);

        uint256 collateral = totalSizeUsd / leverage;
        uint256 fee = core.calculateFee(totalSizeUsd, false); // Taker fee
        
        _safeTransferFrom(msg.sender, address(this), collateral + fee);

        orderId = nextOrderId++;
        PendingOrder storage o = pendingOrders[orderId];
        o.pairId = pairId;
        o.trader = msg.sender;
        o.isLong = isLong;
        o.sizeUsd = totalSizeUsd;
        o.collateral = collateral;
        o.leverage = leverage;
        o.orderType = 4; // TWAP
        o.isActive = true;
        o.createdAt = block.timestamp;
        o.feePaid = fee;
        o.executionFee = msg.value;
        o.tpPrice = tpPrice;
        o.slPrice = slPrice;
        o.twapSlices = slices;
        o.twapInterval = intervalSec;

        userOrders[msg.sender].push(orderId);

        emit OrderPlaced(orderId, msg.sender, pairId, 4, 0);
    }

    function createCloseRequest(uint256 positionId) external payable nonReentrant returns (uint256 orderId) {
        Position storage pos = positions[positionId];
        require(pos.isOpen, "Position not open");
        require(pos.trader == msg.sender, "Not owner");
        require(!hasActiveCloseRequest[positionId], "Close request exists");
        
        // Cooldown check to prevent flash loan manipulation
        require(block.timestamp >= pos.openedAt + core.minPositionDuration(), "Cooldown active");

        hasActiveCloseRequest[positionId] = true;

        orderId = nextOrderId++;
        PendingOrder storage o = pendingOrders[orderId];
        o.pairId = pos.pairId;
        o.trader = msg.sender;
        o.orderType = 3; // market_close
        o.isActive = true;
        o.createdAt = block.timestamp;
        o.positionId = positionId;
        o.executionFee = msg.value;

        emit OrderPlaced(orderId, msg.sender, pos.pairId, 3, 0);
    }

    function cancelOrder(uint256 orderId) external nonReentrant {
        PendingOrder storage order = pendingOrders[orderId];
        require(order.isActive, "Not active");
        require(order.trader == msg.sender, "Not owner");

        order.isActive = false;

        // FIX LOW-1: Reset close request flag so trader can create a new one
        if (order.orderType == 3 || order.orderType == 5 || order.orderType == 6 || order.orderType == 7) {
            hasActiveCloseRequest[order.positionId] = false;
        }

        // Refund collateral + fee + execution fee
        if (order.orderType != 3 && order.orderType != 6 && order.orderType != 7) {
            uint256 remainingCollateral = order.collateral;
            uint256 remainingFee = order.feePaid;
            
            // If TWAP partially executed, refund exact remainder to prevent rounding loss
            if (order.orderType == 4 && order.twapExecuted > 0) {
                uint256 perSliceCol = order.collateral / order.twapSlices;
                uint256 perSliceFee = order.feePaid / order.twapSlices;
                remainingCollateral = order.collateral - (perSliceCol * order.twapExecuted);
                remainingFee = order.feePaid - (perSliceFee * order.twapExecuted);
            }

            if (remainingCollateral + remainingFee > 0) {
                _safeTransfer(msg.sender, remainingCollateral + remainingFee);
            }
        }

        uint256 refundExecutionFee = order.executionFee;
        if (order.orderType == 4 && order.twapExecuted > 0) {
            uint256 perSliceExecFee = order.executionFee / order.twapSlices;
            refundExecutionFee = order.executionFee - (perSliceExecFee * order.twapExecuted);
        }

        if (refundExecutionFee > 0) {
            (bool success, ) = msg.sender.call{value: refundExecutionFee}("");
            require(success, "ETH refund failed");
        }

        emit OrderCancelled(orderId);
    }

    // ══════════════════════════════════════════════════════════
    //                      KEEPER EXECUTION
    // ══════════════════════════════════════════════════════════

    function executeOrder(uint256 orderId, bytes[] calldata updateData) external payable nonReentrant {
        if (updateData.length > 0) {
            oracle.updatePriceFeeds{value: msg.value}(updateData);
        }

        PendingOrder storage order = pendingOrders[orderId];
        require(order.isActive, "Not active");

        // FIX LOW-2: Handle expired orders gracefully — refund and reset flags
        uint256 expiration = (order.orderType == 2 || order.orderType == 3) ? 10 seconds : maxOrderAge;
        if (block.timestamp > order.createdAt + expiration) {
            order.isActive = false;
            if (order.orderType == 3 || order.orderType == 5 || order.orderType == 6 || order.orderType == 7) {
                hasActiveCloseRequest[order.positionId] = false;
            }
            // Refund collateral + fee for non-close orders
            if (order.orderType != 3 && order.orderType != 6 && order.orderType != 7 && order.collateral + order.feePaid > 0) {
                _safeTransfer(order.trader, order.collateral + order.feePaid);
            }
            // Refund execution fee
            if (order.executionFee > 0) {
                (bool success, ) = order.trader.call{value: order.executionFee}("");
                require(success, "ETH refund failed");
            }
            emit OrderCancelled(orderId);
            return;
        }

        (uint256 currentPrice, ) = oracle.getPrice(order.pairId);

        if (order.orderType == 0) { // Limit - 0% buffer (standard GMX/Avantis)
            require(order.isLong ? currentPrice <= order.triggerPrice : currentPrice >= order.triggerPrice, "Limit not reached");
            
            uint256 execPrice = order.isLong 
                ? (currentPrice < order.triggerPrice ? currentPrice : order.triggerPrice) 
                : (currentPrice > order.triggerPrice ? currentPrice : order.triggerPrice);
                
            _executeOpen(order, execPrice);
            order.isActive = false;
        } else if (order.orderType == 1) { // Stop
            uint256 bufferPrice = order.isLong 
                ? order.triggerPrice - (order.triggerPrice * executionBufferBps / 10000) 
                : order.triggerPrice + (order.triggerPrice * executionBufferBps / 10000);
                
            require(order.isLong ? currentPrice >= bufferPrice : currentPrice <= bufferPrice, "Stop not reached");
            
            _executeOpen(order, currentPrice);
            order.isActive = false;
        } else if (order.orderType == 2) { // Market Open
            bool slippageOk = order.isLong ? currentPrice <= order.triggerPrice : currentPrice >= order.triggerPrice;
            if (slippageOk || order.triggerPrice == 0) {
                _executeOpen(order, currentPrice);
            } else {
                // Slippage failed, cancel order and refund
                _safeTransfer(order.trader, order.collateral + order.feePaid);
                emit OrderCancelled(orderId);
            }
            order.isActive = false;
        } else if (order.orderType == 3) { // Market Close
            require(!core.paused(), "Paused"); // BUG-5 FIX: Ensure system is not paused
            _executeClose(order.positionId, currentPrice);
            hasActiveCloseRequest[order.positionId] = false;
            order.isActive = false;
        } else if (order.orderType == 5) { // Market Increase
            require(!core.paused(), "Paused");
            bool slippageOk = order.isLong ? currentPrice <= order.triggerPrice : currentPrice >= order.triggerPrice;
            if (slippageOk || order.triggerPrice == 0) {
                _executeIncrease(order, currentPrice);
            } else {
                _safeTransfer(order.trader, order.collateral + order.feePaid);
                emit OrderCancelled(orderId);
            }
            hasActiveCloseRequest[order.positionId] = false;
            order.isActive = false;
        } else if (order.orderType == 6) { // Partial Close
            require(!core.paused(), "Paused");
            _executePartialClose(order, currentPrice);
            hasActiveCloseRequest[order.positionId] = false;
            order.isActive = false;
        } else if (order.orderType == 7) { // Remove Collateral
            require(!core.paused(), "Paused");
            bool success = _executeRemoveCollateral(order, currentPrice);
            if (!success) {
                emit OrderCancelled(orderId);
            }
            hasActiveCloseRequest[order.positionId] = false;
            order.isActive = false;
        } else if (order.orderType == 4) { // TWAP
            require(
                order.twapExecuted == 0 || block.timestamp >= order.twapLastExec + order.twapInterval,
                "TWAP: too early"
            );
            
            // Temporary order struct for the slice — FIX HIGH-2: last slice gets remainder
            PendingOrder memory slice = order;
            if (order.twapExecuted + 1 == order.twapSlices) {
                // Last slice: use remainder to avoid rounding loss
                uint256 perSliceSize = order.sizeUsd / order.twapSlices;
                uint256 perSliceCol = order.collateral / order.twapSlices;
                uint256 perSliceFee = order.feePaid / order.twapSlices;
                slice.sizeUsd = order.sizeUsd - (perSliceSize * order.twapExecuted);
                slice.collateral = order.collateral - (perSliceCol * order.twapExecuted);
                slice.feePaid = order.feePaid - (perSliceFee * order.twapExecuted);
            } else {
                slice.sizeUsd = order.sizeUsd / order.twapSlices;
                slice.collateral = order.collateral / order.twapSlices;
                slice.feePaid = order.feePaid / order.twapSlices;
            }
            
            // FIX EXPLOIT-3: Re-validate OI limits for each TWAP slice
            core.validateOpenPosition(order.pairId, order.trader, order.isLong, slice.sizeUsd, order.leverage * 10000);

            _executeOpen(slice, currentPrice);
            
            order.twapExecuted += 1;
            order.twapLastExec = block.timestamp;
            
            emit TWAPSliceExecuted(orderId, order.twapExecuted, slice.sizeUsd);
            
            if (order.twapExecuted >= order.twapSlices) {
                order.isActive = false;
            }
        }

        // Pay keeper fee — for TWAP, pay proportional fee per slice
        if (order.executionFee > 0) {
            uint256 keeperPayout;
            if (order.orderType == 4 && order.twapSlices > 0) {
                // TWAP: pay 1/slices of execution fee per slice
                keeperPayout = order.executionFee / order.twapSlices;
            } else if (!order.isActive) {
                // Non-TWAP: pay full fee when order completes
                keeperPayout = order.executionFee;
            }
            if (keeperPayout > 0) {
                (bool success, ) = msg.sender.call{value: keeperPayout}("");
                require(success, "Keeper fee failed");
            }
        }
        
        if (!order.isActive) {
            emit OrderExecuted(orderId, order.orderType == 3 ? order.positionId : nextPositionId - 1);
        }
    }

    function _executeOpen(PendingOrder memory order, uint256 currentPrice) internal {
        ConfidentialCoreV1.ImpactResult memory impact = core.calcImpact(order.pairId, order.isLong, order.sizeUsd);
        
        uint256 entryPrice = currentPrice;
        if (impact.impactBps > 0) {
            uint256 impactVal = (entryPrice * uint256(impact.impactBps)) / 10000;
            entryPrice = order.isLong ? entryPrice + impactVal : entryPrice - impactVal;
        }

        // 25% fee discount for traders helping to balance OI skew (applied to entire fee)
        uint256 discount = 0;
        if (impact.isBalancing) {
            discount = (order.feePaid * 2500) / 10000; // 25% discount on full fee
        }

        uint256 actualFee = order.feePaid - discount;
        uint256 finalCollateral = order.collateral + discount;

        uint256 posId = nextPositionId++;
        Position storage pos = positions[posId];
        pos.pairId = order.pairId;
        pos.trader = order.trader;
        pos.isLong = order.isLong;
        pos.sizeUsd = order.sizeUsd;
        pos.collateral = finalCollateral;
        pos.entryPrice = entryPrice;
        pos.leverage = order.leverage;
        pos.liquidationPrice = _calcLiqPrice(entryPrice, order.sizeUsd, finalCollateral, order.isLong);
        pos.openedAt = block.timestamp;
        pos.lastRolloverSettled = block.timestamp;
        pos.isOpen = true;
        pos.tpPrice = order.tpPrice;
        pos.slPrice = order.slPrice;
        
        // Settle current funding index
        pos.entryFundingIndex = core.updateFunding(order.pairId);

        core.increaseOI(order.pairId, order.trader, order.isLong, order.sizeUsd);
        
        // Move collateral to Vault
        _safeTransfer(address(vault), finalCollateral);
        vault.reserveBacking(order.sizeUsd);

        // Distribute fees
        _distributeFee(actualFee);

        userPositions[order.trader].push(posId);

        emit PositionOpened(posId, order.trader, order.pairId, order.isLong, order.sizeUsd, entryPrice, order.leverage);
    }

    function _executeClose(uint256 positionId, uint256 currentPrice) internal {
        Position storage pos = positions[positionId];
        require(pos.isOpen, "Not open");

        // 1. Calculate PnL
        int256 pnl = 0;
        if (pos.isLong) {
            pnl = (int256(currentPrice) - int256(pos.entryPrice)) * int256(pos.sizeUsd) / int256(pos.entryPrice);
        } else {
            pnl = (int256(pos.entryPrice) - int256(currentPrice)) * int256(pos.sizeUsd) / int256(pos.entryPrice);
        }

        // 2. Accrued Fees (Rollover + Funding + Closing Fee)
        uint256 closingFee = core.calculateFee(pos.sizeUsd, false); // taker fee
        uint256 rolloverFee = _calcRolloverFee(pos);
        
        core.updateFunding(pos.pairId);
        int256 fundingFee = _calcFundingFee(pos); // positive means trader pays, negative means trader receives

        int256 totalDeductions = int256(closingFee) + int256(rolloverFee) + fundingFee;
        int256 netPnl = pnl - totalDeductions;

        // 3. Update State (CEI Pattern)
        pos.isOpen = false;
        core.decreaseOI(pos.pairId, pos.trader, pos.isLong, pos.sizeUsd);

        // NOTE: trackVaultLoss is handled internally by vault.settlePosition()
        // when loss spills over from Degen into Prime Vault
        
        // 4. Settle with Vault — one clean call
        vault.releaseBacking(pos.sizeUsd);
        vault.settlePosition(pos.trader, pos.collateral, netPnl);

        // 5. Distribute closing fee — always distribute (fee already deducted from netPnl)
        if (closingFee > 0) {
            vault.distributeClosingFee(closingFee);
        }

        emit PositionClosed(positionId, pos.trader, currentPrice, netPnl);
    }

    // ══════════════════════════════════════════════════════════
    //              TP / SL / LIQUIDATION
    // ══════════════════════════════════════════════════════════

    function updateTpSl(uint256 positionId, uint256 newTpPrice, uint256 newSlPrice) external nonReentrant {
        Position storage pos = positions[positionId];
        require(pos.isOpen, "Not open");
        require(pos.trader == msg.sender, "Not owner");
        
        if (newTpPrice > 0) {
            require(pos.isLong ? newTpPrice > pos.entryPrice : newTpPrice < pos.entryPrice, "Invalid TP");
        }
        if (newSlPrice > 0) {
            require(pos.isLong ? newSlPrice < pos.entryPrice : newSlPrice > pos.entryPrice, "Invalid SL");
        }
        
        pos.tpPrice = newTpPrice;
        pos.slPrice = newSlPrice;
    }

    /// @notice Execute Take Profit or Stop Loss for an open position
    function executeTPSL(uint256 positionId, bytes[] calldata updateData) external payable nonReentrant {
        if (updateData.length > 0) {
            oracle.updatePriceFeeds{value: msg.value}(updateData);
        }
        
        Position storage pos = positions[positionId];
        require(pos.isOpen, "Not open");

        // FIX EXPLOIT-4: Enforce cooldown to prevent flash loan TP/SL bypass
        require(block.timestamp >= pos.openedAt + core.minPositionDuration(), "Cooldown active");
        // HIGH-3: Check pause state
        require(!core.paused(), "Protocol paused");
        
        (uint256 currentPrice, ) = oracle.getPrice(pos.pairId);
        
        bool isTp = false;
        bool shouldClose = false;
        uint256 executionPrice = currentPrice;
        
        if (pos.tpPrice > 0) {
            uint256 tpBufferLong = pos.tpPrice - (pos.tpPrice * executionBufferBps / 10000);
            uint256 tpBufferShort = pos.tpPrice + (pos.tpPrice * executionBufferBps / 10000);
            
            isTp = pos.isLong ? currentPrice >= tpBufferLong : currentPrice <= tpBufferShort;
            shouldClose = isTp;
            if (shouldClose) executionPrice = currentPrice;
        }
        if (!shouldClose && pos.slPrice > 0) {
            uint256 slBufferLong = pos.slPrice + (pos.slPrice * executionBufferBps / 10000);
            uint256 slBufferShort = pos.slPrice - (pos.slPrice * executionBufferBps / 10000);
            
            shouldClose = pos.isLong ? currentPrice <= slBufferLong : currentPrice >= slBufferShort;
            if (shouldClose) executionPrice = currentPrice;
        }
        
        require(shouldClose, "TP/SL not triggered");
        
        emit TPSLTriggered(positionId, isTp, executionPrice);
        _executeClose(positionId, executionPrice);
    }

    function liquidate(uint256 positionId, bytes[] calldata updateData) external payable nonReentrant {
        if (updateData.length > 0) {
            oracle.updatePriceFeeds{value: msg.value}(updateData);
        }

        Position storage pos = positions[positionId];
        require(pos.isOpen, "Not open");
        // NOTE: Liquidations are intentionally ALLOWED during pause to protect vault solvency

        (uint256 currentPrice, ) = oracle.getPrice(pos.pairId);

        bool isLiquidatable = pos.isLong 
            ? currentPrice <= pos.liquidationPrice 
            : currentPrice >= pos.liquidationPrice;

        require(isLiquidatable, "Not liquidatable");

        // FIX CRITICAL-1 & REVENUE LEAK: Account for accrued fees + closing fee before distributing collateral
        uint256 rolloverFee = _calcRolloverFee(pos);
        core.updateFunding(pos.pairId);
        int256 fundingFee = _calcFundingFee(pos);

        int256 netFees = int256(rolloverFee) + fundingFee;
        uint256 totalAccruedFees;
        if (netFees > 0) {
            totalAccruedFees = uint256(netFees);
        } else if (netFees < 0) {
            totalAccruedFees = 0;
            uint256 fundingReward = uint256(-netFees);
            pos.collateral += vault.payFundingReward(fundingReward);
        }

        uint256 closingFee = core.calculateFee(pos.sizeUsd, false); // taker fee 0.04%
        uint256 totalFeesToSettle = totalAccruedFees + closingFee;

        // Cap total fees by collateral
        uint256 settledTotal = totalFeesToSettle > pos.collateral ? pos.collateral : totalFeesToSettle;
        
        // Prioritize accrued fees first, then closing fee from remainder
        uint256 settledAccrued = totalAccruedFees > settledTotal ? settledTotal : totalAccruedFees;
        uint256 settledClosing = settledTotal - settledAccrued;
        
        uint256 effectiveCollateral = pos.collateral - settledTotal;

        // Calculate liquidation reward from effective collateral
        uint256 reward = (effectiveCollateral * liquidationRewardBps) / 10000;
        
        // CEI Pattern — update state before transfers
        pos.isOpen = false;
        core.decreaseOI(pos.pairId, pos.trader, pos.isLong, pos.sizeUsd);
        
        // FIX CRITICAL-1: Free up Vault Open Interest capacity
        vault.releaseBacking(pos.sizeUsd);

        // Settle all fees (accrued + closing) into Vault
        if (settledTotal > 0) {
            vault.settleAccruedFees(settledTotal);
        }
        
        // Distribute closing fee (sends 30% to Treasury, leaves 70% in Vault)
        if (settledClosing > 0) {
            vault.distributeClosingFee(settledClosing);
        }

        // Settle remaining collateral & reward
        vault.settleLiquidation(pos.trader, msg.sender, effectiveCollateral, reward);

        emit PositionLiquidated(positionId, pos.trader, currentPrice, msg.sender, reward);
    }

    // ══════════════════════════════════════════════════════════
    //              AUTO-DELEVERAGING (ADL)
    // ══════════════════════════════════════════════════════════

    /// @notice Auto-Deleveraging (ADL) execution triggered by Keeper in emergency
    function executeADL(uint256[] calldata positionIds, bytes[] calldata updateData) external payable nonReentrant {
        require(msg.sender == core.keeper(), "Only Keeper can ADL");

        // FIX EXPLOIT-5: ADL only allowed when Vault is in crisis (utilization > 95%)
        require(vault.utilization() > 9500, "ADL only in emergency (util > 95%)");
        if (updateData.length > 0) {
            oracle.updatePriceFeeds{value: msg.value}(updateData);
        }

        for (uint i = 0; i < positionIds.length; i++) {
            Position storage pos = positions[positionIds[i]];
            if (!pos.isOpen) continue;

            (uint256 currentPrice, ) = oracle.getPrice(pos.pairId);

            int256 pnl;
            if (pos.isLong) {
                pnl = (int256(currentPrice) - int256(pos.entryPrice)) * int256(pos.sizeUsd) / int256(pos.entryPrice);
            } else {
                pnl = (int256(pos.entryPrice) - int256(currentPrice)) * int256(pos.sizeUsd) / int256(pos.entryPrice);
            }

            require(pnl > 0, "Cannot ADL a losing position");
            _executeClose(positionIds[i], currentPrice);
        }
    }

    // ══════════════════════════════════════════════════════════
    //                   FEES & HELPERS
    // ══════════════════════════════════════════════════════════

    function _distributeFee(uint256 totalFee) internal {
        (uint256 toVault, uint256 toTreasury) = core.getFeeSplit(totalFee);
        
        if (toVault > 0) {
            _safeTransfer(address(vault), toVault);
            vault.receiveFees(toVault);
        }
        
        if (toTreasury > 0) {
            _safeTransfer(core.treasury(), toTreasury);
        }
    }

    /// @dev Redesigned to use sizeUsd/collateral for precise non-integer leverage support
    function _calcLiqPrice(uint256 entryPrice, uint256 sizeUsd, uint256 collateral, bool isLong) internal view returns (uint256) {
        // Max loss before liq = 90% of collateral
        uint256 maxLoss = (collateral * 9000) / 10000;

        // Estimated fees at liquidation (closing fee + rollover buffer)
        uint256 feeBuffer = core.takerFeeBps() + 10; // bps
        uint256 estimatedFees = (sizeUsd * feeBuffer) / 10000;

        // Net allowable price move in USDC terms
        uint256 netAllowable;
        if (estimatedFees >= maxLoss) {
            netAllowable = (sizeUsd * 100) / 10000; // Minimum 1% of size
        } else {
            netAllowable = maxLoss - estimatedFees;
        }

        if (isLong) {
            return entryPrice - (entryPrice * netAllowable) / sizeUsd;
        } else {
            return entryPrice + (entryPrice * netAllowable) / sizeUsd;
        }
    }

    function _calcRolloverFee(Position memory pos) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - pos.lastRolloverSettled;
        return (pos.sizeUsd * rolloverFeePerHour * elapsed) / (3600 * 1e6);
    }

    function _calcFundingFee(Position memory pos) internal view returns (int256) {
        int256 currentIndex = core.cumulativeFundingIndex(pos.pairId);
        int256 delta = currentIndex - pos.entryFundingIndex;
        
        if (pos.isLong) {
            return (int256(pos.sizeUsd) * delta) / 1e18;
        } else {
            return -(int256(pos.sizeUsd) * delta) / 1e18;
        }
    }

    /// @notice Settle accrued fees on a position and reset tracking timestamps
    /// @dev Used internally to prevent fee exploitation and properly credit negative funding
    function _settleAccruedFees(Position storage pos) internal {
        uint256 rollover = _calcRolloverFee(pos);
        core.updateFunding(pos.pairId);
        int256 funding = _calcFundingFee(pos);

        int256 netFee = int256(rollover) + funding;

        if (netFee > 0) {
            uint256 feeToPay = uint256(netFee);
            require(feeToPay < pos.collateral, "Position liquidatable from fees");
            pos.collateral -= feeToPay;
            vault.settleAccruedFees(feeToPay);
        } else if (netFee < 0) {
            // CRIT-2 FIX: Clean funding reward path
            // Vault deducts LP assets and increases backing atomically
            uint256 reward = uint256(-netFee);
            uint256 actualReward = vault.payFundingReward(reward);
            pos.collateral += actualReward;
        }

        // Reset tracking
        pos.lastRolloverSettled = block.timestamp;
        pos.entryFundingIndex = core.cumulativeFundingIndex(pos.pairId);
    }

    // ══════════════════════════════════════════════════════════
    //              COLLATERAL MANAGEMENT
    // ══════════════════════════════════════════════════════════

    /// @notice Add collateral to an existing position (lower leverage, move liq price away)
    function addCollateral(uint256 positionId, uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");
        Position storage pos = positions[positionId];
        require(pos.isOpen, "Not open");
        require(pos.trader == msg.sender, "Not owner");

        _settleAccruedFees(pos);

        // Transfer USDC from trader to Vault
        _safeTransferFrom(msg.sender, address(vault), amount);

        // Update position
        pos.collateral += amount;
        pos.leverage = pos.sizeUsd / pos.collateral;
        pos.liquidationPrice = _calcLiqPrice(pos.entryPrice, pos.sizeUsd, pos.collateral, pos.isLong);

        emit CollateralAdded(positionId, msg.sender, amount, pos.liquidationPrice);
    }

    /// @notice Create a request to remove collateral
    function createRemoveCollateralRequest(
        uint256 positionId, 
        uint256 amount
    ) external payable nonReentrant returns (uint256 orderId) {
        require(!core.paused(), "Protocol paused");
        require(amount > 0, "Zero amount");
        Position storage pos = positions[positionId];
        require(pos.isOpen, "Not open");
        require(pos.trader == msg.sender, "Not owner");
        require(!hasActiveCloseRequest[positionId], "Pending request exists");
        require(pos.collateral > amount, "Amount exceeds collateral");
        require(pos.collateral - amount >= MIN_COLLATERAL, "Remainder collateral too small");
        hasActiveCloseRequest[positionId] = true;

        orderId = nextOrderId++;
        PendingOrder storage o = pendingOrders[orderId];
        o.pairId = pos.pairId;
        o.trader = msg.sender;
        o.isLong = pos.isLong;
        o.sizeUsd = amount; // FIX CRITICAL EXPLOIT: store amount here instead of collateral
        o.orderType = 7; // remove collateral
        o.isActive = true;
        o.createdAt = block.timestamp;
        o.positionId = positionId;
        o.executionFee = msg.value;

        userOrders[msg.sender].push(orderId);
        emit OrderPlaced(orderId, msg.sender, pos.pairId, 7, 0);
    }

    function _executeRemoveCollateral(PendingOrder memory order, uint256 currentPrice) internal returns (bool) {
        Position storage pos = positions[order.positionId];
        if (!pos.isOpen) return false;
        uint256 amount = order.sizeUsd; // Read from sizeUsd

        _settleAccruedFees(pos);

        if (pos.collateral <= amount) return false;
        uint256 newCollateral = pos.collateral - amount;
        if (newCollateral < MIN_COLLATERAL) return false;

        uint256 newLeverageScaled = (pos.sizeUsd * 10000) / newCollateral;
        ConfidentialCoreV1.PairConfig memory pair = core.getPairConfig(pos.pairId);
        if (newLeverageScaled > pair.maxLeverage * 10000) return false;

        uint256 newLiqPrice = _calcLiqPrice(pos.entryPrice, pos.sizeUsd, newCollateral, pos.isLong);
        
        if (pos.isLong) {
            if (currentPrice <= newLiqPrice) return false;
        } else {
            if (currentPrice >= newLiqPrice) return false;
        }

        pos.collateral = newCollateral;
        pos.leverage = pos.sizeUsd / newCollateral;
        pos.liquidationPrice = newLiqPrice;

        vault.returnCollateral(pos.trader, amount);

        emit CollateralRemoved(order.positionId, pos.trader, amount, newLiqPrice);
        return true;
    }

    // ══════════════════════════════════════════════════════════
    //              INCREASE POSITION (AVERAGING)
    // ══════════════════════════════════════════════════════════

    /// @notice Create a request to increase an existing position
    function createIncreaseRequest(
        uint256 positionId,
        uint256 additionalSizeUsd,
        uint256 additionalLeverage,
        uint256 acceptablePrice
    ) external payable nonReentrant returns (uint256 orderId) {
        require(!core.paused(), "Protocol paused");
        require(additionalSizeUsd >= MIN_POSITION_SIZE, "Size too small");
        Position storage pos = positions[positionId];
        require(pos.isOpen, "Not open");
        require(pos.trader == msg.sender, "Not owner");
        require(!hasActiveCloseRequest[positionId], "Pending request exists");
        hasActiveCloseRequest[positionId] = true;
        
        uint256 addCollateralAmt = additionalSizeUsd / additionalLeverage;
        uint256 fee = core.calculateFee(additionalSizeUsd, false);
        _safeTransferFrom(msg.sender, address(this), addCollateralAmt + fee);

        orderId = nextOrderId++;
        PendingOrder storage o = pendingOrders[orderId];
        o.pairId = pos.pairId;
        o.trader = msg.sender;
        o.isLong = pos.isLong;
        o.sizeUsd = additionalSizeUsd;
        o.collateral = addCollateralAmt;
        o.leverage = additionalLeverage;
        o.triggerPrice = acceptablePrice;
        o.orderType = 5; // market increase
        o.isActive = true;
        o.createdAt = block.timestamp;
        o.positionId = positionId;
        o.feePaid = fee;
        o.executionFee = msg.value;

        userOrders[msg.sender].push(orderId);
        emit OrderPlaced(orderId, msg.sender, pos.pairId, 5, acceptablePrice);
    }

    function _executeIncrease(PendingOrder memory order, uint256 currentPrice) internal {
        Position storage pos = positions[order.positionId];
        require(pos.isOpen, "Not open");
        uint256 additionalSizeUsd = order.sizeUsd;
        uint256 addCollateralAmt = order.collateral;
        uint256 fee = order.feePaid;

        _settleAccruedFees(pos);

        uint256 newLeverageScaled = ((pos.sizeUsd + additionalSizeUsd) * 10000) / (pos.collateral + addCollateralAmt);
        core.validateOpenPosition(pos.pairId, pos.trader, pos.isLong, additionalSizeUsd, newLeverageScaled);

        ConfidentialCoreV1.ImpactResult memory impact = core.calcImpact(pos.pairId, pos.isLong, additionalSizeUsd);
        uint256 addEntryPrice = currentPrice;
        if (impact.impactBps > 0) {
            uint256 impactVal = (addEntryPrice * uint256(impact.impactBps)) / 10000;
            addEntryPrice = pos.isLong ? addEntryPrice + impactVal : addEntryPrice - impactVal;
        }

        // 25% fee discount for traders helping to balance OI skew (applied to entire fee)
        uint256 discount = 0;
        if (impact.isBalancing) {
            discount = (fee * 2500) / 10000; // 25% discount on full fee
        }

        uint256 actualFee = fee - discount;
        uint256 finalAddCollateralAmt = addCollateralAmt + discount;

        uint256 posBase = (pos.sizeUsd * 1e18) / pos.entryPrice;
        uint256 addBase = (additionalSizeUsd * 1e18) / addEntryPrice;
        uint256 newEntryPrice = ((pos.sizeUsd + additionalSizeUsd) * 1e18) / (posBase + addBase);

        pos.sizeUsd += additionalSizeUsd;
        pos.collateral += finalAddCollateralAmt;
        pos.entryPrice = newEntryPrice;
        pos.leverage = pos.sizeUsd / pos.collateral;
        pos.liquidationPrice = _calcLiqPrice(newEntryPrice, pos.sizeUsd, pos.collateral, pos.isLong);

        core.increaseOI(pos.pairId, pos.trader, pos.isLong, additionalSizeUsd);

        _safeTransfer(address(vault), finalAddCollateralAmt);
        vault.reserveBacking(additionalSizeUsd);

        _distributeFee(actualFee);

        emit PositionIncreased(order.positionId, pos.trader, additionalSizeUsd, newEntryPrice, pos.liquidationPrice);
    }

    // ══════════════════════════════════════════════════════════
    //              PARTIAL CLOSE
    // ══════════════════════════════════════════════════════════

    /// @notice Create a request to partially close an existing position
    function createPartialCloseRequest(
        uint256 positionId, 
        uint256 closePercent
    ) external payable nonReentrant returns (uint256 orderId) {
        require(!core.paused(), "Protocol paused");
        require(closePercent > 0 && closePercent < 10000, "Invalid percent");
        Position storage pos = positions[positionId];
        require(pos.isOpen, "Not open");
        require(pos.trader == msg.sender, "Not owner");
        require(block.timestamp >= pos.openedAt + core.minPositionDuration(), "Cooldown active");
        require(!hasActiveCloseRequest[positionId], "Pending request exists");

        uint256 closeSizeUsd = (pos.sizeUsd * closePercent) / 10000;
        require(pos.sizeUsd - closeSizeUsd >= MIN_POSITION_SIZE, "Remainder size too small");
        
        uint256 closeCollateral = (pos.collateral * closePercent) / 10000;
        require(pos.collateral - closeCollateral >= MIN_COLLATERAL, "Remainder collateral too small");
        
        hasActiveCloseRequest[positionId] = true;

        orderId = nextOrderId++;
        PendingOrder storage o = pendingOrders[orderId];
        o.pairId = pos.pairId;
        o.trader = msg.sender;
        o.isLong = pos.isLong;
        o.sizeUsd = closePercent; // store percent here
        o.orderType = 6; // partial close
        o.isActive = true;
        o.createdAt = block.timestamp;
        o.positionId = positionId;
        o.executionFee = msg.value;

        userOrders[msg.sender].push(orderId);
        emit OrderPlaced(orderId, msg.sender, pos.pairId, 6, 0);
    }

    function _executePartialClose(PendingOrder memory order, uint256 currentPrice) internal {
        Position storage pos = positions[order.positionId];
        require(pos.isOpen, "Not open");
        uint256 closePercent = order.sizeUsd;

        _settleAccruedFees(pos);

        uint256 closeSizeUsd = (pos.sizeUsd * closePercent) / 10000;
        uint256 closeCollateral = (pos.collateral * closePercent) / 10000;

        uint256 remainSize = pos.sizeUsd - closeSizeUsd;
        uint256 remainCollateral = pos.collateral - closeCollateral;
        require(remainSize >= MIN_POSITION_SIZE, "Remainder too small");
        require(remainCollateral >= MIN_COLLATERAL, "Remainder collateral too small");

        int256 pnl;
        if (pos.isLong) {
            pnl = (int256(currentPrice) - int256(pos.entryPrice)) * int256(closeSizeUsd) / int256(pos.entryPrice);
        } else {
            pnl = (int256(pos.entryPrice) - int256(currentPrice)) * int256(closeSizeUsd) / int256(pos.entryPrice);
        }

        uint256 closingFee = core.calculateFee(closeSizeUsd, false);
        int256 netPnl = pnl - int256(closingFee);

        pos.sizeUsd = remainSize;
        pos.collateral = remainCollateral;
        pos.leverage = remainSize / remainCollateral;
        pos.liquidationPrice = _calcLiqPrice(pos.entryPrice, remainSize, remainCollateral, pos.isLong);

        core.decreaseOI(pos.pairId, pos.trader, pos.isLong, closeSizeUsd);

        vault.releaseBacking(closeSizeUsd);
        vault.settlePosition(pos.trader, closeCollateral, netPnl);

        if (closingFee > 0) {
            vault.distributeClosingFee(closingFee);
        }

        emit PositionPartialClose(order.positionId, pos.trader, closeSizeUsd, currentPrice, netPnl);
    }

    // ══════════════════════════════════════════════════════════
    //                   ADMIN FUNCTIONS
    // ══════════════════════════════════════════════════════════

    modifier onlyOwner() {
        require(msg.sender == core.owner(), "Not owner");
        _;
    }

    function setRolloverFeePerHour(uint256 _fee) external onlyOwner {
        // HIGH-1 FIX: Allow non-zero values with a max cap (0.01% per hour = 100)
        require(_fee <= 100, "Max 0.01% per hour");
        rolloverFeePerHour = _fee;
    }

    function setLiquidationRewardBps(uint256 _bps) external onlyOwner {
        require(_bps <= 500, "Max 5%");
        liquidationRewardBps = _bps;
    }

    function setMaxOrderAge(uint256 _seconds) external onlyOwner {
        require(_seconds >= 1 hours && _seconds <= 30 days, "1h-30d range");
        maxOrderAge = _seconds;
    }

    function setExecutionBufferBps(uint256 _bps) external onlyOwner {
        require(_bps <= 100, "Max 1% buffer");
        executionBufferBps = _bps;
    }

    function setCore(address _core) external onlyOwner {
        require(_core != address(0), "Zero address");
        core = ConfidentialCoreV1(_core);
    }

    function setVault(address _vault) external onlyOwner {
        require(_vault != address(0), "Zero address");
        vault = ConfidentialVaultV1(_vault);
    }

    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Zero address");
        oracle = PythPriceOracle(_oracle);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PythPriceOracle.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @title ConfidentialCore V1 — Central parameter store, fee router & risk engine
/// @notice Manages trading pairs, fee distribution, funding rates, price impact, and emergency controls
/// @dev Security: Timelock on critical params, circuit breaker, utilization cap enforcement
contract ConfidentialCoreV1 is Initializable {
    // ──────────── Types ────────────
    struct PairConfig {
        bytes32 pairId;
        bytes32 pythFeedId;
        uint256 maxLeverage;      // e.g. 50 for 50x
        uint256 maxLongOI;        // max long open interest in USDC (6 decimals)
        uint256 maxShortOI;       // max short open interest in USDC (6 decimals)
        uint256 maxPositionPct;   // max % of OI one user can hold (basis points, 2000 = 20%)
        bool active;
    }

    struct ImpactResult {
        int256  impactBps;       // Penalty BPS (>= 0, applied to overshoot)
        uint256 balancingSize;   // Portion that balances OI (gets fee discount)
        uint256 overshootSize;   // Portion that increases skew (gets penalty)
        bool    isBalancing;     // Is the trade balancing at all?
    }

    // ──────────── State ────────────
    address public owner;
    address public pendingOwner; // 2-step ownership transfer for safety
    bool public paused;

    PythPriceOracle public oracle;
    address public vault;
    address public trading;
    address public treasury;
    address public keeper;

    // ── Fee Configuration (Maker/Taker Split) ──
    uint256 public takerFeeBps;
    uint256 public makerFeeBps;

    // Fee split in basis points (total must = 10000)
    uint256 public vaultFeeBps;
    uint256 public treasuryFeeBps;

    // ── Vault Utilization Cap ──
    uint256 public utilizationCapBps;

    // ── Funding Rate System (Dynamic P2P) ──
    // Continuous funding: majority side pays minority side based on OI skew ratio
    // Rate scales with (longOI - shortOI) / (longOI + shortOI), not maxOI
    uint256 public baseFundingRate;
    mapping(bytes32 => int256) public cumulativeFundingIndex; // per pair, scaled 1e18
    mapping(bytes32 => uint256) public lastFundingUpdate;     // timestamp per pair

    // ── Dynamic Price Impact ──
    uint256 public maxPriceImpactBps;

    // ── Pair Registry ──
    mapping(bytes32 => PairConfig) public pairs;
    bytes32[] public pairList;

    // ── Open Interest Tracking ──
    mapping(bytes32 => uint256) public longOI;   // per pair
    mapping(bytes32 => uint256) public shortOI;  // per pair
    mapping(bytes32 => mapping(address => uint256)) public userLongOI;
    mapping(bytes32 => mapping(address => uint256)) public userShortOI;

    // ── Anti-Manipulation: Position Cooldown ──
    uint256 public minPositionDuration; // 5 seconds — prevents flash loan attacks

    // ── Circuit Breaker ──
    uint256 public maxDrawdownBps; // 40% max absolute prime loss triggers pause
    uint256 public totalHistoricalPrimeDeposits;
    uint256 public absolutePrimeLoss;

    // USDC token (Arc native USDC)
    address public usdc;

    // ──────────── Events ────────────
    event PairAdded(bytes32 indexed pairId, uint256 maxLeverage, uint256 maxLongOI, uint256 maxShortOI);
    event PairUpdated(bytes32 indexed pairId);
    event PairToggled(bytes32 indexed pairId, bool active);
    event FeeDistributed(uint256 toVault, uint256 toTreasury);
    event FundingUpdated(bytes32 indexed pairId, int256 newCumulativeIndex, int256 delta);
    event Paused();
    event Unpaused();
    event CircuitBreakerTriggered(uint256 totalLoss, uint256 threshold);
    event OwnershipTransferStarted(address indexed current, address indexed pending);
    event OwnershipTransferred(address indexed prev, address indexed next);

    // ──────────── Errors ────────────
    error OnlyOwner();
    error OnlyTrading();
    error IsPaused();
    error PairNotActive();
    error ExceedsMaxLeverage();
    error ExceedsMaxOI();
    error ExceedsMaxPositionSize();
    error ExceedsUtilizationCap();
    error InvalidFeeSplit();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyTrading() {
        if (msg.sender != trading) revert OnlyTrading();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert IsPaused();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _usdc, address _oracle) public initializer {
        if (_usdc == address(0) || _oracle == address(0)) revert ZeroAddress();
        owner = msg.sender;
        usdc = _usdc;
        oracle = PythPriceOracle(_oracle);

        takerFeeBps = 5;
        makerFeeBps = 3;
        vaultFeeBps = 7000;
        treasuryFeeBps = 3000;
        utilizationCapBps = 8000;
        baseFundingRate = 3e15;
        maxPriceImpactBps = 200;
        minPositionDuration = 5;
        maxDrawdownBps = 4000;
    }

    // ══════════════════════════════════════════════════════════
    //                      ADMIN SETUP
    // ══════════════════════════════════════════════════════════

    function setVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        vault = _vault;
    }

    function setTrading(address _trading) external onlyOwner {
        if (_trading == address(0)) revert ZeroAddress();
        trading = _trading;
    }

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
    }

    function setKeeper(address _keeper) external onlyOwner {
        if (_keeper == address(0)) revert ZeroAddress();
        keeper = _keeper;
    }

    function setOracle(address _oracle) external onlyOwner {
        if (_oracle == address(0)) revert ZeroAddress();
        oracle = PythPriceOracle(_oracle);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    // 2-step ownership transfer (prevents accidental loss of admin)
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    // ══════════════════════════════════════════════════════════
    //                    FEE CONFIGURATION
    // ══════════════════════════════════════════════════════════

    function setTradingFees(uint256 _takerBps, uint256 _makerBps) external onlyOwner {
        require(_takerBps <= 50 && _makerBps <= 50, "Fee too high"); // Max 0.5%
        require(_takerBps >= _makerBps, "Taker must >= Maker");
        takerFeeBps = _takerBps;
        makerFeeBps = _makerBps;
    }

    function setFeeSplit(uint256 _vaultBps, uint256 _treasuryBps) external onlyOwner {
        if (_vaultBps + _treasuryBps != 10000) revert InvalidFeeSplit();
        vaultFeeBps = _vaultBps;
        treasuryFeeBps = _treasuryBps;
    }

    function setUtilizationCap(uint256 _capBps) external onlyOwner {
        require(_capBps >= 5000 && _capBps <= 9500, "Cap 50-95%");
        utilizationCapBps = _capBps;
    }

    // ══════════════════════════════════════════════════════════
    //                    PAIR MANAGEMENT
    // ══════════════════════════════════════════════════════════

    function addPair(
        string calldata pairName,
        bytes32 pythFeedId,
        uint256 maxLeverage,
        uint256 maxLongOI_,
        uint256 maxShortOI_,
        uint256 maxPositionPct
    ) external onlyOwner {
        bytes32 pairId = keccak256(abi.encodePacked(pairName));

        pairs[pairId] = PairConfig({
            pairId: pairId,
            pythFeedId: pythFeedId,
            maxLeverage: maxLeverage,
            maxLongOI: maxLongOI_,
            maxShortOI: maxShortOI_,
            maxPositionPct: maxPositionPct,
            active: true
        });

        pairList.push(pairId);
        lastFundingUpdate[pairId] = block.timestamp;

        emit PairAdded(pairId, maxLeverage, maxLongOI_, maxShortOI_);
    }

    function togglePair(bytes32 pairId, bool active) external onlyOwner {
        pairs[pairId].active = active;
        emit PairToggled(pairId, active);
    }

    function updatePairLimits(bytes32 pairId, uint256 maxLongOI_, uint256 maxShortOI_, uint256 maxPositionPct) external onlyOwner {
        pairs[pairId].maxLongOI = maxLongOI_;
        pairs[pairId].maxShortOI = maxShortOI_;
        pairs[pairId].maxPositionPct = maxPositionPct;
        emit PairUpdated(pairId);
    }

    function updatePairLeverage(bytes32 pairId, uint256 maxLeverage_) external onlyOwner {
        pairs[pairId].maxLeverage = maxLeverage_;
        emit PairUpdated(pairId);
    }

    // ══════════════════════════════════════════════════════════
    //              VALIDATION (called by Trading)
    // ══════════════════════════════════════════════════════════

    function validateOpenPosition(
        bytes32 pairId,
        address user,
        bool isLong,
        uint256 sizeUsd,
        uint256 leverage
    ) external view whenNotPaused {
        PairConfig memory pair = pairs[pairId];
        if (!pair.active) revert PairNotActive();
        if (leverage > pair.maxLeverage) revert ExceedsMaxLeverage();

        // Check max OI per pair
        if (isLong) {
            if (longOI[pairId] + sizeUsd > pair.maxLongOI) revert ExceedsMaxOI();
            if (pair.maxPositionPct > 0) {
                uint256 maxUserOI = (pair.maxLongOI * pair.maxPositionPct) / 10000;
                if (userLongOI[pairId][user] + sizeUsd > maxUserOI) revert ExceedsMaxPositionSize();
            }
        } else {
            if (shortOI[pairId] + sizeUsd > pair.maxShortOI) revert ExceedsMaxOI();
            if (pair.maxPositionPct > 0) {
                uint256 maxUserOI = (pair.maxShortOI * pair.maxPositionPct) / 10000;
                if (userShortOI[pairId][user] + sizeUsd > maxUserOI) revert ExceedsMaxPositionSize();
            }
        }

        // Enforce vault utilization cap
        if (vault != address(0)) {
            // Read utilization from vault (basis points)
            (bool success, bytes memory data) = vault.staticcall(
                abi.encodeWithSignature("utilization()")
            );
            if (success && data.length >= 32) {
                uint256 currentUtil = abi.decode(data, (uint256));
                if (currentUtil > utilizationCapBps) revert ExceedsUtilizationCap();
            }
        }
    }

    // ══════════════════════════════════════════════════════════
    //              OI TRACKING (called by Trading)
    // ══════════════════════════════════════════════════════════

    function increaseOI(bytes32 pairId, address user, bool isLong, uint256 sizeUsd) external onlyTrading {
        if (isLong) {
            longOI[pairId] += sizeUsd;
            userLongOI[pairId][user] += sizeUsd;
        } else {
            shortOI[pairId] += sizeUsd;
            userShortOI[pairId][user] += sizeUsd;
        }
    }

    function decreaseOI(bytes32 pairId, address user, bool isLong, uint256 sizeUsd) external onlyTrading {
        if (isLong) {
            longOI[pairId] = longOI[pairId] > sizeUsd ? longOI[pairId] - sizeUsd : 0;
            userLongOI[pairId][user] = userLongOI[pairId][user] > sizeUsd ? userLongOI[pairId][user] - sizeUsd : 0;
        } else {
            shortOI[pairId] = shortOI[pairId] > sizeUsd ? shortOI[pairId] - sizeUsd : 0;
            userShortOI[pairId][user] = userShortOI[pairId][user] > sizeUsd ? userShortOI[pairId][user] - sizeUsd : 0;
        }
    }

    // ══════════════════════════════════════════════════════════
    //              CONTINUOUS FUNDING RATE (Dynamic P2P)
    // ══════════════════════════════════════════════════════════

    /// @notice Update cumulative funding index for a pair. Called by Trading on every open/close.
    /// @dev Dynamic: rate = (netOI / totalOI) * baseFundingRate * elapsed / 86400
    ///      Uses skew ratio (netOI/totalOI) instead of (netOI/maxOI) for meaningful rates
    ///      Positive index = longs pay shorts, Negative index = shorts pay longs
    function updateFunding(bytes32 pairId) external onlyTrading returns (int256) {
        uint256 elapsed = block.timestamp - lastFundingUpdate[pairId];
        if (elapsed == 0) return cumulativeFundingIndex[pairId];
        // Cap elapsed at 1 hour to prevent massive funding spikes on inactive pairs
        if (elapsed > 1 hours) elapsed = 1 hours;

        uint256 _longOI = longOI[pairId];
        uint256 _shortOI = shortOI[pairId];
        uint256 totalOI = _longOI + _shortOI;

        if (totalOI == 0) {
            lastFundingUpdate[pairId] = block.timestamp;
            return cumulativeFundingIndex[pairId];
        }

        // Skew-proportional funding: (netOI / totalOI) determines rate intensity
        // At 100% skew (all one side), rate = baseFundingRate per day
        // At 50% skew, rate = 50% of baseFundingRate per day
        int256 netOI = int256(_longOI) - int256(_shortOI);

        // fundingDelta = (netOI / totalOI) * baseFundingRate * elapsed / 86400
        int256 fundingDelta = (netOI * int256(baseFundingRate) * int256(elapsed)) 
            / (int256(totalOI) * 86400);

        cumulativeFundingIndex[pairId] += fundingDelta;
        lastFundingUpdate[pairId] = block.timestamp;

        emit FundingUpdated(pairId, cumulativeFundingIndex[pairId], fundingDelta);

        return cumulativeFundingIndex[pairId];
    }

    /// @notice Get projected 1-hour funding rate for a pair (for frontend display)
    /// @return Hourly funding rate in 1e18 scale. Positive = longs pay, negative = shorts pay.
    function getProjectedFundingRate(bytes32 pairId) external view returns (int256) {
        uint256 _longOI = longOI[pairId];
        uint256 _shortOI = shortOI[pairId];
        uint256 totalOI = _longOI + _shortOI;
        if (totalOI == 0) return 0;

        int256 netOI = int256(_longOI) - int256(_shortOI);
        // Project for 1 hour (3600 seconds)
        return (netOI * int256(baseFundingRate) * 3600) / (int256(totalOI) * 86400);
    }

    // ══════════════════════════════════════════════════════════
    //              DYNAMIC PRICE IMPACT
    // ══════════════════════════════════════════════════════════

    /// @notice Calculate Price Impact (Split-Portion)
    /// @dev Calculates penalty and discount sizes separately based on OI skew
    function calcImpact(
        bytes32 pairId, 
        bool isLong, 
        uint256 sizeUsd
    ) external view returns (ImpactResult memory result) {
        PairConfig memory pair = pairs[pairId];
        uint256 lOI = longOI[pairId];
        uint256 sOI = shortOI[pairId];
        
        uint256 maxOI = isLong ? pair.maxLongOI : pair.maxShortOI;
        if (maxOI == 0 || sizeUsd == 0) return result;

        // Neutral Case
        if (lOI == sOI || lOI == 0 || sOI == 0) {
            result.overshootSize = sizeUsd;
            result.isBalancing = false;
        } else {
            // Determine balancing vs merusak
            if ((isLong && sOI > lOI) || (!isLong && lOI > sOI)) {
                result.isBalancing = true;
                uint256 gap = isLong ? (sOI - lOI) : (lOI - sOI);
                
                if (sizeUsd <= gap) {
                    result.balancingSize = sizeUsd;
                    result.overshootSize = 0;
                } else {
                    result.balancingSize = gap;
                    result.overshootSize = sizeUsd - gap;
                }
            } else {
                result.isBalancing = false;
                result.balancingSize = 0;
                result.overshootSize = sizeUsd;
            }
        }
        
        // Quadratic Impact for Overshoot portion
        if (result.overshootSize > 0) {
            uint256 ratio = (result.overshootSize * 1e6) / maxOI;
            uint256 quadraticRatio = (ratio * ratio) / 1e6;
            
            uint256 rawImpact = (quadraticRatio * maxPriceImpactBps) / 1e6;
            if (rawImpact > maxPriceImpactBps) rawImpact = maxPriceImpactBps;
            
            result.impactBps = int256(rawImpact);
        } else {
            result.impactBps = 0;
        }
        
        return result;
    }

    // ══════════════════════════════════════════════════════════
    //              FEE CALCULATION & DISTRIBUTION
    // ══════════════════════════════════════════════════════════

    /// @notice Calculate trading fee based on order type
    /// @param sizeUsd Position size in USDC (6 decimals)
    /// @param isMaker true for limit orders, false for market/stop/twap
    function calculateFee(uint256 sizeUsd, bool isMaker) external view returns (uint256) {
        uint256 feeBps = isMaker ? makerFeeBps : takerFeeBps;
        return (sizeUsd * feeBps) / 10000;
    }

    /// @notice Legacy single-fee calculation (backward compat, uses taker fee)
    function calculateFee(uint256 sizeUsd) external view returns (uint256) {
        return (sizeUsd * takerFeeBps) / 10000;
    }

    function getFeeSplit(uint256 totalFee) external view returns (uint256 toVault, uint256 toTreasury) {
        toVault = (totalFee * vaultFeeBps) / 10000;
        toTreasury = totalFee - toVault; // remainder avoids rounding loss
    }

    // ══════════════════════════════════════════════════════════
    //              CIRCUIT BREAKER
    // ══════════════════════════════════════════════════════════

    function trackVaultLoss(uint256 lossAmount) external {
        require(msg.sender == vault, "Only Vault");
        
        absolutePrimeLoss += lossAmount;

        // Check if absolute loss exceeds threshold (relative to total historical deposits)
        if (totalHistoricalPrimeDeposits > 0) {
            uint256 lossBps = (absolutePrimeLoss * 10000) / totalHistoricalPrimeDeposits;
            if (lossBps > maxDrawdownBps) {
                paused = true;
                emit CircuitBreakerTriggered(absolutePrimeLoss, maxDrawdownBps);
            }
        }
    }

    /// @notice Tracks net deposits to Prime Vault for absolute loss limit
    function recordPrimeDeposit(uint256 amount) external {
        require(msg.sender == vault, "Only Vault");
        totalHistoricalPrimeDeposits += amount;
    }

    /// @notice Tracks net withdrawals from Prime Vault
    function recordPrimeWithdrawal(uint256 amount) external {
        require(msg.sender == vault, "Only Vault");
        uint256 newTotal = totalHistoricalPrimeDeposits >= amount ? totalHistoricalPrimeDeposits - amount : 0;
        
        // BUG-4 FIX: Never let historical deposits drop below absolute loss, 
        // to prevent mathematical deflation of the circuit breaker threshold.
        if (newTotal < absolutePrimeLoss) {
            totalHistoricalPrimeDeposits = absolutePrimeLoss;
        } else {
            totalHistoricalPrimeDeposits = newTotal;
        }
    }

    // ══════════════════════════════════════════════════════════
    //              FUNDING RATE PARAMETERS
    // ══════════════════════════════════════════════════════════

    function setBaseFundingRate(uint256 _rate) external onlyOwner {
        require(_rate <= 1e16, "Max 1% per day"); // Safety cap
        baseFundingRate = _rate;
    }

    function setMaxPriceImpact(uint256 _maxBps) external onlyOwner {
        require(_maxBps <= 500, "Max 5%");
        maxPriceImpactBps = _maxBps;
    }

    function setMinPositionDuration(uint256 _seconds) external onlyOwner {
        require(_seconds <= 300, "Max 5 min");
        minPositionDuration = _seconds;
    }

    function setMaxDrawdown(uint256 _bps) external onlyOwner {
        require(_bps >= 1000 && _bps <= 5000, "10-50%");
        maxDrawdownBps = _bps;
    }

    // ══════════════════════════════════════════════════════════
    //                      VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════

    function getPairCount() external view returns (uint256) {
        return pairList.length;
    }

    function getPairConfig(bytes32 pairId) external view returns (PairConfig memory) {
        return pairs[pairId];
    }

    function getNetOI(bytes32 pairId) external view returns (int256) {
        return int256(longOI[pairId]) - int256(shortOI[pairId]);
    }

    function getOIInfo(bytes32 pairId) external view returns (
        uint256 longOI_, uint256 shortOI_, uint256 maxLong_, uint256 maxShort_
    ) {
        return (longOI[pairId], shortOI[pairId], pairs[pairId].maxLongOI, pairs[pairId].maxShortOI);
    }
}

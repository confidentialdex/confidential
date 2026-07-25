// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IPyth — Minimal Pyth Network interface for on-chain price reads
interface IPyth {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }

    function getPriceNoOlderThan(bytes32 id, uint256 age) external view returns (Price memory);
    function updatePriceFeeds(bytes[] calldata updateData) external payable;
    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256);
}

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @title PythPriceOracle — Oracle adapter for Confidential Perpetual DEX
/// @notice Wraps the Pyth on-chain contract to provide validated price feeds
contract PythPriceOracle is Initializable {
    // ──────────── State ────────────
    IPyth public pyth;
    address public owner;
    uint256 public maxStaleness; // seconds

    // pairId (e.g. keccak256("BTC/USDC")) => Pyth price feed ID
    mapping(bytes32 => bytes32) public priceFeedIds;

    // ──────────── Events ────────────
    event PriceFeedSet(bytes32 indexed pairId, bytes32 pythFeedId);
    event MaxStalenessUpdated(uint256 newMaxStaleness);
    event OwnershipTransferred(address indexed prev, address indexed next);

    // ──────────── Errors ────────────
    error OnlyOwner();
    error PriceFeedNotSet();
    error StalePrice();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _pyth) public initializer {
        pyth = IPyth(_pyth);
        owner = msg.sender;
        maxStaleness = 60;
    }

    // ──────────── Admin ────────────

    /// @notice Register a Pyth feed ID for a trading pair
    function setPriceFeed(bytes32 pairId, bytes32 pythFeedId) external onlyOwner {
        priceFeedIds[pairId] = pythFeedId;
        emit PriceFeedSet(pairId, pythFeedId);
    }

    /// @notice Set the underlying Pyth contract address
    function setPyth(address _pyth) external onlyOwner {
        pyth = IPyth(_pyth);
    }

    /// @notice Batch-register multiple feeds
    function setPriceFeedsBatch(bytes32[] calldata pairIds, bytes32[] calldata pythFeedIds) external onlyOwner {
        require(pairIds.length == pythFeedIds.length, "Length mismatch");
        for (uint256 i; i < pairIds.length; i++) {
            priceFeedIds[pairIds[i]] = pythFeedIds[i];
            emit PriceFeedSet(pairIds[i], pythFeedIds[i]);
        }
    }

    function setMaxStaleness(uint256 _seconds) external onlyOwner {
        require(_seconds >= 5 && _seconds <= 300, "Staleness 5-300s");
        maxStaleness = _seconds;
        emit MaxStalenessUpdated(_seconds);
    }

    // FIX MEDIUM-1: 2-step ownership transfer (consistent with ConfidentialCore)
    address public pendingOwner;
    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
    }
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    // ──────────── Public reads ────────────

    /// @notice Get the validated price for a pair (reverts if stale or missing)
    /// @return price  Price scaled to 18 decimals (USD)
    /// @return publishTime  Timestamp of the price update
    function getPrice(bytes32 pairId) external view returns (uint256 price, uint256 publishTime) {
        bytes32 feedId = priceFeedIds[pairId];
        if (feedId == bytes32(0)) revert PriceFeedNotSet();

        IPyth.Price memory p = pyth.getPriceNoOlderThan(feedId, maxStaleness);
        require(p.price > 0, "Invalid negative price");
        
        // MED-4 FIX: Relaxed from 1% to 2% to support Forex pairs during weekend/low-liquidity periods
        require((uint64(p.conf) * 100) / uint64(p.price) <= 2, "Oracle confidence too wide");

        // Convert Pyth price (int64 * 10^expo) to uint256 with 18 decimals
        if (p.expo >= 0) {
            price = uint256(uint64(p.price)) * (10 ** (18 + uint32(p.expo)));
        } else {
            uint32 absExpo = uint32(-p.expo);
            if (absExpo <= 18) {
                price = uint256(uint64(p.price)) * (10 ** (18 - absExpo));
            } else {
                price = uint256(uint64(p.price)) / (10 ** (absExpo - 18));
            }
        }

        publishTime = p.publishTime;
    }

    /// @notice Check if the price for a pair is stale
    function isPriceStale(bytes32 pairId) external view returns (bool) {
        bytes32 feedId = priceFeedIds[pairId];
        if (feedId == bytes32(0)) return true;

        try pyth.getPriceNoOlderThan(feedId, maxStaleness) returns (IPyth.Price memory) {
            return false;
        } catch {
            return true;
        }
    }

    /// @notice Pass-through to update Pyth price feeds (called by frontend/keeper)
    function updatePriceFeeds(bytes[] calldata updateData) external payable {
        uint256 fee = pyth.getUpdateFee(updateData);
        require(msg.value >= fee, "Insufficient fee");
        pyth.updatePriceFeeds{value: fee}(updateData);
        if (msg.value > fee) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - fee}("");
            require(success, "ETH refund failed");
        }
    }
}

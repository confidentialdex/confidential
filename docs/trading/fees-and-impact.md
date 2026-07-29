# Fees & Price Impact

Confidential DEX operates a transparent fee model designed to align the incentives of traders, liquidity providers, and the protocol treasury.

---

## Trading Fees

When you open or close a position, a flat trading fee is applied based on the total leveraged position size, not just your margin.

- **Standard Fee:** `0.1%` (10 bps) of the position size.

**Example:**
If you open a **10x** Long with **1,000 USDC** collateral, your position size is **10,000 USDC**. The trading fee will be `10,000 * 0.001 = 10 USDC`.

### Fee Distribution
To ensure a sustainable ecosystem, all collected trading fees are split:
- **70%** goes directly to the Vault (rewarding LPs and growing the liquidity pool).
- **30%** goes to the Protocol Treasury (for development, keeper rewards, and buybacks).

---

## Contrarian Rebate

Confidential DEX heavily rewards traders who help balance the system.

If the market has a heavy Long skew, and you decide to open a Short position (acting as a contrarian), you are actively reducing the protocol's risk. To reward this behavior:

::: tip 25% Fee Discount
Any order that reduces the market skew automatically receives a **25% discount** on the trading fee. Instead of paying 10 bps, you only pay 7.5 bps.
:::

---

## Dynamic Quadratic Price Impact

In traditional orderbook exchanges, large market orders eat through the liquidity book, resulting in a worse average price (slippage). 

Because Confidential DEX executes at exactly the oracle price, we simulate this natural market depth using a **Dynamic Quadratic Price Impact** algorithm. This protects the Vault from being drained by massive, one-sided, instantaneous trades.

### How it Works
1. **Small Retail Orders:** For standard orders that do not significantly alter the Long/Short skew, the price impact is virtually zero. You get exactly the oracle price.
2. **Whale Orders:** If you place a massive order that aggressively pushes the skew in one direction (e.g., placing a $5M Long when the market is already heavily Long), the algorithm applies an exponential penalty to your execution price.

The formula scales quadratically: the more you imbalance the pool, the worse your execution price becomes.

::: info Mitigation via TWAP
If you need to deploy large amounts of capital, we strongly recommend using the [TWAP](./order-types#time-weighted-average-price-twap) order type. By slicing your order into smaller chunks over time, you allow the market to naturally digest the volume, significantly reducing or entirely avoiding the price impact penalty.
:::

# Trading Mechanics

Confidential DEX prioritizes institutional-grade execution. All trading mechanisms are designed to ensure fair, precise, and transparent transactions that align with mathematical expectations.

---

## Limit Order Execution
Unlike systems that apply price tolerances to limit orders to force execution, Confidential DEX enforces strict price accuracy. A limit order will only execute to open a position if the market price from the oracle exactly touches or crosses the target price.

## Dynamic Slippage Buffer

For the execution of market orders, Stop Loss (SL), and Take Profit (TP), account security and price predictability are prioritized:

::: info Custom Slippage Control
Traders can define their own custom slippage tolerance via the user interface. The default tolerance is set to 0.3% (30 bps), with a minimum of 0.1% and a maximum of 5%.

If market volatility or extreme wicks push the execution price beyond the defined slippage limit, the keeper network will reject the execution and refund the collateral, protecting traders from highly distorted entry or exit prices.
:::

---

## Position Management

### Partial Close
Traders maintain full control over risk management with the ability to execute partial closures. Instead of closing 100% of a position, traders can opt to close specific percentages to realize partial profits or limit losses.

- Upon partial close, the smart contract recalculates the remaining collateral and leverage.
- The realized profit or loss on the closed portion is immediately settled to the wallet or deducted from the collateral.
- Liquidation thresholds and margin ratios are updated instantaneously.

### Averaging Logic
When a trader adds collateral to an existing position (e.g., adding margin or averaging entry prices), the protocol applies a precise volume-weighted averaging calculation. This ensures the new entry price and combined leverage size are calculated accurately, preventing exploitation of leverage maximums.

---

## TWAP Execution
For large capital deployments, the system supports Time-Weighted Average Price (TWAP) execution. This algorithm splices large orders into smaller segments executed periodically over a defined timeframe, neutralizing price impact and reducing immediate strain on vault liquidity.

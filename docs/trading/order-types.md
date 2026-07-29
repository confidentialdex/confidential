# Order Types

Confidential DEX provides a comprehensive suite of order types, allowing traders to execute complex strategies directly on-chain.

---

## Market Orders

A **Market Order** is a request to buy or sell an asset immediately at the current available market price. 

Because Confidential DEX uses a 2-step Request-Execute model, your Market Order is executed at the exact Pyth oracle price at the moment the Keeper processes your request (usually within 1 block). 

### Dynamic Slippage Buffer
To protect against extreme volatility spikes during the execution delay, traders can define custom slippage tolerances (default: 0.3%, min: 0.1%, max: 5%). If the oracle price moves outside this buffer before the Keeper executes the order, the transaction is safely reverted and collateral is refunded.

---

## Limit Orders

A **Limit Order** allows you to specify the exact price at which you want to open a position. 

Unlike AMMs that apply price tolerances to limit orders to force execution, Confidential DEX enforces strict price accuracy. A limit order will **only** execute if the market price from the oracle exactly touches or crosses your target price.

---

## Stop Loss & Take Profit (SL/TP)

Risk management is built directly into the smart contract layer. You can set TP/SL orders when opening a position, or add/modify them later.

- **Take Profit (TP):** Automatically closes your position (fully or partially) when the price hits your target profit level.
- **Stop Loss (SL):** Automatically closes your position to prevent further losses if the market moves against you.

::: info Partial Close Supported
You do not have to close 100% of your position. Confidential DEX supports partial closures, allowing you to scale out of a trade (e.g., take profit on 50% of your position while letting the rest run).
:::

---

## Time-Weighted Average Price (TWAP)

For large capital deployments, executing a massive order all at once can incur significant [Price Impact](./fees-and-impact). 

**TWAP** is an algorithmic execution strategy that splices a large order into smaller segments executed periodically over a defined timeframe. 

**Benefits of TWAP:**
1. **Neutralizes Price Impact:** By breaking up the order, you avoid the exponential price penalties associated with disrupting the Long/Short skew instantly.
2. **Reduces Vault Strain:** Allows the liquidity pool to absorb the position naturally over time.
3. **Better Average Price:** Reduces the risk of entering entirely at a localized peak or bottom.

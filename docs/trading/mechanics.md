# Trading Mechanics

Confidential DEX prioritizes institutional-grade execution by settling trades directly on-chain using a 2-step Request-Execute model. This section explains the fundamental lifecycle of a position.

---

## 1. Opening a Position

When a trader decides to open a position (Long or Short), the following sequence occurs:

1. **Request Phase:** The user submits a transaction to the `Trading` contract via the frontend. This transaction includes the order details (size, leverage, pair, acceptable slippage) and locks the required USDC collateral.
2. **Keeper Execution:** The order does not execute immediately against a static price. Instead, it enters a pending state. A decentralized Keeper bot instantly observes the request, fetches the most recent cryptographically-signed price from the Pyth Network, and submits it to the blockchain.
3. **Settlement:** The contract verifies the Pyth signature, checks if the price is within the user's slippage tolerance, calculates the price impact, and officially opens the position.

::: tip Why 2-Step?
This model completely eliminates front-running, toxic MEV, and stale-price arbitrage, ensuring you get the fairest execution possible.
:::

## 2. Managing an Open Position

Once a position is live, its value fluctuates based on the underlying oracle price. 
- **PnL (Profit and Loss):** Calculated in real-time.
- **Funding Rates:** Depending on the market skew, you will either pay or receive funding continuously while the position is open. See [Funding Rates](./funding-rates) for details.
- **Adjustments:** You can add collateral to prevent liquidation or increase your position size (averaging). See [Margin & Leverage](./margin-leverage).

## 3. Closing a Position

Traders can close their positions at any time using a similar Request-Execute flow:

1. **Close Request:** The user submits a close request (either full or partial close).
2. **Keeper Execution:** The Keeper fetches the latest Pyth price.
3. **Final Settlement:** The protocol calculates the final PnL, deducts any borrowing/funding fees and close fees, and returns the remaining USDC balance (plus profits or minus losses) back to the user's wallet.

Alternatively, positions can be closed automatically via Take Profit, Stop Loss, or Liquidations.

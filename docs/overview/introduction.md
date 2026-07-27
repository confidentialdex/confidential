# What is Confidential DEX?

**Confidential DEX** is a decentralized perpetual exchange built on the Arc Network, designed for instant execution, deep liquidity, and a zero borrow fee model.

It combines the execution efficiency of centralized exchanges with the security and transparency of decentralized finance.

## Core Solutions

### 1. Low Execution Latency
Many decentralized exchanges rely on slow peer-to-peer orderbooks. Confidential DEX utilizes a Dual-Tranche Vault and a decentralized Keeper Network. Orders are executed via a 2-step Request-Execute model: traders submit requests on-chain, and Keepers execute them securely using current Oracle prices.

### 2. Predictable Slippage
Slippage often impacts profitability on traditional automated market makers (AMMs). We minimize slippage for standard orders through a price oracle architecture integrated with the Pyth Network. Execution settles against real-time oracle data, reducing the risk of stale-price arbitrage.

### 3. Protection Against Manipulation
To prevent liquidity drainage and market manipulation, the protocol implements a Dynamic Quadratic Price Impact algorithm. While standard retail orders remain largely unaffected, oversized positions that disrupt the market ratio incur an exponential price penalty.

---

## Technical Infrastructure

The platform synchronizes via Goldsky GraphQL and event-driven smart contracts. Automated execution for Take Profit, Stop Loss, and Limit Orders is handled by the Keeper Network without requiring traders to pay manual gas fees for trigger executions.

::: info Zero Borrow Fee
The protocol eliminates daily borrow fees. Instead, it utilizes a Dynamic Skew-Based Funding Rate, allowing traders to earn fees by taking positions that balance the long/short market ratio.
:::

::: info Contrarian Fee Rebate
Traders who open positions on the minority side (assisting in rebalancing the long/short skew) automatically receive a 25% discount on their trading fee. Combined with reduced price impact on balancing orders, this incentivizes market equilibrium.
:::

# System Architecture

The architecture of Confidential DEX is built on a modular foundation, revolving around a tripartite core contract system. This design balances high-performance execution via the Keeper network with decentralized asset security logic.

The protocol separates its business logic and state management into three core smart contract pillars, minimizing gas overhead and codebase complexity.

---

## Core and Supporting Contracts

### The Tripartite Pillars

| Contract Layer | Primary Role & Function |
| :--- | :--- |
| **ConfidentialCoreV1.sol** | **(Source of Truth)**<br>Stores critical protocol state variables, including Open Interest (OI) limits, leverage configurations, utilization caps, and circuit breaker mechanisms. |
| **ConfidentialTradingV1.sol** | **(Execution Engine)**<br>The primary interaction point for traders. Handles order requests via a 2-step execution model, validates margin and oracle prices, and calculates price impact penalties before updating the vault. |
| **ConfidentialVaultV1.sol** | **(Liquidity Reserve)**<br>Secures USDC funds deposited by Liquidity Providers (LPs). Processes deposits and withdrawals, settles PnL for traders, and manages LP share minting and burning. |

### Supporting Contracts

Two additional utility contracts support the core engine:

*   **`PythPriceOracle.sol` (Oracle Adapter):** A modular wrapper for the Pyth Network. It fetches, validates, and serves real-time price feeds to `ConfidentialTradingV1.sol`. This decoupling allows for future oracle upgrades without modifying the core execution engine.
*   **`ReentrancyGuard.sol` (Security Utility):** A lightweight module inherited by the core contracts to prevent reentrancy attacks, enforcing the Checks-Effects-Interactions (CEI) design pattern.

---

## Anti-Exploit Defense Layers

The system incorporates multiple security layers designed to mitigate common DeFi attack vectors:

### 1. 2-Step Request-Execute Model
::: info Advanced Execution Shield
Confidential DEX employs a secure 2-step Request-Execute model for all order types:
1. **Request:** The trader submits an order request (`placeOrder`), locking collateral and recording intent on-chain without executing against static or potentially stale prices.
2. **Execute:** The decentralized Keeper Network instantly monitors the request, retrieves the freshest real-time Pyth Oracle VAA proof, and calls `executeOrder` to settle the trade. This eliminates stale price arbitrage, sandwich attacks, and toxic order flow.
:::

### 2. Anti-Flash Loan Cooldown
::: info 5-Second Cooldown Period
Any newly opened position is restricted from being closed or modified for exactly 5 seconds. This neutralizes flash loan attacks and rapid intra-block price manipulations.
:::

### 3. Strict CEI (Checks-Effects-Interactions)
All functions involving the transfer of USDC adhere strictly to the CEI design pattern. State updates and internal accounting are finalized before any external asset transfers occur, preventing reentrancy vulnerabilities.

### 4. Pyth Oracle Confidence Check
During extreme market volatility, oracle confidence intervals may widen. The protocol automatically reverts trading transactions if the confidence interval gap from the Pyth Network exceeds the 2% threshold, prioritizing capital preservation over inaccurate execution.

### 5. Two-Step Ownership Transfer
The protocol utilizes a two-step ownership transfer mechanism (`transferOwnership` followed by `acceptOwnership`). This prevents the permanent loss of contract control due to typographical errors during administrative handovers.

### 6. Keeper Bot V1 Integration
To operate the execution layer, node operators utilize the `feederBot.cjs` script. It features built-in Multicall3 batch reading, rate-limit protection, and support for all order types and liquidations.

```bash
# Start the Keeper Bot in PM2 Daemon mode
pm2 start feederBot.cjs --name "KeeperBot"
pm2 logs KeeperBot
```

For complete technical specifications, refer to the [Keeper Network Documentation](../developers/keeper-network.md).

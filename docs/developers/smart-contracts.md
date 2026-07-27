# Smart Contracts Architecture & Modules

To ensure maximum transparency and facilitate public audits, this document details the modular smart contract layers that power the Confidential DEX protocol on the Arc Network.

---

## Upgradeable Proxy Architecture (`DEXProxy`)

To enable continuous iteration, bug fixes, and feature upgrades without compromising existing liquidity or state, Confidential DEX adopts the OpenZeppelin Transparent Upgradeable Proxy Pattern.

- **`DEXProxy.sol`:** Acts as the persistent proxy layer. User transactions and external calls (like order placement, collateral deposits, and keeper executions) interact exclusively with Proxy addresses. State variables, token balances, and liquidity remain locked within the Proxy contract storage.
- **`DEXProxyAdmin`:** A centralized governance and admin regulator that isolates upgrade privileges from regular operations. Only authorized admins can point the Proxy to a newly deployed Logic contract.

This separation guarantees that even when upgraded to new contract versions (e.g., adding new order types or enhancing margin calculations), **user positions, vault shares, and contract addresses never change**.

---

## Core Protocol Modules

Our protocol architecture is partitioned into modular, specialized smart contracts that securely interact with each other:

### 1. Confidential Core V1 (`ConfidentialCoreV1.sol`)
*The Central Risk Engine & Parameter Store.*
- **Open Interest (OI) & Risk Caps:** Manages dynamic long/short Open Interest limits per trading pair (in 6-decimal USDC) to prevent single-market exposure risks. Enforces utilization caps (`utilizationCapBps`) to protect vault liquidity.
- **Dynamic Funding Rate System:** Implement continuous peer-to-peer funding rates where the majority side (e.g., Longs) pays the minority side (e.g., Shorts) based on OI skew ratio (`(longOI - shortOI) / (longOI + shortOI)`), stabilizing balance naturally.
- **Fee Routing & Contrarian Rebate:** Distributes trading fees precisely between Vault LPs (70%) and protocol Treasury (30%). Calculates dynamic quadratic price impact penalties based on OI skew, and applies a 25% fee rebate for traders who help balance the Long/Short ratio.
- **Emergency Controls:** Equipped with timelocks and circuit breakers (`paused` state) to halt operations during systemic network anomalies.

### 2. Confidential Trading V1 (`ConfidentialTradingV1.sol`)
*The Execution Gateway & Order Matching Engine.*
- **Comprehensive Order Types:** Native on-chain support for **Market Open/Close, Limit Orders, Stop Orders, and TWAP (Time-Weighted Average Price)** slicing.
- **Position Management:** Tracks leverage up to **100x**, calculates liquidation thresholds, manages collateral adjustments, and calculates live PnL adjusted for borrowing and funding indexes.
- **Automated Keepers & Multicall Compatibility:** Optimized for batch processing via Multicall3, allowing automated Feeder/Keeper bots to verify triggers, execute orders, and perform liquidations with sub-second finality.
- **TP/SL Execution:** Direct on-chain Take-Profit (TP) and Stop-Loss (SL) execution logic without relying on centralized off-chain order books.

### 3. Confidential Vault V1 (`ConfidentialVaultV1.sol`)
*Dual-Tranche Proportional Liquidity Reserve.*
- **Counterparty Reserves:** Acts as the global counterparty to all trader positions. Trader losses become LP profits, and trader winnings are settled from the vault pool.
- **ERC-4626 Compliance:** Standardized tokenized vault system where Liquidity Providers receive `shares` reflecting real-time net asset value (NAV).
- **Dual-Tranche Security:** Built-in shared-loss structure separating standard and priority tranches, equipped with a **60% Floor Protection** mechanism to guard capital against flash drawdown events.

### 4. Pyth Price Oracle Adapter (`PythPriceOracle.sol`)
*High-Resolution On-Chain Price Validation.*
- **Decentralized Feeds:** Wraps the native Pyth Network contract, mapping pair IDs (e.g., `keccak256("BTC/USDC")`) directly to Pyth cryptographic price feed IDs.
- **Staleness & Confidence Enforcement:** Rejects price updates older than the configured `maxStaleness` threshold and validates high-confidence bands to entirely immunize trading execution against manipulation and oracle flash-loan attacks.

---

## Cryptographic Security Layers (Anti-Exploit)

Our contracts are engineered from the ground up to defend against modern DeFi attack vectors:

- **Strict CEI (Checks-Effects-Interactions):** All asset transfers (USDC) are executed strictly at the very end of function blocks after internal ledgers, Open Interest, and funding indexes have settled. This pattern shuts down any vulnerability to *Reentrancy Attacks* (`ReentrancyGuard.sol`).
- **Anti-Donation / Inflation Attack Protection:** Compliant with modern ERC-4626 security standards, initial vault share tokens (worth 1000 wei) are permanently burned upon vault initialization. This completely eliminates mathematical exploits where attackers attempt to artificially inflate share prices via massive unminted donations.
- **2-Step Ownership Transfer:** Protocol ownership transfers enforce a mandatory two-step hand-shake (`transferOwnership` followed by `acceptOwnership`). This guarantees the protocol can never be orphaned due to accidental typographical errors (fat-finger addresses).
- **Automated Epoch Bankruptcy:** Liquidity Providers do not inherit toxic debt from market collapses. If a Vault is completely depleted due to extreme cascading trader winnings, share values are prevented from entering negative territory; instead, the pool cleanly resets to a `1:1` initial price ratio under a fresh *Epoch* cycle.

---

## Live Contract Addresses (Arc Testnet)

Below are the primary upgraded smart contract addresses currently active on the Arc Testnet (`Chain ID: 5042002`).

::: info Integration Note
Use these addresses if you wish to build analytics dashboards, quant strategies, keeper network bots, or decentralized extensions on top of Confidential DEX.
:::

| Contract Module | Proxy Address | Description |
| :--- | :--- | :--- |
| **Confidential Core V1** | `0x0026Ceb6a0dB61224a1A94EfDDd3A37C424cF797` | Protocol brain: Open Interest limits, utilization caps, fees, and funding rate engine. |
| **Confidential Trading V1** | `0xFE7f9dDc814D51d487510BA32BD5F611Af131C20` | Primary gateway for margin trading, order triggers, TWAP execution, and liquidations. |
| **Confidential Vault V1** | `0xd0ABFF86ED2493008A2d26C6dA44FE26581f0A79` | Dual-tranche shared-loss LP pool with ERC-4626 compliant yield & capital floor. |
| **Pyth Price Oracle** | `0x7e8f460ebBAE6A767bC80561c322e3c589a8A3C7` | Oracle adapter enforcing maximum price staleness and cryptographic validation. |
| **DEX Proxy Admin** | `0x14C52C9Dc2fBFc58429744AE3631Ea6460C16349` | Governance admin contract responsible for safe logic proxy migrations. |
| **USDC Token (Arc)** | `0x3600000000000000000000000000000000000000` | Native 6-decimal base currency for all collateral deposits and LP stakes. |

---

> Found a bug or interested in deep algorithmic integration? Connect with our development team directly via the official repository at [confidentialdex/confidential](https://github.com/confidentialdex/confidential)!

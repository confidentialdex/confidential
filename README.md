# 🛡️ Confidential DEX (V1)

[![Network: Arc Testnet](https://img.shields.io/badge/Network-Arc_Testnet-6E56CF?style=flat-square&logo=ethereum)](https://testnet.arcscan.app)
[![Contracts: Solidity](https://img.shields.io/badge/Contracts-Solidity_%5E0.8.24-363636?style=flat-square&logo=solidity)](./contracts/src)
[![Frontend: Vite + React](https://img.shields.io/badge/Frontend-Vite_+_React-646CFF?style=flat-square&logo=vite&logoColor=white)](./src)
[![Indexer: Goldsky](https://img.shields.io/badge/Indexer-Goldsky_Subgraph-FF4D4D?style=flat-square&logo=graphql)](https://goldsky.com)

A decentralized, institutional-grade perpetual trading platform built on the **Arc Network Testnet**. Confidential DEX combines the speed and responsiveness of centralized exchanges (CEXs) with 100% self-custody and trustless execution using a modular smart contract architecture, Pyth Oracle price feeds, and a decentralized keeper network.

![Confidential DEX Preview](./resources/confidential_app.png)

---

## 🗺️ System Architecture

Confidential DEX employs an event-driven, keeper-automated execution pipeline. The system is split into three layers: the Client Web Application, the Smart Contract Execution Engine, and the Automation Infrastructure.

```mermaid
graph TD
    subgraph Frontend [Client Layer]
        User["👤 Trader / LP"] <--> |Privy / Wallet| React["💻 React + Wagmi App"]
    end

    subgraph Infra [Automation Layer]
        Keeper["🤖 Unified Keeper Bot (feederBot)"] <--> |Polls every 2.5s| RPC["⚡ Arc RPC Node"]
        Pyth["🔮 Pyth Hermes API"] --> |Price VAA updates| Keeper
        Goldsky["📊 Goldsky Subgraph"] <--> |GraphQL API Queries| React
    end

    subgraph Contracts [Solidity Core - Arc Chain]
        Trading["⚔️ ConfidentialTradingV1"] <--> |Settles Margin & Profit| Vault["🏦 ConfidentialVaultV1 (cUSDC)"]
        Trading --> |Queries Price| Oracle["PythPriceOracle"]
        Core["⚙️ ConfidentialCoreV1"] <--> |Manages Pair & Config| Trading
        Core <--> Oracle
    end

    React --> |1. Place Order| Trading
    Trading -.-> |2. Emit Events| Goldsky
    Keeper --> |3. executeOrder / liquidate| Trading
```

---

## 📁 Repository Structure

The codebase is organized as a monorepo consisting of the smart contract suite, the frontend web application, and the indexing subgraph:

```
├── contracts/               # Smart contract suite (Foundry/Hardhat)
│   ├── src/                 # Solidity contract source files
│   ├── test/                # Local Solidity unit & integration tests
│   ├── scripts/             # Contract deployment & configurations
│   └── feederBot.cjs        # PM2-compatible keeper bot (automated TP/SL, Limit, & Liquidations)
├── src/                     # Frontend web application (React, TS, Vite)
│   ├── abis/                # Contract ABI JSON artifacts
│   ├── components/          # Reusable UI components & modals
│   ├── config/              # RPC providers, chains, and Wagmi configs
│   ├── hooks/               # Custom React hooks (on-chain RPC & Subgraph readers)
│   ├── pages/               # Main application views (Trade, Vaults, Portfolio)
│   └── store/               # Zustand global state modules
├── subgraph/                # GraphQL indexing subgraph
│   ├── src/mapping.ts       # Subgraph event handlers (AssemblyScript)
│   ├── schema.graphql       # Subgraph database schemas
│   └── subgraph.yaml        # Subgraph manifest configuration
└── docs/                    # VitePress documentation site
```

---

## ⚙️ Protocol Core Mechanics

### 1. Dual-Tranche Vault (ERC-4626 cUSDC)
Platform liquidity is provided by depositors into a tokenized vault divided into two risk-reward segments (*tranches*) with a maximum absolute TVL cap of **$50,000,000 USDC**:

*   **Degen Vault (High Yield, High Risk):** Capped at **$15,000,000** (30% TVL). Earns **3x** the baseline share of trading fees, liquidation rewards, borrow fees, and trader losses. Shares trader payouts proportionally based on TVL, and absorbs any overflow if Prime hits its protection floor, allowing drawdown down to $0 (triggering an Epoch reset).
*   **Prime Vault (Capital Protected, Low Risk):** Capped at **$35,000,000** (70% TVL). Earns 1x baseline profit shares. Mechanically protected from bankruptcy by a strict **60% capital protection floor** (minimum 60% of historic assets cannot be drained by trader payouts).

### 2. Risk Management & Safeguards
*   **Utilization Cap (80%):** Trader positions cannot be opened if the vault cash utilization exceeds 80%. This guarantees a 20% cash buffer so LPs can withdraw their capital at any time.
*   **Emergency Auto-Deleveraging (ADL):** If high volatility causes vault utilization to surge past **95%**, the keeper network is authorized to force-close the most profitable trading positions to return liquidity to safe levels.
*   **Anti-MEV / Flash Loan Cooldown:** A mandatory 5-second cooldown is enforced between opening and closing a position to prevent sandwich and flash loan attack vectors.
*   **Dynamic Quadratic Price Impact:** To prevent market manipulation by whales, trade price impact is calculated exponentially relative to the pair's Open Interest. PAIR balancing trades (reducing skew) receive a **25% rebate** on trading fees and execute with zero price impact.

### 3. Unified Keeper Economics (`feederBot.cjs`)
The network is automated by permissionless Keepers running the custom keeper bot:
*   **No-Cost Monitoring:** Keeper operations scan orders and positions via free RPC `eth_call` (Read-only), requiring 0 gas fees to monitor.
*   **Compensation Loop:** Execution commands (`executeOrder`, `liquidate`, `executeTPSL`) consume network gas + Oracle fee. The user pre-funds this using an `Execution Fee` (paid in `ARC`), which is instantly forwarded to the executing Keeper (`msg.sender`) upon a successful transaction.

---

## 📚 Documentation

For an in-depth understanding of the platform's tier-1 circuit breakers, quadratic price impacts, and security mechanisms, please read our comprehensive **[Platform Mechanics Guide](./resources/platform_mechanics.md)**.

---

## 📜 Contract Addresses (Arc Testnet)

| Contract | Address | Explorer Link |
| :--- | :--- | :--- |
| **ConfidentialCoreV1 (Proxy)** | `0x9acec9Ad24870f95927224FfC5E1c94274492cd8` | [View Explorer](https://testnet.arcscan.app/address/0x9acec9Ad24870f95927224FfC5E1c94274492cd8) |
| **ConfidentialTradingV1 (Proxy)** | `0xc07368d1dfb34AB43c4c113aA87b656ee5B04634` | [View Explorer](https://testnet.arcscan.app/address/0xc07368d1dfb34AB43c4c113aA87b656ee5B04634) |
| **ConfidentialVaultV1 (Proxy)** | `0x31cabF85147b42184E2d053f0e9c0d60357ea1EC` | [View Explorer](https://testnet.arcscan.app/address/0x31cabF85147b42184E2d053f0e9c0d60357ea1EC) |
| **DEXProxyAdmin** | `0x14C52C9Dc2fBFc58429744AE3631Ea6460C16349` | [View Explorer](https://testnet.arcscan.app/address/0x14C52C9Dc2fBFc58429744AE3631Ea6460C16349) |
| **Pyth Oracle (Proxy)** | `0x06D2cDcE80b76ef3F0150ff502A3c55E7D9c4F7C` | [View Explorer](https://testnet.arcscan.app/address/0x06D2cDcE80b76ef3F0150ff502A3c55E7D9c4F7C) |

---

## 💻 Developer Setup & Installation

### Prerequisites
*   Node.js (v18+)
*   NPM (v9+)
*   [Foundry](https://book.getfoundry.sh/getting-started/installation) (for contract testing/development)

### 1. Smart Contracts
Navigate to the contracts directory and install dependencies:
```bash
cd contracts
npm install
```
To run local Solidity unit tests using Forge (Foundry):
```bash
forge test
```
To compile contracts:
```bash
forge build
```

### 2. Frontend Application
Navigate to the root directory and install dependencies:
```bash
npm install
```
Configure your environment variables in `.env` in the root:
```env
VITE_PRIVY_APP_ID=your_privy_app_id
VITE_ARC_RPC=https://rpc.testnet.arc.network
```
Run the local Vite development server:
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 3. Running the Keeper Bot
Run the background automation script to process limit orders, liquidations, and TP/SL:
```bash
cd contracts
# Set private key of the keeper wallet with testnet ARC gas
export PRIVATE_KEY=0xyour_keeper_private_key
node feederBot.cjs
```

---

## 🛡️ Audits & Security
This codebase is deployed on the **Arc Network Testnet** and represents a beta deployment. Do not use production funds. 

To report bugs, security vulnerabilities, or contribute improvements, please open a GitHub Issue or submit a Pull Request.

**Confidential DEX © 2026**

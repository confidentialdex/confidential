# 📘 Confidential DEX Architecture & Security Guide

**Confidential DEX** is a next-generation decentralized perpetual exchange that combines the execution speed of centralized exchanges (CEX) with the absolute transparency and security of Web3. Built on a highly optimized, modular smart contract infrastructure, this platform is specifically designed to solve three fundamental problems in DeFi: high execution latency, detrimental slippage costs, and whale manipulation risks.

---

## 1. 🚀 V1 Architecture Advantages (Direct-to-Vault & Unified Keeper)

Following a rigorous code cleanup and optimization process, Confidential DEX now operates on a clean, efficient **V1 Direct-to-Vault Execution** model that prioritizes execution speed.

*   **Zero-Latency Settlement:** Eliminates slow Peer-to-Peer queue systems. Every order (Market, Limit, Stop) is routed directly against the Liquidity Vault for instant (1-step) settlement.
*   **Guaranteed Liquidity:** Traders do not have to wait for a counterparty. The Vault capacity guarantees that orders of any size will be absolutely executed as long as Vault utilization permits.
*   **Zero-Delay Pipeline (Event-Driven & Unified Bot):** The Goldsky GraphQL Subgraph and Pyth Network infrastructure are combined asynchronously. Every press of the "Buy" button on the UI instantly bundles the latest Oracle price, backed by a Unified Keeper Bot that monitors the market 24/7.

---

## 2. 🏦 Liquidity Specifications: Dual-Tranche Vault

Liquidity on this DEX is segmented into two independent vault layers (tranches) with an absolute maximum capacity (Total TVL Cap) of **$50,000,000 USDC**. The vaults operate using the ERC-4626 Tokenized Vault standard with an Auto-Compounding system (cUSDC).

### 🔴 Degen Vault (High-Yield Vault)
Designed for high-risk liquidity providers (LPs) who desire aggressive capital growth.
*   **Maximum Capacity (Share):** **$15,000,000** (30% of Total TVL)
*   **Profit Incentives:** Earns a profit percentage **3x larger** from all protocol revenues (Trading Fees, Liquidations, Funding Rates, and Trader Losses).
*   **Risk (Proportional Shared-Loss):** Losses resulting from trader wins are shared **proportionally** between Degen and Prime based on their respective TVL ratios. Degen still bears a larger portion because its TVL is typically smaller, plus it receives the overflow if Prime hits its Protection Floor. The Degen Vault can be depleted to $0 (triggering an Epoch Reset).
*   **Lockup Period:** 2 Days (172,800 seconds). Deposited funds are locked for 2 absolute calendar days without any shortcuts.

### 🔵 Prime Vault (Capital Protected Vault)
Designed for institutions or whales who prioritize security and constant value appreciation.
*   **Maximum Capacity (Share):** **$35,000,000** (70% of Total TVL)
*   **Profit Incentives:** Earns the remaining 1x regular profit share. Share value appreciation is steady but highly resistant to sharp drawdowns.
*   **Extreme Protection:** Mathematically protected from bankruptcy risks (See Capital Protection details in Chapter 3).
*   **Lockup Period:** 5 Days (432,000 seconds). Deposited funds are locked longer to maintain the stability of the exchange's cash reserves. New deposits use a **Weighted Average Deposit Time** system, ensuring that small capital additions do not reset the entire waiting time of much larger existing balances.

---

## 3. 🛡️ Systemic Protection & Risk Management

To keep the smart contract economy running stably, the ecosystem is equipped with mathematical defense walls:

### A. Vault Utilization Cap (Maximum Execution Limit) : `80%`
*   Applies when a trader **OPENS** a position.
*   The system will not allow the opening of a new position if the cash currently used to back open positions (Open Interest) hits **80%** of the Vault balance. The remaining **20%** is an untouchable Cash Reserve guaranteed to be available so that LPs can always withdraw their assets at any time without transaction failures (Reverts).

### B. Proportional Shared-Loss with Prime Protection Floor : `60%`
*   Applies when a trader **CLOSES** a position (taking profits), as well as during Funding Rate profit/loss distribution.
*   Losses resulting from trader wins are shared **proportionally** between the Degen Vault and Prime Vault based on their respective TVL ratios. Both LP groups bear the burden fairly.
*   However, the Prime Vault is protected by a *Protection Floor*: **A minimum of 60% of the Prime Vault's Total Assets is absolutely locked** and cannot be drained. If the Prime Vault's proportional share exceeds this limit, the excess (overflow) is diverted to the Degen Vault.
*   **Circuit Breaker (40%):** If the total cumulative losses of the Prime Vault reach **40% of Historical Total Deposits**, the Smart Contract automatically pauses the entire DEX to protect LP capital. This limit is tracked for the lifetime of the vault (historical absolute) and does not reset daily.

### C. Emergency Auto-Deleveraging (ADL) : `95%`
*   The most extreme line of defense against liquidity crises.
*   If market movements cause Vault cash utilization to spike beyond **95%**, the Keeper Bot is authorized to forcefully kill profitable trader positions to return liquidity to the safe zone.

### D. Auto-Scaling Withdrawals (Dynamic Liquidity Realization)
*   If a Liquidity Provider (LP) attempts to withdraw more funds than the Available Liquidity (idle cash not currently used by traders), the system will not fail the transaction (Revert).
*   The V1 Smart Contract will automatically release the maximum available funds in the vault at that second, while leaving the remaining portion of the LP's shares intact inside the Vault to be withdrawn later.

---

## 4. 🤖 Role & Economics of the Keeper Bot (`feederBot.cjs`)

Platform automation is executed autonomously by a single **Unified Keeper Bot** running 24/7 on a VPS server. This bot performs 3 sweeping cycles simultaneously every **2.5 seconds**:

1.  **Pending Order Execution:** Monitors Limit, Stop Market, TWAP, and delayed Market Orders. Once the market price from the Pyth Oracle hits the target (`triggerPrice`), the bot instantly calls the `executeOrder` function on the blockchain.
2.  **Take Profit & Stop Loss (TP/SL):** Monitors the upper and lower limits of active trader positions. When profit/loss targets are reached, the bot triggers `executeTPSL` to close the position automatically.
3.  **Underwater Position Liquidation:** Scans the collateral health (collateral ratio) of traders. If the margin no longer meets the minimum requirements, the bot triggers `liquidate` to secure the pool's cash.

### 💰 Fees, Gas, & Rewards Mechanism (Fee Economics)
The bot's financial system is designed fairly so that bot operators never experience losses or depleted balances:
*   **100% Free Monitoring:** The bot's activity of sweeping and reading prices every 2.5 seconds is a Read-Only operation to the RPC network, so it **consumes zero gas fees (0 ARC)**.
*   **Execution Fees Paid by User:** When a User (Trader) places an order, they are required to include an **Execution Fee (in ARC coin)** and a **Trading Fee (in USDC)** from their own wallet.
*   **Keeper Reward:** When the bot executes a real order on the blockchain, the bot spends a small amount of gas fee + **Dynamic Pyth Oracle Verification Fee** (usually very cheap, e.g., `1 wei`, and the bot has a fallback reserve of `0.001 ARC` if the RPC is problematic). When the transaction succeeds, the smart contract automatically **transfers the entire Execution Fee paid by the User to the Bot's wallet (`msg.sender`)** as a reward for the bot's hard work (this is pure profit on top of gas/Pyth costs)!
*   **Trading Fee Distribution (USDC):** Of the total USDC fees paid by the trader, the smart contract splits it into **70% to the Vault** (increasing LP token dividends/price) and **30% to the Treasury** (platform developer funds).

*(Note: This execution function operates 100% Permissionless, meaning anyone in the world is entitled to run their own bot and compete to earn execution rewards).*

---

## 5. ✨ Institutional-Grade Functional Execution

*   **Dynamic Skew-Based P2P Funding Rate:** Eliminates Borrow Fees (rent) to 0% to make it lighter. The platform implements a highly dynamic Continuous P2P Funding Rate based on the imbalance ratio (skew) between Longs and Shorts (not based on Vault utilization ratio). The majority will directly pay the minority. If the market is 100% Long, they will be charged the maximum fee (e.g., 0.0125% per hour), immediately creating profit opportunities (arbitrage) for anyone brave enough to open Short positions to balance the market.
*   **Limit Order Discipline (0% Buffer):** Limit Orders use 100% precision without premature execution buffers. Orders are only opened if the market price exactly touches or crosses the target.
*   **Execution Buffer (Anti-Wick) 0.3%:** Specifically for Stop Orders, Take Profits (TP), and Stop Losses (SL), there is a 0.3% (30 bps) execution buffer to protect traders from execution failures (reverts) during sudden volatility or market crashes.
*   **Harmonic Averaging & Strict Leverage Validation:** New entry calculations when traders add to a position use harmonic averaging. In addition, the system strictly calculates and validates the combined leverage of assets before and after merging, preventing any forced position addition tactics that result in leverage above the maximum limit (max `100x`).
*   **On-Chain Max Leverage Tiers:** Leverage limits are set directly in the smart contract according to the asset's volatility class: **100x** for major crypto assets (BTC, ETH, SOL) and Forex; **50x** for Altcoins and Commodities (Gold/Silver); and **20x** for Stock Indices (S&P500, NASDAQ).
*   **TWAP (Time-Weighted Average Price):** Slices large orders across a calibrated timeframe to minimize quadratic price impact.
*   **Dynamic Quadratic Price Impact (Anti-Whale Weapon):** Price Impact is calculated exponentially (Squared) based on position size relative to Max OI. Small orders are barely felt, but giant orders (whales) are immediately choked by lethal penalties. This system is also **Skew-Aware**: If a whale opens a position in a direction that further skews the market, they receive the full penalty. If a trader opens a position to balance the market (minority side), they receive a **25% Fee Discount on the entire position fee**—not just the portion that fills the OI gap, but the entire position size. Price Impact still applies normally to the overshoot portion.
*   **Partial Close:** Advanced flexibility where traders can close a certain percentage of their active position. The smart contract precisely recalculates the remaining collateral, secures profits/losses on the closed portion, and instantly updates the liquidation price without disturbing the rest of the position.

---

## 6. 🔐 Anti-Exploitation Defense Layers

1.  **Anti-Flash Loan & MEV (5-Second Cooldown):** Newly opened positions are impossible to close or manipulate within 5 seconds. This totally eliminates Flash Loan exploit attacks within a single block cycle.
2.  **Oracle Confidence Interval:** The system refuses to trade if the price estimation spread (Confidence Interval) from Pyth data exceeds rational limits due to external volatility storms.
3.  **Strict CEI (Checks-Effects-Interactions):** All money movements (USDC) are executed purely at the end of the logic after OI reduction and PnL recording, completely sealing Reentrancy Attack vulnerabilities.
4.  **Anti-Donation Attack (ERC-4626):** The first $1,000 deposit into the Vault is permanently burned to prevent share price ratio inflation exploits.
5.  **Automated Epoch Bankruptcy:** LPs do not inherit "debt" from price collapses. If a Vault is drained to a $0 balance due to consecutive trader wins, shares are cleanly reset to a 1:1 ratio in a new Epoch.
6.  **2-Step Ownership Transfer (Admin Security):** The Ownership transfer system (admin rights of the smart contract) uses a 2-Step protection. `transferOwnership` must be followed by an `acceptOwnership` verification from the destination wallet. This totally eliminates "fat-finger" (typo address) risks that could cause the DEX to be locked forever.

# 📊 Fees & Price Impact

Within this ecosystem, financial equilibrium is structured so that *Liquidity Providers* (LPs) are protected, while *Traders* are not burdened by hidden fees.

---

## ⚖️ On-Chain Max Leverage Tiers & OI Limits

As a mathematical safety net for both trader asset sizing and liquidity reserves, maximum leverage limits and open interest (liquidity) limits are strictly hardcoded into the *Smart Contracts*, adjusted according to the volatility class of each asset.

| Asset Class | Category / Examples | Max Leverage | Max OI / Liquidity Limit (L/S) | Description |
| :--- | :--- | :---: | :---: | :--- |
| **Tier 1 (Major & Forex)** | Major Crypto (`BTC/USDC`, `ETH/USDC`, `SOL/USDC`), Forex (`EUR/USDC`, `GBP/USDC`, `USDJPY/USDC`) | **100x** | **$10,000,000 ($10M) for Crypto, $5,000,000 ($5M) for Forex** | Supported by the deepest liquidity and highest capacity per side. Ideal for institutional volume and aggressive scalping. |
| **Tier 2 (Mid)**| Altcoins (`BNB`, `DOGE`, `PEPE`, etc.), Commodities (`GOLD`, `SILVER`) | **50x** | **$5,000,000 ($5M)** | High volatility or gaps. Leverage and open interest capacity are capped to prevent instant liquidations and protect vault reserves. |
| **Tier 3 (Equities)** | Stock Indices (`SPY`) & Stocks (`AAPL`, `TSLA`, `NVDA`) | **20x** | **$5,000,000 ($5M)** | Traditional market assets with specific trading hours gaps. Strictly capped to 20x leverage. |

---

## 🐳 Dynamic Quadratic Price Impact

This feature is our most advanced **Anti-Whale Weapon**.

In centralized exchanges, whales damage prices by eating through orderbook depth. At *Confidential DEX*, *Price Impact* is calculated synthetically using a quadratic formula (exponential power of two) based on the trade size ratio against the coin's *Max Open Interest* limit.

- **Retail Traders:** For small position sizes, the impact is virtually `0.00%`. You won't feel any friction.
- **Whale Traders:** The larger the order size from a single individual at any given time, the larger the penalty imposed by the smart contract—growing exponentially up to a **Hard Cap of 2.00% (`maxPriceImpactBps = 200`)**. Even for massive orders, your maximum price impact penalty is strictly protected at **2%**. This prevents massive players from selfishly draining the Vault's cash reserves while keeping execution costs predictable.

::: tip Skew-Aware Mechanism (Penalty Discount)
We heavily favor traders who help balance the market. If the current majority position is LONG (a Skewed Market), and you place a massive **SHORT** order (balancing the Skew), the contract automatically rewards you with a **25% Rebate on your Trading Fee** and executes your trade with **Zero Price Impact**.
:::

---

## 🌊 Skew-Based P2P Funding Rate

There are no fixed daily Borrow Fees here.

Carrying costs are managed exclusively through a **Continuous P2P Funding Rate**. Hourly fees are not calculated based on how much of the vault's funds are utilized, but are assessed purely on the **Ratio Imbalance (Skew)** between the Long and Short masses.

**The Absolute Rule:** The Majority must pay the Minority.

*   If 90% of the crowd is Long (Bullish), the Long side will be charged a progressive fee (e.g., `0.0125%` per hour).
*   100% of these deducted fees from the Long side are instantly streamed as payment into the wallets of the 10% Short side (the Minority).
*   This mechanism constantly generates **Arbitrage Opportunities**, calling upon large speculators to step in and flatten the directional ratio back to 50:50.

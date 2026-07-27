# Fees & Price Impact

The financial model of Confidential DEX is designed to ensure sustainable liquidity provision while maintaining transparent execution costs for traders.

---

## Fee Structure

### Trading Fees

| Order Type | Fee Rate | Distribution |
| :--- | :---: | :--- |
| **Market Order** (Open / Close / Stop / TWAP) | **0.05%** (5 bps) | 70% to Vault (LP Revenue), 30% to Treasury |
| **Limit Order** | **0.03%** (3 bps) | 70% to Vault (LP Revenue), 30% to Treasury |

- **Borrow Fee:** **0%** — Daily borrow and rollover fees are not charged.
- **Execution Fee:** A flat fee paid in native ARC tokens to compensate the Keeper Network for gas costs during transaction settlement.

---

## Leverage & Open Interest Constraints

To maintain systemic stability and protect vault reserves, maximum leverage and open interest (OI) limits are strictly enforced at the smart contract level, categorized by asset volatility.

| Asset Class | Examples | Max Leverage | Max OI Limit (per side) | Description |
| :--- | :--- | :---: | :---: | :--- |
| **Tier 1** | `BTC`, `ETH`, `SOL`, `EUR`, `GBP`, `USDJPY` | **100x** | **$10,000,000 (Crypto), $5,000,000 (Forex)** | Major assets supported by the highest liquidity capacity. |
| **Tier 2** | `BNB`, `DOGE`, `PEPE`, `GOLD`, `SILVER` | **50x** | **$5,000,000** | Mid-cap and commodity assets with regulated exposure limits. |
| **Tier 3** | `SPY`, `AAPL`, `TSLA`, `NVDA` | **20x** | **$5,000,000** | Traditional equities bound by market-hour gaps. |

---

## Dynamic Quadratic Price Impact

To simulate orderbook depth and prevent large individual orders from destabilizing the liquidity pool, the protocol applies a synthetic price impact calculation.

Price impact utilizes a quadratic function based on the trade size relative to the asset's maximum Open Interest limit.

- **Retail Execution:** Small position sizes incur nominal to zero price impact.
- **Large Orders:** As position size increases, the price impact penalty scales quadratically, capped at a maximum of **2.00% (200 bps)**.

### Calculation Methodology

The system evaluates the order against the current Long/Short OI skew:

1. **Balancing Portion:** The fraction of the order that reduces the gap between Long and Short OI. This portion incurs **zero price impact**.
2. **Overshoot Portion:** The fraction of the order that extends the OI imbalance. This portion is penalized using the formula: `impactBps = (overshoot / maxOI)² × 200`.

The resulting price impact modifies the entry price (increasing for longs, decreasing for shorts).

::: info Contrarian Fee Rebate (25% Discount)
Traders who open positions that counter the prevailing market skew (e.g., opening a Short when the majority is Long) automatically receive a **25% rebate on their total trading fee**. This creates an economic incentive for market equilibrium. The price impact calculation still applies to the overshoot portion, but the fee rebate covers the entire order size.
:::

---

## Skew-Based P2P Funding Rate

Instead of fixed daily borrow fees, carrying costs are managed via a continuous peer-to-peer (P2P) funding rate.

Funding rates are determined by the ratio imbalance (skew) between aggregate Long and Short open interest. The side with the larger open interest pays the minority side.

* If the majority of open interest is Long, Long positions are assessed a progressive hourly fee.
* 100% of these collected fees are streamed directly to traders holding Short positions.
* This mechanism continually incentivizes arbitrageurs to balance directional exposure.

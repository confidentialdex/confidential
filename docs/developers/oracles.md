# Oracles & Pricing

Confidential DEX relies on extremely precise, low-latency, and manipulation-resistant price feeds to settle trades securely.

To achieve this, we integrate directly with the **Pyth Network**, a decentralized financial oracle that provides real-time market data sourced directly from first-party data providers (major exchanges and market makers).

---

## The Pyth Pull Oracle Model

Unlike traditional push oracles (where the oracle network pays gas to constantly push updates to the blockchain), Pyth uses a **Pull Oracle Model**.

Prices are continuously aggregated and cryptographically signed off-chain by the Pyth Network. When a user requests to open or close a trade on Confidential DEX, the Keeper bot fetches the latest cryptographically-signed price update (a VAA) from the Pyth network and submits it *alongside* the trade execution transaction.

**Why is this better?**
1. **Instant Updates:** We do not have to wait for a "heartbeat" or a 0.5% price deviation for the on-chain price to update. The price is always fresh the exact millisecond the trade is executed.
2. **Cost Efficiency:** The protocol does not waste money paying gas for constant price updates when no trades are happening.
3. **MEV Resistance:** Because trades are requested first, and executed seconds later with a newly fetched price, front-running and sandwich attacks are mathematically impossible.

---

## Staleness & Confidence Bounds

To ensure extreme safety during black swan events or network congestion, the `PythPriceOracle.sol` adapter implements two strict safety checks:

### 1. Max Staleness (15 Seconds)
If the cryptographically signed Pyth price provided by the Keeper is older than 15 seconds, the Confidential DEX smart contract will entirely reject the transaction. This guarantees that trades never execute against stale data.

### 2. Confidence Interval Gap Check (2%)
Every Pyth price comes with a "Confidence Interval" (a measure of how much uncertainty exists in the market across different exchanges). 

If the market goes haywire (e.g., Binance says BTC is $60k, Coinbase says it's $58k, Kraken says it's $62k), the confidence interval widens. 
If the confidence interval exceeds **2% of the asset's price**, Confidential DEX automatically halts executions for that specific asset until the market stabilizes. This prevents the protocol from settling trades at highly inaccurate or manipulated prices.

# Risk Management & Stability

Maintaining the stability of the protocol and ensuring consistent capital availability for Liquidity Providers (LPs) is paramount. Confidential DEX employs deterministic on-chain risk management mechanisms to regulate liquidity circulation and mitigate systemic risks.

---

## 1. Vault Utilization Cap: 80%

The protocol continuously monitors vault utilization (the ratio of borrowed capital backing open interest to total vault liquidity). This acts as a proactive defense mechanism during the initiation of new trading positions.

- The smart contract automatically reverts any order request that would push the vault utilization above the **80%** threshold.
- This ensures a guaranteed **20% idle cash reserve** is maintained at all times, securing capital availability for LP withdrawals and mitigating liquidity lockups.

### Market-Specific Open Interest Limits

To prevent concentrated exposure and protect vault reserves from single-asset volatility, absolute open interest (OI) maximums are strictly enforced per trading pair:
- **Major Crypto (`BTC/USDC`, `ETH/USDC`):** Capped at **$10,000,000** per side (Long / Short).
- **Altcoins, Commodities, Forex & Stocks:** Capped at **$5,000,000** per side (Long / Short).

---

## 2. Emergency Auto-Deleveraging (ADL): 95%

::: info ADL Trigger (Systemic Protection)
If extreme market volatility rapidly inflates trader profits and pushes vault utilization past the critical **95%** threshold, the system enters Auto-Deleveraging (ADL) mode.
:::

When utilization reaches 95%, the Keeper Network is authorized to execute partial closures on highly profitable trader positions. This redistributes margin back into the vault's idle reserves, reducing utilization to safe levels. This mechanism ensures LP capital is shielded from total depletion and preserves the solvency of the protocol during black swan events.

---

## 3. Auto-Scaling Withdrawals (Dynamic Fulfillment)

To provide a seamless experience for Liquidity Providers and avoid frustrating transaction reverts due to momentary liquidity constraints, the protocol utilizes an Auto-Scaling Withdrawal mechanism.

- If an LP requests a withdrawal that exceeds the currently available idle liquidity (e.g., requesting $1,000,000 when only $400,000 is idle in the vault), the transaction **will not revert**.
- The smart contract fulfills the withdrawal up to the maximum available idle liquidity ($400,000) and transfers it to the LP immediately.
- The unfulfilled portion ($600,000) remains intact as LP shares (`cUSDC`) in the user's wallet, which can be withdrawn as trading positions are closed and liquidity is subsequently freed.

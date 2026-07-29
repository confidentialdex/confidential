# Funding Rates (Zero Borrow Fee)

Unlike traditional perpetual exchanges that charge a fixed borrow fee every hour regardless of market conditions, Confidential DEX utilizes a **Zero Borrow Fee** model powered by a **Dynamic Skew-Based Funding Rate**.

---

## What is Market Skew?

At any given time, the total amount of money betting that an asset will go up (Long Open Interest) might not equal the total amount betting it will go down (Short Open Interest).

- **Long Skew:** `Long OI > Short OI`
- **Short Skew:** `Short OI > Long OI`
- **Balanced Market:** `Long OI == Short OI`

For the Vault (Liquidity Providers) to remain perfectly hedged, the ideal scenario is a Balanced Market. 

---

## How Funding Works

To incentivize a balanced market, the protocol charges the majority side and pays the minority side. **The protocol does not keep these fees; it is a direct peer-to-peer transfer between traders.**

### Example: Heavy Long Skew
If the market is heavily Long on BTC:
- **Longs (Majority):** Will *pay* a funding rate continuously while their position is open.
- **Shorts (Minority):** Will *receive* a funding rate, meaning they are getting paid to keep their position open!

::: info Earn While You Sleep
If you notice a heavy skew on the platform, you can open a contrarian position (e.g., Shorting when everyone is Long) and literally get paid funding every second your trade is open.
:::

## Real-Time Settlement

Funding is calculated and accrued continuously (per second). You don't have to wait for an hourly or 8-hour epoch to settle. When you close your position or take profit, the accumulated funding is automatically applied to your final payout.

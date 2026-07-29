# Providing Liquidity

Liquidity Providers (LPs) act as the counterparty to all traders on Confidential DEX. By depositing USDC into the Vault, you enable traders to open leveraged positions, and in return, you earn a share of the protocol's revenue.

---

## How It Works

When you provide liquidity, your USDC is deposited into an **ERC-4626 Vault**. 

1. **Deposit:** You deposit USDC into either the Prime or Alpha Tranche.
2. **Receipt Tokens:** You receive `cUSDC` (Confidential USDC) receipt tokens representing your share of the pool.
3. **Auto-Compounding:** As the protocol generates revenue (from trading fees, liquidation penalties, and funding rates) or profits from trader losses, the value of the Vault increases. This causes the exchange rate of `cUSDC` to `USDC` to rise.
4. **Withdrawal:** When you withdraw, you burn your `cUSDC` and receive back your initial deposit plus your share of the profits. You do not need to manually claim rewards.

## Earnings & Risks

Because LPs act as the counterparty to traders:
- If a trader loses money, the Vault (LPs) **makes money**.
- If a trader makes money, the Vault (LPs) **pays out the profit**.

Historically, the house edge (trading fees, liquidations, and the fact that most retail traders lose over a long enough time horizon) results in a steady upward yield for the Vault. However, during periods of extreme trader success, the Vault can experience short-term drawdowns.

This is why Confidential DEX offers two tranches:
- **Prime Tranche:** If you want steady growth but cannot tolerate high risk, the Prime tranche guarantees a 60% mathematical protection floor on your capital against trader wins.
- **Alpha Tranche:** If you are comfortable absorbing higher drawdowns for a higher yield, the Alpha tranche offers a 3x profit multiplier.

## Lockup Periods

To prevent manipulation and sandwich attacks on the Vault's value, all deposits are subject to a mandatory lockup period before they can be withdrawn:
- **Prime Tranche:** 5 Days
- **Alpha Tranche:** 2 Days

::: info Weighted Average Lockup
To prevent arbitrary resets of the lockup period when making subsequent deposits, the system employs a weighted average calculation for deposit timestamps. This ensures large principal amounts are not disproportionately penalized by small additional deposits.
:::

# Margin & Leverage

Confidential DEX allows traders to leverage their capital up to **100x** on supported pairs, maximizing capital efficiency.

---

## Isolated Margin

All positions on Confidential DEX are currently **Isolated Margin**. 

This means that the collateral allocated to a specific position is the *only* collateral at risk for that position. If you open a 50x Long on BTC with 100 USDC, the maximum you can lose is that 100 USDC. The rest of your wallet balance remains entirely safe and unaffected.

## Calculating Leverage

Leverage is the ratio of your position size to your locked collateral. 

```text
Leverage = Position Size (in USD) / Collateral (in USDC)
```

**Example:**
- You deposit **1,000 USDC** as collateral.
- You select **10x Leverage**.
- Your total Position Size is **10,000 USD**.

Any percentage change in the asset's price will be multiplied by your leverage. If the asset goes up 1%, your PnL is +10% of your collateral.

---

## Averaging (Adding Margin/Size)

You can manage your risk dynamically by adding collateral or increasing your position size while the trade is open.

When you add collateral to an existing position (or average your entry price by increasing size), the protocol applies a precise **volume-weighted average price (VWAP)** calculation. 

This ensures that:
1. Your new entry price accurately reflects the combined average of your original and new entries.
2. Your leverage size is recalculated properly.
3. The liquidation price is pushed further away, giving your position more room to breathe during volatility.

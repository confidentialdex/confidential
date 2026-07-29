# Liquidations

In leveraged trading, your collateral acts as a safety deposit. If the value of your position drops significantly, the protocol must close your position before your losses exceed your collateral, protecting the Vault and LPs from bad debt.

---

## Maintenance Margin

To keep a position open, your remaining collateral (Margin minus Unrealized Losses) must stay above a certain threshold, known as the **Maintenance Margin**.

If your collateral falls below this threshold, your position is flagged for liquidation.

### How is it calculated?
Liquidation prices are calculated strictly on-chain using the exact Pyth oracle price.
If `(Collateral + Unrealized PnL) < Maintenance Margin`, the position is liquidated.

::: warning Keep your Margin Healthy
We highly recommend adding collateral or reducing your position size well before your liquidation price is reached. You can do this at any time while the position is open.
:::

---

## The Liquidation Process

Because smart contracts cannot execute themselves, Confidential DEX relies on a decentralized network of Keepers to process liquidations.

1. **Price Crosses Threshold:** The Pyth oracle price crosses your liquidation price.
2. **Keeper Execution:** A Keeper bot detects the undercollateralized position and calls the `liquidatePosition` function on the `Trading` contract.
3. **Settlement:** The contract verifies the price and officially liquidates the position.

### Liquidation Penalty
When a position is liquidated, the remaining collateral is not fully returned to the user. A liquidation penalty is applied to compensate the Keeper who executed the liquidation and to add a buffer to the Vault.

- A portion of the penalty is paid to the **Keeper** as a reward (gas compensation).
- The rest is seized by the **Vault** to cover potential slippage during rapid market crashes.

---

## Preventing Liquidations

To avoid liquidations, you can use the built-in risk management tools:
- **Set a Stop Loss:** Always set a Stop Loss slightly above (or below, for shorts) your liquidation price so you have control over your exit.
- **Add Margin:** Deposit more USDC into your open position to lower your effective leverage and push your liquidation price further away.

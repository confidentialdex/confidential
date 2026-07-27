# Dual-Tranche Vault System

The foundation of execution depth and liquidity for Confidential DEX relies on its specialized Liquidity Provider (LP) architecture.

Liquidity is segmented into two independent vault tranches running entirely on-chain. Collectively, this dual-tranche system supports a maximum total capacity (Total Value Locked Cap) of **$50,000,000 USDC**.

The system utilizes the ERC-4626 Tokenized Vault architecture, enabling auto-compounding yields. As the exchange generates protocol revenue, the underlying value of the receipt shares (`cUSDC`) appreciates passively, requiring no manual reward claims.

---

## Tranche Comparison

| Specification | Alpha Tranche (High-Yield) | Prime Tranche (Protected) |
| :--- | :--- | :--- |
| **Risk Profile** | High-Risk, Yield-Optimized | Risk-Averse, Capital Protected |
| **Max Capacity (TVL Cap)** | **$15,000,000** (30% Quota) | **$35,000,000** (70% Quota) |
| **Revenue Share** | **3x** Multiplier | **1x** Base Rate |
| **Liability (Trader Wins)** | Proportional Shared-Loss (+ overflow) | Proportional Shared-Loss (60% Floor) |
| **Lockup Period** | **2 Days** (172,800 seconds) | **5 Days** (432,000 seconds) |
| **Deposit Time Algorithm** | Absolute/Straight-line | Weighted Average Deposit Time |

---

## Alpha Tranche (High-Yield Vault)

The Alpha Tranche is the high-yield engine of the ecosystem, designed for investors seeking maximum capital efficiency.

*   **Proportional Shared-Loss:** Alpha LPs share trader payout liabilities proportionally with Prime LPs based on their respective TVL ratios. Additionally, the Alpha tranche absorbs any overflow liability if the Prime tranche reaches its 60% protection floor.
*   **Premium Yields:** In exchange for assuming higher risk, the Alpha Tranche receives a **3x profit multiplier** from protocol revenues, which include trading fees, liquidation penalties, and funding rates.
*   **Epoch Reset Mechanism:** During extreme and sustained market drawdowns, the Alpha Tranche can be fully depleted. If this occurs, the smart contract executes a clean slate reset (Epoch Reset) to ensure new capital deposits do not inherit historical protocol debt.

---

## Prime Tranche (Capital Protected Vault)

The Prime Tranche serves as the robust backbone of the exchange's liquidity reserves, functioning similarly to a structured DeFi bond.

*   **Stable Value Growth:** Engineered for institutions and capital allocators prioritizing steady asset appreciation over aggressive yield optimization.
*   **60% Protection Floor:** When traders realize profits, Prime LPs share the payout liability proportionally with Alpha LPs. However, the smart contract enforces a hardcoded guarantee that **at least 60% of Prime assets are mathematically protected** (`primeProtectionBps = 6000`).
*   **Circuit Breaker (40% Drawdown):** If cumulative historical losses borne by the Prime Tranche reach **40% of its historical total deposits**, the protocol automatically halts trading operations to preserve the remaining capital.
*   **Weighted Average Lockup:** To prevent arbitrary resets of the 5-day lockup period when making subsequent deposits, the system employs a weighted average calculation for deposit timestamps. This ensures large principal amounts are not disproportionately penalized by small additional deposits.

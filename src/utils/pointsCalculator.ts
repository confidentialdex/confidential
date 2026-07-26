/**
 * ArcTrade Points Calculator Utilities
 * Handles all mathematical models for Streaming Vault Points, Trading Duration Multipliers, and Referral Boosts.
 */

export interface VaultHolding {
  amountUsd: number
  isDegen: boolean
  depositTimestampMs: number
}

export interface TradeRecordInput {
  sizeUsd: number
  openedAtMs: number
  closedAtMs: number
}

/**
 * Returns the Loyalty Multiplier based on holding duration without withdrawal.
 * 3 Tiers: Silver (Base, <12h), Gold (12-24h), Diamond (>=24h).
 */
export function getLoyaltyMultiplier(holdingDays: number): number {
  if (holdingDays >= 1.0) return 4.0   // >= 24 hours (Diamond)
  if (holdingDays >= 0.5) return 2.5   // >= 12 hours (Gold)
  return 1.0                           // < 12 hours (Silver)
}

/**
 * Returns the Duration Multiplier for closed trades based on how long the position was open.
 * Rewards long-term risk holders vs instant scalpers. Max boost at 1 day (24 hours).
 */
export function getDurationMultiplier(holdingSeconds: number): number {
  if (holdingSeconds >= 86400) return 5.0 // >= 24 hours (1 day) (Max)
  if (holdingSeconds >= 21600) return 2.5 // >= 6 hours
  if (holdingSeconds >= 3600) return 1.0  // >= 1 hour (Base)
  if (holdingSeconds >= 300) return 0.5   // >= 5 mins
  return 0.1                              // < 5 mins (Anti-wash trading)
}

/**
 * Returns the permanent velocity boost based on the number of active referrals.
 * 3 Tiers: Silver (+5%), Gold (+20%), Diamond (+40%).
 */
export function getReferralBoostMultiplier(activeReferralsCount: number): { multiplier: number; boostPct: number; tierName: string } {
  if (activeReferralsCount >= 6) return { multiplier: 1.40, boostPct: 40, tierName: 'Diamond Networker (+40%)' }
  if (activeReferralsCount >= 3) return { multiplier: 1.20, boostPct: 20, tierName: 'Gold Networker (+20%)' }
  if (activeReferralsCount >= 1) return { multiplier: 1.05, boostPct: 5, tierName: 'Silver Networker (+5%)' }
  return { multiplier: 1.0, boostPct: 0, tierName: 'No Boost (0%)' }
}

/**
 * Calculates exact Points Velocity per day and per second for a set of active vault holdings.
 * Base rate: 1 USD staked = 1 Point/day (at 1.0x Prime and 1.0x Loyalty).
 * Degen Vault gets 1.8x multiplier due to first-loss tranche risk.
 */
export function calculateVaultVelocity(
  holdings: VaultHolding[],
  activeReferralsCount: number,
  nowMs: number = Date.now()
): { pointsPerDay: number; pointsPerSecond: number; avgLoyaltyMultiplier: number } {
  const refBoost = getReferralBoostMultiplier(activeReferralsCount).multiplier
  let totalPointsPerDay = 0
  let weightedLoyaltySum = 0
  let totalUsd = 0

  for (const h of holdings) {
    if (h.amountUsd <= 0) continue
    const holdingMs = Math.max(0, nowMs - h.depositTimestampMs)
    const holdingDays = holdingMs / (1000 * 60 * 60 * 24)
    const loyalty = getLoyaltyMultiplier(holdingDays)
    const trancheMult = h.isDegen ? 1.8 : 1.0

    const dailyPoints = h.amountUsd * trancheMult * loyalty * refBoost
    totalPointsPerDay += dailyPoints
    weightedLoyaltySum += loyalty * h.amountUsd
    totalUsd += h.amountUsd
  }

  const avgLoyaltyMultiplier = totalUsd > 0 ? weightedLoyaltySum / totalUsd : 1.0
  return {
    pointsPerDay: totalPointsPerDay,
    pointsPerSecond: totalPointsPerDay / 86400,
    avgLoyaltyMultiplier
  }
}

/**
 * Calculates total historical points earned from closed trades.
 * Base rate: 1 Point per $10 Volume (modified by duration multiplier).
 */
export function calculateHistoricalTradingPoints(trades: TradeRecordInput[]): number {
  let totalPoints = 0
  for (const t of trades) {
    if (t.sizeUsd <= 0 || t.closedAtMs <= t.openedAtMs) continue
    const holdingSeconds = (t.closedAtMs - t.openedAtMs) / 1000
    const durMult = getDurationMultiplier(holdingSeconds)
    // 1 point per $10 volume -> (sizeUsd / 10) * durationMultiplier
    totalPoints += (t.sizeUsd / 10) * durMult
  }
  return totalPoints
}

import { useState, useEffect, useRef } from 'react'
import { gql } from 'graphql-request'
import { gqlClient } from '../config/graphql'
import { formatUnits } from 'viem'
import {
  calculateVaultVelocity,
  calculateHistoricalTradingPoints,
  getLoyaltyMultiplier,
  type VaultHolding,
  type TradeRecordInput
} from '../utils/pointsCalculator'

export interface UserPointsSummary {
  totalPoints: number
  vaultPoints: number
  tradingPoints: number
  pointsPerDay: number
  pointsPerSecond: number
  avgLoyaltyMultiplier: number
  activeReferralsCount: number
  holdingDays: number
  isLoading: boolean
}

export function usePoints(userAddress?: string): UserPointsSummary {
  const [summary, setSummary] = useState<UserPointsSummary>({
    totalPoints: 0,
    vaultPoints: 0,
    tradingPoints: 0,
    pointsPerDay: 0,
    pointsPerSecond: 0,
    avgLoyaltyMultiplier: 1.0,
    activeReferralsCount: 0,
    holdingDays: 0,
    isLoading: true
  })

  // We store the static snapshot and base timestamp in ref so ticking can animate smoothly
  const snapshotRef = useRef<{
    baseVaultPoints: number
    baseTradingPoints: number
    pointsPerSecond: number
    snapshotTimestampMs: number
  }>({
    baseVaultPoints: 0,
    baseTradingPoints: 0,
    pointsPerSecond: 0,
    snapshotTimestampMs: Date.now()
  })

  // Fetch from Goldsky
  useEffect(() => {
    async function fetchPointsData() {
      if (!userAddress) {
        setSummary((prev) => ({ ...prev, isLoading: false }))
        return
      }

      try {
        const query = gql`
          query GetUserPointsData($user: Bytes!) {
            vaultDeposits(where: { user: $user }, orderBy: timestamp, orderDirection: asc) {
              action
              amount
              isDegen
              timestamp
            }
            positions(where: { trader: $user, isOpen: false }, orderBy: closedAt, orderDirection: desc) {
              sizeUsd
              openedAt
              closedAt
            }
            userPointStats(where: { user: $user }) {
              activeReferralsCount
              lastDepositTimestamp
              lastWithdrawTimestamp
            }
          }
        `

        const data: any = await gqlClient.request(query, { user: userAddress.toLowerCase() })

        const activeReferralsCount = data.userPointStats && data.userPointStats.length > 0
          ? Number(data.userPointStats[0].activeReferralsCount)
          : 0

        // 1. Reconstruct Vault active balances & holding time
        let currentPrimeUsd = 0
        let currentDegenUsd = 0
        let firstDepositMs = 0

        const holdings: VaultHolding[] = []

        if (data.vaultDeposits) {
          for (const d of data.vaultDeposits) {
            const amt = Number(formatUnits(BigInt(d.amount), 6))
            const tsMs = Number(d.timestamp) * 1000
            if (firstDepositMs === 0 && d.action === 'deposit') {
              firstDepositMs = tsMs
            }

            if (d.action === 'deposit') {
              if (d.isDegen) currentDegenUsd += amt
              else currentPrimeUsd += amt
            } else if (d.action === 'withdraw') {
              if (d.isDegen) currentDegenUsd = Math.max(0, currentDegenUsd - amt)
              else currentPrimeUsd = Math.max(0, currentPrimeUsd - amt)
              // Loyalty penalty check: on withdraw, we shift base deposit timestamp
              firstDepositMs = tsMs
            }
          }
        }

        if (currentPrimeUsd > 0) {
          holdings.push({
            amountUsd: currentPrimeUsd,
            isDegen: false,
            depositTimestampMs: firstDepositMs > 0 ? firstDepositMs : Date.now()
          })
        }
        if (currentDegenUsd > 0) {
          holdings.push({
            amountUsd: currentDegenUsd,
            isDegen: true,
            depositTimestampMs: firstDepositMs > 0 ? firstDepositMs : Date.now()
          })
        }

        const nowMs = Date.now()
        const holdingMs = firstDepositMs > 0 ? Math.max(0, nowMs - firstDepositMs) : 0
        const holdingDays = holdingMs / (1000 * 60 * 60 * 24)

        const velocity = calculateVaultVelocity(holdings, activeReferralsCount, nowMs)

        // Calculate historical accumulated vault points up to now
        let historicalVaultPoints = 0
        if (holdings.length > 0 && firstDepositMs > 0) {
          const daysHeld = (nowMs - firstDepositMs) / (1000 * 60 * 60 * 24)
          const loyalty = getLoyaltyMultiplier(daysHeld)
          const primeMult = 1.0
          const degenMult = 1.8
          historicalVaultPoints = (currentPrimeUsd * primeMult + currentDegenUsd * degenMult) * loyalty * daysHeld
        }

        // 2. Reconstruct Trading Points
        const closedTrades: TradeRecordInput[] = []
        if (data.positions) {
          for (const pos of data.positions) {
            if (pos.closedAt && Number(pos.closedAt) > 0) {
              closedTrades.push({
                sizeUsd: Number(formatUnits(BigInt(pos.sizeUsd), 6)),
                openedAtMs: Number(pos.openedAt) * 1000,
                closedAtMs: Number(pos.closedAt) * 1000
              })
            }
          }
        }

        const tradingPoints = calculateHistoricalTradingPoints(closedTrades)

        snapshotRef.current = {
          baseVaultPoints: historicalVaultPoints,
          baseTradingPoints: tradingPoints,
          pointsPerSecond: velocity.pointsPerSecond,
          snapshotTimestampMs: nowMs
        }

        setSummary({
          totalPoints: historicalVaultPoints + tradingPoints,
          vaultPoints: historicalVaultPoints,
          tradingPoints,
          pointsPerDay: velocity.pointsPerDay,
          pointsPerSecond: velocity.pointsPerSecond,
          avgLoyaltyMultiplier: velocity.avgLoyaltyMultiplier,
          activeReferralsCount,
          holdingDays,
          isLoading: false
        })
      } catch (e) {
        console.error('Points Fetch Error:', e)
        setSummary((prev) => ({ ...prev, isLoading: false }))
      }
    }

    fetchPointsData()
    const interval = setInterval(fetchPointsData, 15000) // Refresh base every 15s
    return () => clearInterval(interval)
  }, [userAddress])

  // Live sub-second ticking
  useEffect(() => {
    if (!userAddress || snapshotRef.current.pointsPerSecond <= 0) return

    const tickInterval = setInterval(() => {
      const elapsedSeconds = (Date.now() - snapshotRef.current.snapshotTimestampMs) / 1000
      const liveVaultPoints = snapshotRef.current.baseVaultPoints + elapsedSeconds * snapshotRef.current.pointsPerSecond
      const totalPoints = liveVaultPoints + snapshotRef.current.baseTradingPoints

      setSummary((prev) => ({
        ...prev,
        vaultPoints: liveVaultPoints,
        totalPoints
      }))
    }, 100) // 10 ticks per second

    return () => clearInterval(tickInterval)
  }, [userAddress, summary.pointsPerSecond])

  return summary
}

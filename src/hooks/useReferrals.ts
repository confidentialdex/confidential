import { useState, useEffect } from 'react'
import { getReferralBoostMultiplier } from '../utils/pointsCalculator'

export interface ReferralFriend {
  address: string
  joinedAtMs: number
  isActive: boolean
  pointsEarned: number
}

export interface ReferralsSummary {
  referrerCode: string | null
  myReferralLink: string
  activeReferralsCount: number
  totalReferralsCount: number
  boostPct: number
  tierName: string
  friends: ReferralFriend[]
  isLoading: boolean
}

const STORAGE_KEY_REFERRER = 'arc_referrer_code'
const STORAGE_KEY_MY_FRIENDS = 'arc_my_referred_friends'

export function useReferrals(userAddress?: string): ReferralsSummary {
  const [summary, setSummary] = useState<ReferralsSummary>({
    referrerCode: null,
    myReferralLink: '',
    activeReferralsCount: 0,
    totalReferralsCount: 0,
    boostPct: 0,
    tierName: 'No Boost (0%)',
    friends: [],
    isLoading: true
  })

  // 1. Detect ?ref= in URL parameter and store in localStorage
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const refParam = params.get('ref')
      if (refParam && refParam.length >= 3) {
        localStorage.setItem(STORAGE_KEY_REFERRER, refParam)
      }
    } catch (e) {
      console.error('Referral URL parse error:', e)
    }
  }, [])

  // 2. Load referral stats and simulated / live friends
  useEffect(() => {
    function loadReferrals() {
      const savedReferrer = localStorage.getItem(STORAGE_KEY_REFERRER)
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://confidential.trade'
      const myLink = userAddress ? `${origin}/?ref=${userAddress}` : `${origin}/?ref=CONNECT_WALLET`

      // Try loading friends from localStorage (or backend/subgraph in production)
      let friends: ReferralFriend[] = []
      try {
        const stored = localStorage.getItem(`${STORAGE_KEY_MY_FRIENDS}_${userAddress || 'guest'}`)
        if (stored) {
          friends = JSON.parse(stored)
        } else if (userAddress) {
          // Provide demo active/inactive friends so user can preview and test tiers if no friends saved yet
          friends = [
            {
              address: '0x7a25...44d1',
              joinedAtMs: Date.now() - 15 * 86400 * 1000,
              isActive: true,
              pointsEarned: 14250
            },
            {
              address: '0x3f12...99a0',
              joinedAtMs: Date.now() - 8 * 86400 * 1000,
              isActive: true,
              pointsEarned: 8900
            },
            {
              address: '0x8b01...22c3',
              joinedAtMs: Date.now() - 3 * 86400 * 1000,
              isActive: false,
              pointsEarned: 120
            }
          ]
          localStorage.setItem(`${STORAGE_KEY_MY_FRIENDS}_${userAddress}`, JSON.stringify(friends))
        }
      } catch (e) {
        console.error('Referral friends load error:', e)
      }

      const activeCount = friends.filter((f) => f.isActive).length
      const boostInfo = getReferralBoostMultiplier(activeCount)

      setSummary({
        referrerCode: savedReferrer,
        myReferralLink: myLink,
        activeReferralsCount: activeCount,
        totalReferralsCount: friends.length,
        boostPct: boostInfo.boostPct,
        tierName: boostInfo.tierName,
        friends,
        isLoading: false
      })
    }

    loadReferrals()
  }, [userAddress])

  return summary
}

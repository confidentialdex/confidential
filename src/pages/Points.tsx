import { Link } from 'react-router-dom'
import { useArcWallet } from '../hooks/useArcWallet'
import { usePoints } from '../hooks/usePoints'
import { useReferrals } from '../hooks/useReferrals'
import { TierBadgeIcon } from '../components/TierBadgeIcon'

export default function Points() {
  const { isConnected, address } = useArcWallet()
  const pointsSummary = usePoints(address)
  const referralsSummary = useReferrals(address)

  // Determine loyalty tier index (0 to 2)
  const days = pointsSummary.holdingDays
  let currentTierIndex = 0
  if (days >= 1.0) currentTierIndex = 2
  else if (days >= 0.5) currentTierIndex = 1

  const tiers = [
    { label: 'Silver LP (< 12h)', mult: '1.0x', reqDays: 0 },
    { label: 'Gold LP (12-24h)', mult: '2.5x', reqDays: 0.5 },
    { label: 'Diamond LP (>= 24h)', mult: '4.0x', reqDays: 1.0 }
  ]

  return (
    <div className="points-page" style={{ minHeight: '100vh', background: 'var(--color-bg0)', color: 'var(--color-text1)', padding: '40px 24px', fontFamily: "var(--font-ui)" }}>
      <style>{`
        .points-header {
          max-width: 1200px;
          margin: 0 auto 40px;
          text-align: center;
        }
        .points-badge {
          display: inline-block;
          background: var(--color-green-dim);
          border: 1px solid rgba(46, 189, 133, 0.3);
          color: var(--color-accent);
          padding: 6px 16px;
          border-radius: var(--radius-full);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.5px;
          margin-bottom: 16px;
          text-transform: uppercase;
        }
        .points-ticker-box {
          max-width: 800px;
          margin: 0 auto 40px;
          background: var(--color-bg2);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-2xl);
          padding: 40px 24px;
          text-align: center;
          position: relative;
          overflow: hidden;
          box-shadow: var(--shadow-card);
        }
        .points-ticker-box::before {
          content: '';
          position: absolute;
          top: -50%;
          left: 50%;
          transform: translateX(-50%);
          width: 400px;
          height: 200px;
          background: var(--color-accent);
          filter: blur(120px);
          opacity: 0.08;
          pointer-events: none;
        }
        .ticker-number {
          font-family: var(--font-mono);
          font-size: clamp(36px, 6vw, 64px);
          font-weight: 700;
          color: var(--color-accent);
          margin: 12px 0;
        }
        .stats-grid {
          max-width: 1200px;
          margin: 0 auto 40px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
        }
        .stat-card {
          background: var(--color-bg2);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-shadow: var(--shadow-card);
        }
        .stat-label {
          font-size: 13px;
          color: var(--color-text2);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }
        .stat-val {
          font-family: var(--font-mono);
          font-size: 24px;
          font-weight: 700;
          color: var(--color-text1);
        }
        .escalator-section {
          max-width: 1200px;
          margin: 0 auto 40px;
          background: var(--color-bg2);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-2xl);
          padding: 32px;
          box-shadow: var(--shadow-card);
        }
        .tiers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin-top: 24px;
        }
        .tier-card {
          border-radius: var(--radius-lg);
          padding: 20px;
          border: 1px solid var(--color-border);
          background: var(--color-bg3);
          transition: all 0.3s;
        }
        .tier-card.active {
          border-color: var(--color-accent);
          background: var(--color-green-dim);
        }
        .quests-section {
          max-width: 1200px;
          margin: 0 auto;
        }
        .quests-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-top: 24px;
        }
        .quest-card {
          background: var(--color-bg2);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: 28px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: transform 0.2s, border-color 0.2s;
          box-shadow: var(--shadow-card);
        }
        .quest-card:hover {
          transform: translateY(-4px);
          border-color: var(--color-accent);
        }
      `}</style>

      <div className="points-header">
        <span className="points-badge">Season 1 Genesis Pool • 100,000,000 Pts</span>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 600, margin: '0 0 12px', color: 'var(--color-text1)' }}>
          Real-Time Streaming Points
        </h1>
        <p style={{ color: 'var(--color-text2)', fontSize: 16, maxWidth: 640, margin: '0 auto' }}>
          Earn continuous points every second when you provide liquidity or trade on ArcTrade. Hold without withdrawing to unlock up to 4.0x loyalty speed.
        </p>
      </div>

      {/* Main Live Ticker */}
      <div className="points-ticker-box">
        <div style={{ fontSize: 14, color: 'var(--color-text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
          Your Total Points Balance
        </div>
        <div className="ticker-number">
          {isConnected ? pointsSummary.totalPoints.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : '0.0000'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap', marginTop: 16 }}>
          <div style={{ fontSize: 14, color: 'var(--color-accent)', fontWeight: 600 }}>
            Velocity: +{pointsSummary.pointsPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Pts/Day
          </div>
          <div style={{ fontSize: 14, color: 'var(--color-text2)' }}>
            Loyalty Rate: <strong style={{ color: 'var(--color-text1)' }}>{pointsSummary.avgLoyaltyMultiplier.toFixed(1)}x</strong>
          </div>
          <div style={{ fontSize: 14, color: 'var(--color-text2)' }}>
            Referral Boost: <strong style={{ color: 'var(--color-accent)' }}>+{referralsSummary.boostPct}%</strong>
          </div>
        </div>
      </div>

      {/* Stats Breakdown */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Vault Staking Points</span>
          <span className="stat-val">{pointsSummary.vaultPoints.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          <span style={{ fontSize: 12, color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>+{pointsSummary.pointsPerSecond.toFixed(4)} Pts/sec</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Trading Points</span>
          <span className="stat-val">{pointsSummary.tradingPoints.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          <span style={{ fontSize: 12, color: 'var(--color-text2)' }}>Volume x Duration weighted</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Staked Duration without Withdraw</span>
          <span className="stat-val">{pointsSummary.holdingDays >= 1 ? `${pointsSummary.holdingDays.toFixed(1)} Days` : `${(pointsSummary.holdingDays * 24).toFixed(1)} Hours`}</span>
          <span style={{ fontSize: 12, color: 'var(--color-accent)' }}>
            {currentTierIndex === 2 ? 'Max Diamond Rate Achieved' : `Next Tier in ${(Math.max(0, tiers[Math.min(2, currentTierIndex + 1)].reqDays - pointsSummary.holdingDays) * 24).toFixed(1)} hours`}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active Referrals</span>
          <span className="stat-val">{referralsSummary.activeReferralsCount} Friends</span>
          <span style={{ fontSize: 12, color: 'var(--color-accent)' }}>{referralsSummary.tierName}</span>
        </div>
      </div>

      {/* Loyalty Escalator Section */}
      <div className="escalator-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px', color: 'var(--color-text1)' }}>Loyalty Escalator Curve</h2>
            <p style={{ color: 'var(--color-text2)', fontSize: 14, margin: 0 }}>
              The longer you keep USDC in the Vaults without withdrawing, the faster your points stream.
            </p>
          </div>
          <div style={{ background: 'var(--color-red-dim)', border: '1px solid rgba(246, 70, 93, 0.3)', padding: '8px 16px', borderRadius: 'var(--radius-md)', color: 'var(--color-red)', fontSize: 12, fontWeight: 600 }}>
            Any withdrawal resets your loyalty multiplier back to 1.0x
          </div>
        </div>

        <div className="tiers-grid">
          {tiers.map((tier, idx) => {
            const isActive = currentTierIndex === idx
            return (
              <div key={tier.label} className={`tier-card ${isActive ? 'active' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: isActive ? 'var(--color-accent)' : 'var(--color-text2)', fontWeight: 600 }}>
                    <TierBadgeIcon tier={idx === 2 ? 'Diamond' : idx === 1 ? 'Gold' : 'Silver'} style={{ marginRight: '6px' }} />
                    {tier.label}
                  </span>
                  {isActive && <span style={{ background: 'var(--color-accent)', color: 'var(--color-bg0)', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>CURRENT</span>}
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--color-text1)', fontFamily: "var(--font-mono)" }}>
                  {tier.mult}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text2)', marginTop: 8 }}>
                  {idx === 0 ? 'Base earning velocity' : idx === 2 ? 'Maximum Diamond velocity rate (> 24 hours)' : `Unlocked after ${tier.reqDays * 24} continuous hours`}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quests Section */}
      <div className="quests-section">
        <h2 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 6px', color: 'var(--color-text1)' }}>How to Earn More Points</h2>
        <p style={{ color: 'var(--color-text2)', fontSize: 14, margin: 0 }}>
          Maximize your Season 1 points allocation across our core protocol pillars.
        </p>

        <div className="quests-grid">
          <div className="quest-card">
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px', color: 'var(--color-text1)' }}>Provide Degen Vault Liquidity</h3>
              <p style={{ color: 'var(--color-text2)', fontSize: 14, lineHeight: 1.6 }}>
                Deposit USDC into the Degen Vault to act as counterparty to traders. Earn <strong>1.8x base velocity</strong> plus up to 4.0x loyalty multiplier.
              </p>
            </div>
            <Link to="/vaults" style={{ marginTop: 24, display: 'inline-block', textAlign: 'center', background: 'var(--color-accent)', color: 'var(--color-bg0)', padding: '12px 20px', borderRadius: 'var(--radius-lg)', fontWeight: 600, textDecoration: 'none' }}>
              Deposit in Vaults
            </Link>
          </div>

          <div className="quest-card">
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px', color: 'var(--color-text1)' }}>Trade with Long Duration</h3>
              <p style={{ color: 'var(--color-text2)', fontSize: 14, lineHeight: 1.6 }}>
                Hold your positions through market movements. Positions held over <strong>24 hours (1 day) receive a 5.0x duration multiplier</strong> on their volume points.
              </p>
            </div>
            <Link to="/trade" style={{ marginTop: 24, display: 'inline-block', textAlign: 'center', background: 'var(--color-bg3)', color: 'var(--color-text1)', border: '1px solid var(--color-border)', padding: '12px 20px', borderRadius: 'var(--radius-lg)', fontWeight: 600, textDecoration: 'none' }}>
              Start Trading
            </Link>
          </div>

          <div className="quest-card">
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px', color: 'var(--color-text1)' }}>Invite Active Traders</h3>
              <p style={{ color: 'var(--color-text2)', fontSize: 14, lineHeight: 1.6 }}>
                Share your referral link. Each active friend unlocks up to a <strong>+40% permanent boost</strong> to your entire points velocity.
              </p>
            </div>
            <Link to="/referrals" style={{ marginTop: 24, display: 'inline-block', textAlign: 'center', background: 'var(--color-bg3)', color: 'var(--color-text1)', border: '1px solid var(--color-border)', padding: '12px 20px', borderRadius: 'var(--radius-lg)', fontWeight: 600, textDecoration: 'none' }}>
              Get Referral Link
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

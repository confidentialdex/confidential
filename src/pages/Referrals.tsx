import { useState } from 'react'
import { useArcWallet } from '../hooks/useArcWallet'
import { useReferrals } from '../hooks/useReferrals'
import { TierBadgeIcon } from '../components/TierBadgeIcon'

export default function Referrals() {
  const { isConnected, address } = useArcWallet()
  const { myReferralLink, activeReferralsCount, totalReferralsCount, boostPct, tierName, friends } = useReferrals(address)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(myReferralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const tiers = [
    { name: 'Silver Networker', req: 1, boost: '+5%', desc: '1-2 Active Friends' },
    { name: 'Gold Networker', req: 3, boost: '+20%', desc: '3-5 Active Friends' },
    { name: 'Diamond Networker', req: 6, boost: '+40%', desc: '>= 6 Active Friends' }
  ]

  return (
    <div className="referrals-page" style={{ minHeight: '100vh', background: 'var(--color-bg0)', color: 'var(--color-text1)', padding: '40px 24px', fontFamily: "var(--font-ui)" }}>
      <style>{`
        .ref-header {
          max-width: 1200px;
          margin: 0 auto 40px;
          text-align: center;
        }
        .ref-box {
          max-width: 800px;
          margin: 0 auto 40px;
          background: var(--color-bg2);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-2xl);
          padding: 36px 28px;
          box-shadow: var(--shadow-card);
        }
        .link-input-group {
          display: flex;
          gap: 12px;
          margin: 20px 0;
          background: var(--color-bg0);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 8px;
          align-items: center;
        }
        .link-input {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--color-text1);
          font-family: var(--font-mono);
          font-size: 15px;
          padding: 8px 12px;
          outline: none;
        }
        .copy-btn {
          background: var(--color-accent);
          color: var(--color-bg0);
          border: none;
          padding: 12px 24px;
          border-radius: var(--radius-md);
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s, background 0.2s;
          white-space: nowrap;
        }
        .copy-btn:hover {
          background: var(--color-accent-hover);
          transform: scale(1.02);
        }
        .tiers-section {
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
          background: var(--color-bg3);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 20px;
          transition: all 0.3s;
        }
        .tier-card.active {
          border-color: var(--color-accent);
          background: var(--color-green-dim);
        }
        .table-section {
          max-width: 1200px;
          margin: 0 auto;
          background: var(--color-bg2);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-2xl);
          padding: 32px;
          box-shadow: var(--shadow-card);
        }
        .ref-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        .ref-table th {
          text-align: left;
          padding: 16px;
          font-size: 13px;
          color: var(--color-text2);
          text-transform: uppercase;
          border-bottom: 1px solid var(--color-border);
        }
        .ref-table td {
          padding: 16px;
          border-bottom: 1px solid var(--color-border);
          font-size: 15px;
        }
      `}</style>

      <div className="ref-header">
        <span style={{ background: 'var(--color-green-dim)', border: '1px solid rgba(46, 189, 133, 0.3)', color: 'var(--color-accent)', padding: '6px 16px', borderRadius: 'var(--radius-full)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>
          Network Velocity Multiplier
        </span>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 600, margin: '16px 0 12px', color: 'var(--color-text1)' }}>
          Refer Friends, Boost Velocity
        </h1>
        <p style={{ color: 'var(--color-text2)', fontSize: 16, maxWidth: 640, margin: '0 auto' }}>
          Every active friend you invite permanent boosts your points earning speed across both Vault staking and trading by up to +40%.
        </p>
      </div>

      <div className="ref-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: 'var(--color-text1)' }}>Your Personal Referral Link</h3>
            <p style={{ color: 'var(--color-text2)', fontSize: 14, margin: '4px 0 0' }}>Share with friends to track activity automatically</p>
          </div>
          <div style={{ background: 'var(--color-green-dim)', color: 'var(--color-accent)', padding: '6px 14px', borderRadius: 'var(--radius-full)', fontWeight: 600, fontSize: 13 }}>
            Current Boost: +{boostPct}% • {tierName}
          </div>
        </div>

        <div className="link-input-group">
          <input
            type="text"
            readOnly
            value={isConnected ? myReferralLink : 'Please connect wallet to generate unique referral link'}
            className="link-input"
          />
          <button className="copy-btn" onClick={handleCopy} disabled={!isConnected}>
            {copied ? 'Copied' : 'Copy Link'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--color-border)', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-text2)' }}>Active Referrals</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-accent)', fontFamily: "var(--font-mono)" }}>
              {activeReferralsCount} <span style={{ fontSize: 14, color: 'var(--color-text2)', fontWeight: 400 }}>/ {totalReferralsCount} Total</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-text2)' }}>Active Status Requirement</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text1)' }}>
              &gt; $100 Vault TVL or &gt; $1K Volume
            </div>
          </div>
        </div>
      </div>

      <div className="tiers-section">
        <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px', color: 'var(--color-text1)' }}>Velocity Boost Tiers</h2>
        <p style={{ color: 'var(--color-text2)', fontSize: 14, margin: 0 }}>
          Your boost is determined by the number of active referrals currently holding or trading on ArcTrade.
        </p>

        <div className="tiers-grid">
          {tiers.map((tier) => {
            const isReached = activeReferralsCount >= tier.req
            return (
              <div key={tier.name} className={`tier-card ${isReached ? 'active' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 14, color: isReached ? 'var(--color-accent)' : 'var(--color-text2)', fontWeight: 600 }}>
                    <TierBadgeIcon tier={tier.name} style={{ marginRight: '6px' }} />
                    {tier.name}
                  </span>
                  {isReached && <span style={{ background: 'var(--color-accent)', color: 'var(--color-bg0)', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>ACTIVE</span>}
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--color-text1)', fontFamily: "var(--font-mono)" }}>
                  {tier.boost}
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text2)', marginTop: 8 }}>
                  {tier.desc}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="table-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px', color: 'var(--color-text1)' }}>Your Referred Friends</h2>
            <p style={{ color: 'var(--color-text2)', fontSize: 14, margin: 0 }}>
              Real-time breakdown of friends who signed up with your referral code.
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="ref-table">
            <thead>
              <tr>
                <th>Friend Address</th>
                <th>Joined Date</th>
                <th>Status</th>
                <th>Points Generated</th>
              </tr>
            </thead>
            <tbody>
              {friends.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text2)' }}>
                    No friends referred yet. Copy your link above and start building your network.
                  </td>
                </tr>
              ) : (
                friends.map((friend, idx) => (
                  <tr key={friend.address + idx}>
                    <td style={{ fontFamily: "var(--font-mono)", color: 'var(--color-text1)', fontWeight: 600 }}>{friend.address}</td>
                    <td style={{ color: 'var(--color-text2)' }}>{new Date(friend.joinedAtMs).toLocaleDateString()}</td>
                    <td>
                      {friend.isActive ? (
                        <span style={{ background: 'var(--color-green-dim)', color: 'var(--color-accent)', padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600 }}>
                          ACTIVE
                        </span>
                      ) : (
                        <span style={{ background: 'var(--color-bg3)', color: 'var(--color-text2)', padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600 }}>
                          INACTIVE
                        </span>
                      )}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", color: 'var(--color-text1)', fontWeight: 600 }}>
                      {friend.pointsEarned.toLocaleString()} Pts
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

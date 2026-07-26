import { useState, useEffect } from 'react'
import { useArcWallet } from '../hooks/useArcWallet'
import { usePoints } from '../hooks/usePoints'
import { TierBadgeIcon } from '../components/TierBadgeIcon'

export interface LeaderboardEntry {
  rank: number
  address: string
  tierBadge: string
  dailyVelocity: number
  totalPoints: number
  isMe?: boolean
}

export default function Leaderboard() {
  const { isConnected, address } = useArcWallet()
  const myPoints = usePoints(address)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'season1' | 'alltime'>('season1')

  // Generate realistic leaderboard entries mingled with connected user if active
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    const baseEntries: LeaderboardEntry[] = [
      {
        rank: 1,
        address: '0x9941...8c1f',
        tierBadge: 'Diamond',
        dailyVelocity: 4250.8,
        totalPoints: 312450.4
      },
      {
        rank: 2,
        address: '0x32a0...71d4',
        tierBadge: 'Diamond',
        dailyVelocity: 3810.2,
        totalPoints: 284100.0
      },
      {
        rank: 3,
        address: '0x71b2...009a',
        tierBadge: 'Gold',
        dailyVelocity: 2950.5,
        totalPoints: 219800.5
      },
      {
        rank: 4,
        address: '0x44c1...55e2',
        tierBadge: 'Gold',
        dailyVelocity: 2100.0,
        totalPoints: 165400.2
      },
      {
        rank: 5,
        address: '0x18d3...99f0',
        tierBadge: 'Gold',
        dailyVelocity: 1840.4,
        totalPoints: 142100.8
      },
      {
        rank: 6,
        address: '0x55e0...12b9',
        tierBadge: 'Silver',
        dailyVelocity: 1420.0,
        totalPoints: 118900.0
      },
      {
        rank: 7,
        address: '0x88f2...33a1',
        tierBadge: 'Silver',
        dailyVelocity: 1150.5,
        totalPoints: 94200.3
      },
      {
        rank: 8,
        address: '0x22a9...66c8',
        tierBadge: 'Silver',
        dailyVelocity: 980.2,
        totalPoints: 81050.0
      },
      {
        rank: 9,
        address: '0x66c4...88d0',
        tierBadge: 'Silver',
        dailyVelocity: 740.0,
        totalPoints: 64200.5
      },
      {
        rank: 10,
        address: '0x01f8...44b2',
        tierBadge: 'Silver',
        dailyVelocity: 520.0,
        totalPoints: 48900.0
      }
    ]

    if (isConnected && address && myPoints.totalPoints > 0) {
      const myFormattedAddr = `${address.slice(0, 6)}...${address.slice(-4)}`
      // Check if user is already in top entries or insert/update
      const existingIdx = baseEntries.findIndex((e) => e.address.toLowerCase() === myFormattedAddr.toLowerCase() || e.isMe)
      const userBadge = myPoints.totalPoints >= 200000 ? 'Diamond' : myPoints.totalPoints >= 100000 ? 'Gold' : 'Silver'
      
      if (existingIdx >= 0) {
        baseEntries[existingIdx].totalPoints = Math.max(baseEntries[existingIdx].totalPoints, myPoints.totalPoints)
        baseEntries[existingIdx].dailyVelocity = Math.max(baseEntries[existingIdx].dailyVelocity, myPoints.pointsPerDay)
        baseEntries[existingIdx].tierBadge = userBadge
        baseEntries[existingIdx].isMe = true
      } else {
        baseEntries.push({
          rank: 99,
          address: myFormattedAddr,
          tierBadge: userBadge,
          dailyVelocity: myPoints.pointsPerDay,
          totalPoints: myPoints.totalPoints,
          isMe: true
        })
      }
    }

    // Sort descending by totalPoints
    const sorted = [...baseEntries].sort((a, b) => b.totalPoints - a.totalPoints)
    // Assign ranks
    const ranked = sorted.map((item, idx) => ({ ...item, rank: idx + 1 }))
    setEntries(ranked)
  }, [isConnected, address, myPoints.totalPoints, myPoints.pointsPerDay])

  const filtered = entries.filter((e) =>
    e.address.toLowerCase().includes(searchTerm.toLowerCase()) || (e.isMe && 'you me'.includes(searchTerm.toLowerCase()))
  )

  const topThree = entries.slice(0, 3)
  const myEntry = entries.find((e) => e.isMe)

  return (
    <div className="leaderboard-page" style={{ minHeight: '100vh', background: 'var(--color-bg0)', color: 'var(--color-text1)', padding: '40px 24px', fontFamily: "var(--font-ui)" }}>
      <style>{`
        .lb-header {
          max-width: 1200px;
          margin: 0 auto 40px;
          text-align: center;
        }
        .podium-grid {
          max-width: 1000px;
          margin: 0 auto 48px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          align-items: flex-end;
        }
        .podium-card {
          background: var(--color-bg2);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-2xl);
          padding: 28px 24px;
          text-align: center;
          position: relative;
          transition: transform 0.2s;
        }
        .podium-card.rank-1 {
          border-color: var(--color-accent);
          background: var(--color-green-dim);
          transform: scale(1.04);
        }
        .podium-card.rank-2 {
          border-color: var(--color-border);
        }
        .podium-card.rank-3 {
          border-color: var(--color-border);
        }
        .controls-bar {
          max-width: 1200px;
          margin: 0 auto 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }
        .search-input {
          background: var(--color-bg2);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 10px 16px;
          color: var(--color-text1);
          font-size: 14px;
          outline: none;
          width: 280px;
          font-family: var(--font-ui);
        }
        .tab-btn {
          background: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-text2);
          padding: 8px 18px;
          border-radius: var(--radius-lg);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .tab-btn.active {
          background: var(--color-green-dim);
          border-color: var(--color-accent);
          color: var(--color-accent);
        }
        .table-container {
          max-width: 1200px;
          margin: 0 auto;
          background: var(--color-bg2);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-2xl);
          overflow: hidden;
          box-shadow: var(--shadow-card);
        }
        .lb-table {
          width: 100%;
          border-collapse: collapse;
        }
        .lb-table th {
          text-align: left;
          padding: 16px 20px;
          font-size: 13px;
          color: var(--color-text2);
          text-transform: uppercase;
          border-bottom: 1px solid var(--color-border);
          background: var(--color-bg3);
        }
        .lb-table td {
          padding: 18px 20px;
          border-bottom: 1px solid var(--color-border);
          font-size: 15px;
        }
        .lb-table tr:hover {
          background: var(--color-bg1);
        }
        .lb-table tr.my-row {
          background: var(--color-green-dim);
        }
      `}</style>

      <div className="lb-header">
        <span style={{ background: 'var(--color-green-dim)', border: '1px solid rgba(46, 189, 133, 0.3)', color: 'var(--color-accent)', padding: '6px 16px', borderRadius: 'var(--radius-full)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>
          Season 1 Genesis Competition
        </span>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 600, margin: '16px 0 12px', color: 'var(--color-text1)' }}>
          ArcTrade Leaderboard
        </h1>
        <p style={{ color: 'var(--color-text2)', fontSize: 16, maxWidth: 640, margin: '0 auto' }}>
          Top liquidity providers and traders ranked by streaming points velocity. Season 1 pool distribution occurs at the end of the season.
        </p>
      </div>

      {/* Podium Cards */}
      <div className="podium-grid">
        {topThree.map((item) => (
          <div key={item.rank} className={`podium-card rank-${item.rank}`}>
            <div style={{ fontSize: 12, fontWeight: 800, color: item.rank === 1 ? 'var(--color-accent)' : 'var(--color-text2)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Rank #{item.rank}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 600, color: 'var(--color-text1)', margin: '8px 0' }}>
              {item.address} {item.isMe && '(You)'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text2)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <TierBadgeIcon tier={item.tierBadge} />
              {item.tierBadge}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: item.rank === 1 ? 'var(--color-accent)' : 'var(--color-text1)', fontFamily: "var(--font-mono)" }}>
              {item.totalPoints.toLocaleString(undefined, { maximumFractionDigits: 1 })} Pts
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text2)', marginTop: 4 }}>
              +{item.dailyVelocity.toLocaleString()} / day
            </div>
          </div>
        ))}
      </div>

      {/* Controls Bar */}
      <div className="controls-bar">
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className={`tab-btn ${activeTab === 'season1' ? 'active' : ''}`}
            onClick={() => setActiveTab('season1')}
          >
            Season 1 (Live)
          </button>
          <button
            className={`tab-btn ${activeTab === 'alltime' ? 'active' : ''}`}
            onClick={() => setActiveTab('alltime')}
          >
            All-Time Hall of Fame
          </button>
        </div>

        <input
          type="text"
          placeholder="Search address or 'You'..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Ranked Table */}
      <div className="table-container">
        <table className="lb-table">
          <thead>
            <tr>
              <th style={{ width: 80 }}>Rank</th>
              <th>Trader / LP Address</th>
              <th>Tier Badge</th>
              <th>Daily Velocity</th>
              <th>Total Points</th>
              <th>Share of Pool</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text2)' }}>
                  No entries matching "{searchTerm}" found.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const poolShare = (item.totalPoints / 100_000_000) * 100
                return (
                  <tr key={item.address + item.rank} className={item.isMe ? 'my-row' : ''}>
                    <td style={{ fontWeight: 700, color: item.rank <= 3 ? 'var(--color-accent)' : 'var(--color-text2)' }}>
                      #{item.rank}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", color: item.isMe ? 'var(--color-accent)' : 'var(--color-text1)', fontWeight: 600 }}>
                      {item.address} {item.isMe && <span style={{ fontSize: 11, background: 'var(--color-accent)', color: 'var(--color-bg0)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', marginLeft: 8 }}>YOU</span>}
                    </td>
                    <td>
                      <span style={{ fontSize: 13, background: 'var(--color-bg3)', padding: '4px 10px', borderRadius: 'var(--radius-md)', color: 'var(--color-text2)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <TierBadgeIcon tier={item.tierBadge} />
                        {item.tierBadge}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-accent)', fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                      +{item.dailyVelocity.toLocaleString(undefined, { maximumFractionDigits: 1 })} Pts/d
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--color-text1)', fontFamily: "var(--font-mono)", fontSize: 16 }}>
                      {item.totalPoints.toLocaleString(undefined, { maximumFractionDigits: 1 })} Pts
                    </td>
                    <td style={{ color: 'var(--color-text2)', fontWeight: 600 }}>
                      {poolShare < 0.001 ? '< 0.001%' : `${poolShare.toFixed(3)}%`}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {myEntry && (
        <div style={{ maxWidth: 1200, margin: '20px auto 0', background: 'var(--color-green-dim)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-xl)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--color-text2)' }}>Your Current Standing</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text1)' }}>
                Rank #{myEntry.rank} • {myEntry.totalPoints.toLocaleString(undefined, { maximumFractionDigits: 2 })} Points
              </div>
            </div>
          </div>
          <div style={{ fontSize: 14, color: 'var(--color-accent)', fontWeight: 600 }}>
            Streaming +{myEntry.dailyVelocity.toFixed(2)} Points / Day
          </div>
        </div>
      )}
    </div>
  )
}

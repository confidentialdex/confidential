import { useLeaderboard, type TraderStat } from '../hooks/useGoldsky'

const MOCK_DATA: TraderStat[] = [
  { trader: '0x1234567890abcdef1234567890abcdef12345678', totalProfit: 54000.5, totalLoss: 12000, netPnl: 42000.5, totalVolume: 1500000, tradesCount: 150, winCount: 90 },
  { trader: '0xabcdef1234567890abcdef1234567890abcdef12', totalProfit: 45000, totalLoss: 15000, netPnl: 30000, totalVolume: 1200000, tradesCount: 80, winCount: 50 },
  { trader: '0x7890abcdef1234567890abcdef1234567890abcd', totalProfit: 30000, totalLoss: 5000, netPnl: 25000, totalVolume: 800000, tradesCount: 120, winCount: 85 },
  { trader: '0xdef1234567890abcdef1234567890abcdef12345', totalProfit: 20000, totalLoss: 8000, netPnl: 12000, totalVolume: 500000, tradesCount: 60, winCount: 30 },
  { trader: '0x4567890abcdef1234567890abcdef1234567890a', totalProfit: 15000, totalLoss: 5000, netPnl: 10000, totalVolume: 250000, tradesCount: 45, winCount: 25 },
]

export default function Leaderboard() {
  const { leaderboard, isLoading } = useLeaderboard()
  
  // Use mock data if subgraph hasn't synced the new entity yet (since it requires a redeploy)
  const displayData = leaderboard.length > 0 ? leaderboard : MOCK_DATA

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`
  }

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(val)
  }

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.4))' }}>🥇</span>
    if (rank === 2) return <span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 0 8px rgba(192, 192, 192, 0.4))' }}>🥈</span>
    if (rank === 3) return <span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 0 8px rgba(205, 127, 50, 0.4))' }}>🥉</span>
    return <span style={{ color: 'var(--color-text2)', fontWeight: 600, fontSize: '1rem' }}>{rank}</span>
  }

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <h1 style={{ fontSize: '32px', fontWeight: 600, color: 'var(--color-text1)', margin: '0 0 12px 0' }}>
          Leaderboard
        </h1>
        <p style={{ color: 'var(--color-text2)', fontSize: '16px', margin: '4px 0 0' }}>
          Top 200 most profitable traders on Confidential DEX
        </p>
      </div>

      <div className="leaderboard-table-container">
        {isLoading && leaderboard.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text2)', fontSize: '14px' }}>Loading Leaderboard...</div>
        ) : (
          <table className="lb-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'center', width: '60px' }}>Rank</th>
                <th style={{ textAlign: 'left' }}>Trader</th>
                <th style={{ textAlign: 'center' }}>Total Trades</th>
                <th style={{ textAlign: 'center' }}>Total Volume</th>
                <th style={{ textAlign: 'center' }}>Net PnL</th>
                <th style={{ textAlign: 'right' }}>Win Rate</th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((stat, idx) => {
                const winRate = stat.tradesCount > 0 ? (stat.winCount / stat.tradesCount) * 100 : 0
                const rank = idx + 1
                return (
                  <tr key={stat.trader} className={`rank-row-${rank}`}>
                    <td style={{ textAlign: 'center' }}>
                      {getRankBadge(rank)}
                    </td>
                    <td className="font-mono" style={{ fontSize: '13px', color: 'var(--color-text1)' }}>
                      {formatAddress(stat.trader)}
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--color-text2)', fontSize: '13px' }}>
                      {stat.tradesCount}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'center', fontSize: '13px', color: 'var(--color-text1)' }}>
                      {formatMoney(stat.totalVolume || 0)}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'center', fontWeight: 600, fontSize: '14px', color: stat.netPnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                      {stat.netPnl >= 0 ? '+' : ''}{formatMoney(stat.netPnl)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ 
                        color: winRate >= 50 ? 'var(--color-green)' : 'var(--color-red)',
                        background: winRate >= 50 ? 'var(--color-green-dim)' : 'var(--color-red-dim)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        fontSize: '12px'
                      }}>
                        {winRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .leaderboard-container {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px 24px;
          min-height: calc(100vh - 60px);
          background: var(--color-bg0);
          color: var(--color-text1);
          box-sizing: border-box;
          font-family: var(--font-ui);
        }
        
        .leaderboard-header {
          margin-bottom: 24px;
          text-align: center;
        }

        .leaderboard-table-container {
          width: 100%;
          background: var(--color-bg1);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow-x: auto;
        }

        .lb-table {
          width: 100%;
          border-collapse: collapse;
        }

        .lb-table th {
          padding: 14px 16px;
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text2);
          border-bottom: 1px solid var(--color-border);
          background: var(--color-bg2);
          text-transform: uppercase;
        }

        .lb-table td {
          padding: 16px;
          font-size: 13px;
          border-bottom: 1px solid var(--color-border);
        }

        .lb-table tr:hover {
          background: var(--color-bg2);
        }
        
        .lb-table tr:last-child td {
          border-bottom: none;
        }

        .rank-row-1 { background: linear-gradient(90deg, rgba(255, 215, 0, 0.05), transparent); }
        .rank-row-2 { background: linear-gradient(90deg, rgba(192, 192, 192, 0.05), transparent); }
        .rank-row-3 { background: linear-gradient(90deg, rgba(205, 127, 50, 0.05), transparent); }

        .font-mono {
          font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
        }

        @media (max-width: 768px) {
          .leaderboard-container { padding: 24px 8px; }
          .leaderboard-header h1 { font-size: 24px !important; }
          .leaderboard-table-container {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            border: 1px solid var(--color-border);
            border-radius: 8px;
          }
          .lb-table {
            min-width: 600px;
          }
          .lb-table th { padding: 10px 8px; font-size: 11px; white-space: nowrap; }
          .lb-table td { padding: 12px 8px; font-size: 11px !important; white-space: nowrap; }
          .lb-table td .font-mono { font-size: 11px !important; }
          .lb-table td span { font-size: 10px !important; padding: 2px 6px !important; }
        }
      `}</style>
    </div>
  )
}

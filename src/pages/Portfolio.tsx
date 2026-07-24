import { useEffect, useRef, useMemo, useState } from 'react'
import { createChart, ColorType, AreaSeries } from 'lightweight-charts'
import type { IChartApi, Time } from 'lightweight-charts'
import { useTradeStore } from '../store/useTradeStore'
import { useArcWallet } from '../hooks/useArcWallet'
import { usePositions } from '../hooks/usePositions'
import { useClosedPositions, useTradeRecords } from '../hooks/useGoldsky'
import Positions from '../components/Positions'
import { keccak256, toHex } from 'viem'

export default function Portfolio({ isCompact = false }: { isCompact?: boolean }) {
  const { markets } = useTradeStore()
  const { balance, address } = useArcWallet()
  const safeAddress = address || '0x0000000000000000000000000000000000000000'
  const { positions: activePositions } = usePositions(safeAddress)
  const { closedPositions } = useClosedPositions(safeAddress)
  const { trades } = useTradeRecords(safeAddress)

  const chartRef = useRef<HTMLDivElement>(null)
  const chartApiRef = useRef<IChartApi | null>(null)

  const [chartMetric, setChartMetric] = useState('PnL')
  const [chartTimeframe, setChartTimeframe] = useState('30d')

  // Calculate Realized PnL from closed positions
  const realizedPnl = closedPositions.reduce((sum, p) => sum + (p.pnl || 0), 0)

  // Calculate Unrealized PnL from open positions (Net PnL after closing fee estimate)
  const unrealizedPnl = activePositions.reduce((sum, p) => {
    const matchedMarket = markets.find(m => keccak256(toHex(m.pair)) === p.pairId)
    const markPrice = matchedMarket ? matchedMarket.price : p.entryPrice
    const sizeBaseAsset = p.sizeUsd / p.entryPrice
    const rawPnl = matchedMarket ? (p.isLong ? (markPrice - p.entryPrice) * sizeBaseAsset : (p.entryPrice - markPrice) * sizeBaseAsset) : 0
    const closingFee = p.sizeUsd * 0.0004
    return sum + (rawPnl - closingFee)
  }, 0)

  const totalPnl = realizedPnl + unrealizedPnl

  // Stats
  const wins = closedPositions.filter(p => (p.pnl || 0) > 0).length
  const winRate = closedPositions.length ? ((wins / closedPositions.length) * 100).toFixed(1) : '0.0'
  const totalVol = trades.reduce((sum, t) => sum + t.sizeUsd, 0)
  const bestTrade = closedPositions.length ? Math.max(...closedPositions.map(p => p.pnl || 0)) : 0
  const equity = balance + activePositions.reduce((sum, p) => sum + p.collateral, 0) + unrealizedPnl

  // Generate real cumulative PnL or Portfolio Value chart data
  const chartData = useMemo(()=>{
    const baseCapital = equity - totalPnl

    if (closedPositions.length === 0) {
      // Empty state
      const now = Math.floor(Date.now() / 1000)
      const baseValue = chartMetric === 'Portfolio Val.' ? equity : 0
      return [
        { time: (now - 86400) as Time, value: baseValue },
        { time: now as Time, value: baseValue }
      ]
    }

    // Sort closed positions ascending by time
    const sorted = [...closedPositions].sort((a, b) => (a.closedAt || 0) - (b.closedAt || 0))
    let cumPnl = 0
    const data = []
    
    // Add start point before first trade
    const firstTime = sorted[0].closedAt || Date.now()
    const startValue = chartMetric === 'Portfolio Val.' ? baseCapital : 0
    data.push({ time: ((firstTime / 1000) - 86400) as Time, value: startValue })

    for (const pos of sorted) {
      cumPnl += (pos.pnl || 0)
      const pointValue = chartMetric === 'Portfolio Val.' ? baseCapital + cumPnl : cumPnl
      data.push({ time: ((pos.closedAt || Date.now()) / 1000) as Time, value: +pointValue.toFixed(2) })
    }

    // Add current unrealized PnL to the last point
    const finalValue = chartMetric === 'Portfolio Val.' ? baseCapital + cumPnl + unrealizedPnl : cumPnl + unrealizedPnl
    data.push({ time: Math.floor(Date.now() / 1000) as Time, value: +finalValue.toFixed(2) })

    return data
  }, [closedPositions, unrealizedPnl, chartMetric, equity, totalPnl])

  useEffect(()=>{
    if(!chartRef.current) return
    const chart = createChart(chartRef.current,{
      layout:{ background:{type:ColorType.Solid,color:'transparent'}, textColor:'#848e9c', fontFamily:"'Inter', sans-serif", fontSize:11 },
      grid:{ vertLines:{color:'rgba(255,255,255,0.03)'}, horzLines:{color:'rgba(255,255,255,0.03)'} },
      rightPriceScale:{ borderColor:'rgba(255,255,255,0.06)' },
      timeScale:{ borderColor:'rgba(255,255,255,0.06)' },
      width: chartRef.current.clientWidth, height:280,
    })
    const series = chart.addSeries(AreaSeries, {
      topColor:'rgba(255,255,255,0.15)', bottomColor:'rgba(255,255,255,0.0)', lineColor:'#ffffff', lineWidth:2,
    })
    series.setData(chartData)
    chart.timeScale().fitContent()
    chartApiRef.current = chart
    const ro = new ResizeObserver(entries=>{
      for(const e of entries) chart.applyOptions({width:e.contentRect.width})
    })
    ro.observe(chartRef.current)
    return ()=>{ ro.disconnect(); chart.remove() }
  },[chartData])

  useEffect(() => {
    if (!chartApiRef.current || !chartData.length) return
    const chart = chartApiRef.current
    const now = Math.floor(Date.now() / 1000)
    let fromTime = 0
    if (chartTimeframe === '24h') fromTime = now - 86400
    else if (chartTimeframe === '7d') fromTime = now - 7 * 86400
    else if (chartTimeframe === '30d') fromTime = now - 30 * 86400
    else if (chartTimeframe === '90d') fromTime = now - 90 * 86400

    if (fromTime === 0) {
      chart.timeScale().fitContent()
    } else {
      chart.timeScale().setVisibleRange({ from: fromTime as Time, to: now as Time })
    }
  }, [chartTimeframe, chartData])

  return (
    <div className="portfolio-container" style={isCompact ? { padding: '16px 0 0 0' } : {}}>
      {isCompact ? (
        <div className="mobile-account-overview-card">
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--color-border)' }}>Account Overview</div>
          <div className="mobile-overview-row"><span className="label">Total Equity</span><span className="value font-mono">${equity.toFixed(2)}</span></div>
          <div className="mobile-overview-row"><span className="label">Available Balance</span><span className="value font-mono">${balance.toFixed(2)}</span></div>
          <div className="mobile-overview-row"><span className="label">Used Margin</span><span className="value font-mono">${activePositions.reduce((sum, p) => sum + p.collateral, 0).toFixed(2)}</span></div>
          <div className="mobile-overview-row"><span className="label">PnL (Unrealized)</span><span className={`value font-mono ${unrealizedPnl >= 0 ? 'text-green' : 'text-red'}`}>{unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}</span></div>
          <div className="mobile-overview-row"><span className="label">Margin Type</span><span className="value">Isolated</span></div>
        </div>
      ) : (
        <>
        {/* STATS ROW */}
        <div className="portfolio-stats-grid">
          <div className="stat-card">
            <div className="stat-label">Portfolio Value</div>
            <div className="stat-value font-mono">US${equity.toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">PnL</div>
            <div className={`stat-value font-mono ${totalPnl >= 0 ? 'text-green' : 'text-red'}`}>
              {totalPnl >= 0 ? '+' : ''}US${totalPnl.toFixed(2)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Volume</div>
            <div className="stat-value font-mono">US${totalVol.toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Fees (Taker / Maker)</div>
            <div className="stat-value font-mono" style={{ cursor: 'pointer', transition: 'color 0.2s' }}>0.05% / 0.03%</div>
          </div>
        </div>

        {/* MID SECTION */}
        <div className="portfolio-mid-grid">
          {/* LEFT: OVERVIEW */}
          <div className="overview-panel">
            <div className="panel-header">Overview</div>
            <div className="overview-list">
              {[
                ['Total Equity', `${equity.toFixed(2)} USDC`, 'var(--color-text1)'],
                ['Available Balance', `${balance.toFixed(2)} USDC`, 'var(--color-text1)'],
                ['Used Margin', `${activePositions.reduce((sum, p) => sum + p.collateral, 0).toFixed(2)} USDC`, 'var(--color-text1)'],
                ...(activePositions.length > 0 ? [['Unrealized PnL', `${unrealizedPnl>=0?'+':''}${unrealizedPnl.toFixed(2)} USDC`, unrealizedPnl>=0?'var(--color-green)':'var(--color-red)']] : []),
                ['Realized PnL', `${realizedPnl>=0?'+':''}${realizedPnl.toFixed(2)} USDC`, realizedPnl>=0?'var(--color-green)':'var(--color-red)'],
                ['Total Volume', `${totalVol.toFixed(2)} USDC`, 'var(--color-text1)'],
                ['Best Trade', `${bestTrade>0?'+':''}${bestTrade.toFixed(2)} USDC`, bestTrade>0?'var(--color-green)':'var(--color-text1)'],
                ['Win Rate', `${winRate}%`, 'var(--color-text1)'],
                ['Margin Type', 'Isolated', 'var(--color-text1)'],
              ].map(([label, value, color]) => (
                <div key={label} className="overview-item">
                  <span className="overview-label">{label}</span>
                  <span className="overview-value font-mono" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: CHART */}
          <div className="chart-panel">
            <div className="chart-header">
              <div>
                <div style={{ color:'var(--color-text2)', fontSize:13, marginBottom:4 }}>
                  {chartMetric === 'Portfolio Val.' ? 'Portfolio Value' : 'Profit/Loss'}
                </div>
                <div className="font-mono" style={{ fontSize:20, fontWeight:600 }}>
                  US${(chartMetric === 'Portfolio Val.' ? equity : totalPnl).toFixed(2)}
                </div>
              </div>
              <div className="chart-controls">
                <div className="control-group">
                  <button className={`control-btn ${chartMetric==='PnL'?'active':''}`} onClick={()=>setChartMetric('PnL')}>PnL</button>
                  <button className={`control-btn ${chartMetric==='Portfolio Val.'?'active':''}`} onClick={()=>setChartMetric('Portfolio Val.')}>Portfolio Val.</button>
                </div>
                <div className="control-group">
                  {['24h','7d','30d','90d','All'].map(tf => (
                    <button key={tf} className={`control-btn ${chartTimeframe===tf?'active':''}`} onClick={()=>setChartTimeframe(tf)}>{tf}</button>
                  ))}
                </div>
              </div>
            </div>
            <div ref={chartRef} className="chart-container" />
          </div>
        </div>
        </>
      )}

      {/* BOTTOM SECTION: TABS & TABLES */}
      <div className="portfolio-bottom">
        <Positions />
      </div>

      <style>{`
        .portfolio-container {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px 24px;
          min-height: calc(100vh - 60px);
          background: var(--color-bg0);
          color: var(--color-text1);
          box-sizing: border-box;
          min-width: 0;
        }
        .portfolio-header {
          margin-bottom: 32px;
        }

        /* Stats Grid */
        .portfolio-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .stat-card {
          padding: 20px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          background: var(--color-bg1);
        }
        .stat-label {
          color: var(--color-text2);
          font-size: 13px;
          margin-bottom: 8px;
        }
        .stat-value {
          font-size: 18px;
          font-weight: 600;
        }

        /* Mid Section Grid */
        .portfolio-mid-grid {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 16px;
          margin-bottom: 24px;
        }

        /* Overview Panel */
        .overview-panel {
          border: 1px solid var(--color-border);
          border-radius: 8px;
          background: var(--color-bg1);
          display: flex;
          flex-direction: column;
        }
        .panel-header {
          padding: 16px 20px;
          font-size: 15px;
          font-weight: 600;
          border-bottom: 1px solid var(--color-border);
        }
        .overview-list {
          display: flex;
          flex-direction: column;
          padding: 12px 20px;
          gap: 12px;
        }
        .overview-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
        }
        .overview-label {
          color: var(--color-text2);
          border-bottom: 1px dashed rgba(255,255,255,0.2);
          padding-bottom: 2px;
          cursor: help;
        }
        .overview-value {
          font-weight: 500;
        }

        /* Chart Panel */
        .chart-panel {
          border: 1px solid var(--color-border);
          border-radius: 8px;
          background: var(--color-bg1);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .chart-header {
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid var(--color-border);
        }
        .chart-controls {
          display: flex;
          gap: 16px;
        }
        .control-group {
          display: flex;
          background: var(--color-bg0);
          border-radius: 6px;
          padding: 2px;
          border: 1px solid var(--color-border);
        }
        .control-btn {
          background: transparent;
          border: none;
          color: var(--color-text3);
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
        }
        .control-btn.active {
          background: var(--color-bg2);
          color: var(--color-text1);
        }
        .chart-container {
          flex: 1;
          height: 280px;
          padding-top: 16px;
        }

        .portfolio-bottom {
          border: 1px solid var(--color-border);
          border-radius: 8px;
          background: var(--color-bg1);
          overflow: hidden;
        }
        .portfolio-bottom .positions-container {
          border-top: none;
          background: transparent;
        }

        .mobile-account-overview-card {
          background: var(--color-bg1);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .mobile-overview-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
        }
        .mobile-overview-row .label {
          color: var(--color-text2);
        }
        .mobile-overview-row .value {
          color: var(--color-text1);
        }

        .portfolio-mobile-only {
          display: none;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .portfolio-mid-grid {
            grid-template-columns: 250px 1fr;
          }
        }
        @media (max-width: 768px) {
          .portfolio-container {
            padding: 8px;
            overflow-x: hidden;
            padding-bottom: 0px;
          }
          .portfolio-header h1 {
            font-size: 24px !important;
          }
          .stat-card {
            padding: 16px;
            text-align: center;
          }
          .portfolio-stats-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .portfolio-mid-grid {
            display: flex;
            flex-direction: column-reverse; /* Put chart on top of overview on mobile */
            gap: 16px;
          }
          .chart-header {
            flex-direction: column;
            gap: 16px;
            align-items: stretch;
          }
          .chart-controls {
            flex-direction: column;
            width: 100%;
          }
          .control-group {
            width: 100%;
            overflow-x: auto;
          }
          .control-btn {
            flex: 1;
            white-space: nowrap;
            text-align: center;
          }
          .portfolio-bottom {
            margin: 0;
            border-radius: 8px;
            border: 1px solid var(--color-border);
          }
        }

        @media (max-width: 480px) {
          .portfolio-stats-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}


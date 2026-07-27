import { useState, useRef, useEffect, useMemo } from 'react'
import { createChart, ColorType, AreaSeries } from 'lightweight-charts'
import type { IChartApi, Time } from 'lightweight-charts'
import { useArcWallet } from '../hooks/useArcWallet'
import { useConfidentialVault } from '../hooks/useConfidentialVault'
import { useVaultHistory } from '../hooks/useGoldsky'
import { BLOCK_EXPLORER_URL } from '../config/chain'

export default function Vault() {
  const { isConnected, balance, connect, isWrongNetwork, address } = useArcWallet()
  const { 
    deposit, withdraw, isPending, availableLiquidity,
    degenTvlUsd, primeTvlUsd,
    degenSharePrice, primeSharePrice,
    userDegenShares, userPrimeShares,
    canWithdrawDegen, canWithdrawPrime
  } = useConfidentialVault()
  const { deposits: globalDeposits } = useVaultHistory()
  const { deposits: vaultDeposits, isLoading: isHistoryLoading } = useVaultHistory(address || undefined)

  const [activeTab, setActiveTab] = useState<'Degen' | 'Prime' | null>(null)
  const [activeAction, setActiveAction] = useState<'Deposit' | 'Withdraw'>('Deposit')
  const [amt, setAmt] = useState('')
  
  const chartRef = useRef<HTMLDivElement>(null)
  const chartApiRef = useRef<IChartApi | null>(null)
  const [chartTimeframe, setChartTimeframe] = useState('30d')

  const handleAction = async () => {
    if (!isConnected || isWrongNetwork) { connect(); return }
    const amount = Number(amt)
    if (!amount || amount <= 0) return

    try {
      const isDegen = activeTab === 'Degen'
      if (activeAction === 'Deposit') {
        await deposit(amount, isDegen)
      } else {
        await withdraw(amount, isDegen)
      }
      setAmt('')
    } catch (e) {
      console.error(e)
    }
  }

  const vaultVolume = useMemo(() => {
    if (!globalDeposits) return 0
    const vol = globalDeposits.reduce((acc, d) => acc + d.amount, 0)
    return vol
  }, [globalDeposits])

  const totalTvl = degenTvlUsd + primeTvlUsd
  const displayAvailableLiquidity = availableLiquidity

  const pnlData = useMemo(() => {
    if (!globalDeposits || globalDeposits.length === 0 || !activeTab) {
      const now = Math.floor(Date.now() / 1000)
      return [
        { time: (now - 86400) as Time, value: 0 },
        { time: now as Time, value: 0 }
      ]
    }
    
    const isDegenTab = activeTab === 'Degen'
    const filtered = globalDeposits.filter(d => d.isDegen === isDegenTab)
    
    if (filtered.length === 0) {
      const now = Math.floor(Date.now() / 1000)
      return [
        { time: (now - 86400) as Time, value: 0 },
        { time: now as Time, value: 0 }
      ]
    }

    const sorted = [...filtered].sort((a, b) => a.timestamp - b.timestamp)
    const data = []
    
    // Start at 0%
    data.push({ time: ((sorted[0].timestamp / 1000) - 86400) as Time, value: 0 })
    
    for (const d of sorted) {
      if (d.shares > 0) {
        const sharePrice = d.amount / d.shares
        const pnlPercent = (sharePrice - 1) * 100
        data.push({ time: (d.timestamp / 1000) as Time, value: +pnlPercent.toFixed(2) })
      }
    }
    
    // Add current live share price
    const currentSharePrice = isDegenTab ? degenSharePrice : primeSharePrice
    if (currentSharePrice) {
      const currentPnl = (currentSharePrice - 1) * 100
      data.push({ time: Math.floor(Date.now() / 1000) as Time, value: +currentPnl.toFixed(2) })
    }
    
    return data
  }, [globalDeposits, activeTab, degenSharePrice, primeSharePrice])

  useEffect(()=>{
    if(!chartRef.current || !activeTab) return
    
    if (chartApiRef.current) {
      chartApiRef.current.remove()
      chartApiRef.current = null
    }

    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#88919e',
        fontFamily: "'Geist', sans-serif"
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' }
      },
      width: chartRef.current.clientWidth,
      height: 300,
      localization: {
        priceFormatter: (price: number) => `${price >= 0 ? '+' : ''}${price.toFixed(2)}%`,
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      }
    })

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#4BFF99',
      topColor: 'rgba(75, 255, 153, 0.3)',
      bottomColor: 'rgba(75, 255, 153, 0.0)',
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => `${price >= 0 ? '+' : ''}${price.toFixed(2)}%`,
      },
    })

    series.setData(pnlData)
    chartApiRef.current = chart

    const handleResize = () => {
      if (chartRef.current && chartApiRef.current) {
        chartApiRef.current.applyOptions({ width: chartRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartApiRef.current === chart) {
        chart.remove()
        chartApiRef.current = null
      }
    }
  }, [activeTab, pnlData])

  // Timeframe filter logic
  useEffect(() => {
    if (!chartApiRef.current || !pnlData || pnlData.length === 0) return

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
  }, [chartTimeframe, pnlData])

  return (
    <div className="vault-container">
      
      {!activeTab ? (
        // --- VAULT OVERVIEW PAGE ---
        <div className="animate-fade-in">
          <div className="vault-hero">
            <h1>Liquidity Vaults</h1>
            <p className="vault-subtitle">Provide liquidity to the protocol and earn real yield from trading fees and liquidations.</p>
            
            <div className="vault-stats-grid">
              <div className="stat-card panel">
                <div className="stat-label">Total Vault TVL</div>
                <div className="stat-value font-mono">${totalTvl.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
              </div>
              <div className="stat-card panel">
                <div className="stat-label">Unutilized Capital</div>
                <div className="stat-value font-mono">${displayAvailableLiquidity.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
              </div>
              <div className="stat-card panel">
                <div className="stat-label">Global Volume</div>
                <div className="stat-value font-mono">${vaultVolume.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
              </div>
            </div>
          </div>

          <div className="tranche-cards">
            
            {/* DEGEN VAULT CARD */}
            <div className="tranche-card degen-card" onClick={() => setActiveTab('Degen')}>
              <div className="tc-header">
                <div>
                  <h2><span className="text-orange">Degen</span> Vault</h2>
                </div>
                <div className="badge badge-green">3x Profit Share</div>
              </div>
              <div className="tc-stats">
                <div className="tc-stat">
                  <span className="label">Est. APY</span>
                  <span className="value text-green font-mono">~ 45.0%</span>
                </div>
                <div className="tc-stat">
                  <span className="label">TVL</span>
                  <span className="value font-mono">${degenTvlUsd.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                </div>
                <div className="tc-stat">
                  <span className="label">cUSDC Price</span>
                  <span className="value font-mono">${degenSharePrice.toFixed(4)}</span>
                </div>
                <div className="tc-stat">
                  <span className="label">Lockup</span>
                  <span className="value font-mono">2 Days</span>
                </div>
              </div>
              <div className="tc-desc">
                The maximum-yield engine. Shares trader liabilities proportionally with Prime LPs based on TVL, and absorbs any overflow if Prime hits its protection floor. In return, Degen LPs capture a 3x profit multiplier across all platform fees, borrow fees, and liquidations.
              </div>
              <div className="tc-user-balance">
                <span>Your Balance:</span>
                <span className="font-mono text-white">{userDegenShares.toFixed(2)} cUSDC</span>
              </div>
            </div>

            {/* PRIME VAULT CARD */}
            <div className="tranche-card prime-card" onClick={() => setActiveTab('Prime')}>
              <div className="tc-header">
                <div>
                  <h2><span className="text-blue">Prime</span> Vault</h2>
                </div>
                <div className="badge badge-green">60% Protected Floor</div>
              </div>
              <div className="tc-stats">
                <div className="tc-stat">
                  <span className="label">Est. APY</span>
                  <span className="value text-green font-mono">~ 15.0%</span>
                </div>
                <div className="tc-stat">
                  <span className="label">TVL</span>
                  <span className="value font-mono">${primeTvlUsd.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                </div>
                <div className="tc-stat">
                  <span className="label">cUSDC Price</span>
                  <span className="value font-mono">${primeSharePrice.toFixed(4)}</span>
                </div>
                <div className="tc-stat">
                  <span className="label">Lockup</span>
                  <span className="value font-mono">5 Days</span>
                </div>
              </div>
              <div className="tc-desc">
                The capital preservation tier. Shares trader payouts proportionally based on TVL and is protected from bankruptcy. Equipped with a 60% hard capital protection floor, ensuring steady, institutional-grade security.
              </div>
              <div className="tc-user-balance">
                <span>Your Balance:</span>
                <span className="font-mono text-white">{userPrimeShares.toFixed(2)} cUSDC</span>
              </div>
            </div>

          </div>
        </div>
      ) : (
        // --- VAULT DETAIL (DEPOSIT) PAGE ---
        <div className="vault-detail animate-slide-in-right">
          <button className="back-btn" onClick={() => { setActiveTab(null); setAmt(''); }}>
            ← Back to Vaults
          </button>

          <div className="detail-header-card panel">
            <div className="dh-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ margin: 0 }}>
                <span className={activeTab === 'Degen' ? 'text-orange' : 'text-blue'}>{activeTab}</span> Vault
              </h2>
              <span className="badge badge-green" style={{ whiteSpace: 'nowrap' }}>
                {activeTab === 'Degen' ? '3x Profit Share' : 'Capital Protected'}
              </span>
            </div>
            <div className="dh-stats">
               <div className="dh-stat">
                 <span className="label">Est. APY</span>
                 <span className="value font-mono text-green">
                   {activeTab === 'Degen' ? '~ 45.0%' : '~ 15.0%'}
                 </span>
               </div>
               <div className="dh-stat">
                 <span className="label">TVL</span>
                 <span className="value font-mono">${(activeTab === 'Degen' ? degenTvlUsd : primeTvlUsd).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
               </div>
               <div className="dh-stat">
                 <span className="label">Lockup</span>
                 <span className="value font-mono">{activeTab === 'Degen' ? '2 Days' : '5 Days'}</span>
               </div>
               <div className="dh-stat">
                 <span className="label">Your Balance</span>
                 <span className="value font-mono text-white">{(activeTab === 'Degen' ? userDegenShares : userPrimeShares).toFixed(2)} cUSDC</span>
               </div>
            </div>
          </div>

          <div className="vault-bottom-grid">
            
            {/* ACTION CARD */}
            <div className="action-panel panel border-green">
              <div className="action-tabs">
                <button className={`at-btn ${activeAction === 'Deposit' ? 'active' : ''}`} onClick={()=>{setActiveAction('Deposit'); setAmt('')}}>Deposit</button>
                <button className={`at-btn ${activeAction === 'Withdraw' ? 'active' : ''}`} onClick={()=>{setActiveAction('Withdraw'); setAmt('')}}>Withdraw</button>
              </div>
              <div className="action-body">
                <div className="input-header">
                  <span>{activeAction === 'Deposit' ? 'Amount to deposit' : 'Shares to withdraw'}</span>
                  <span className="font-mono">
                    {activeAction === 'Deposit' 
                      ? 'Wallet: ' + balance.toFixed(2) + ' USDC' 
                      : (
                          <>
                            {'Available: ' + (activeTab === 'Degen' ? userDegenShares : userPrimeShares).toFixed(2) + ' cUSDC'}
                            {activeAction === 'Withdraw' && !(activeTab === 'Degen' ? canWithdrawDegen : canWithdrawPrime) && (activeTab === 'Degen' ? userDegenShares : userPrimeShares) > 0 && (
                              <span style={{ color: '#F59E0B', marginLeft: 8, fontSize: 12, fontWeight: 600 }}>🔒 Lockup Active</span>
                            )}
                          </>
                        )
                    }
                  </span>
                </div>
                <div className="input-box panel-inner">
                  <input type="number" placeholder="0.00" value={amt} onChange={e=>setAmt(e.target.value)} className="font-mono" />
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <button className="max-btn" onClick={()=>setAmt(activeAction==='Deposit'?String(balance):String(activeTab === 'Degen' ? userDegenShares : userPrimeShares))}>MAX</button>
                    <span style={{ fontWeight:600 }}>{activeAction === 'Deposit' ? 'USDC' : 'cUSDC'}</span>
                  </div>
                </div>

                <div className="receive-box panel-inner">
                  <span>You will receive</span>
                  <span className="font-mono" style={{ fontSize: 18, color: '#fff' }}>
                    {activeAction === 'Deposit' 
                      ? (Number(amt) / (activeTab === 'Degen' ? degenSharePrice : primeSharePrice) || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}) + ' cUSDC'
                      : (Number(amt) * (activeTab === 'Degen' ? degenSharePrice : primeSharePrice) || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}) + ' USDC'}
                  </span>
                </div>



                <button className="submit-btn btn btn-green" 
                  disabled={
                    isPending || 
                    (!amt && !isWrongNetwork && isConnected) || 
                    (Number(amt) <= 0 && !isWrongNetwork && isConnected) || 
                    (activeAction === 'Withdraw' && (activeTab === 'Degen' ? (userDegenShares <= 0 || !canWithdrawDegen) : (userPrimeShares <= 0 || !canWithdrawPrime)))
                  } 
                  onClick={handleAction}
                  style={{
                    background: (activeAction === 'Withdraw' && !(activeTab === 'Degen' ? canWithdrawDegen : canWithdrawPrime) && (activeTab === 'Degen' ? userDegenShares : userPrimeShares) > 0) ? 'rgba(245, 158, 11, 0.08)' : undefined,
                    color: (activeAction === 'Withdraw' && !(activeTab === 'Degen' ? canWithdrawDegen : canWithdrawPrime) && (activeTab === 'Degen' ? userDegenShares : userPrimeShares) > 0) ? '#FCD34D' : undefined,
                    borderColor: (activeAction === 'Withdraw' && !(activeTab === 'Degen' ? canWithdrawDegen : canWithdrawPrime) && (activeTab === 'Degen' ? userDegenShares : userPrimeShares) > 0) ? 'rgba(245, 158, 11, 0.25)' : undefined,
                    cursor: (activeAction === 'Withdraw' && !(activeTab === 'Degen' ? canWithdrawDegen : canWithdrawPrime) && (activeTab === 'Degen' ? userDegenShares : userPrimeShares) > 0) ? 'not-allowed' : undefined
                  }}
                >
                  {isPending 
                    ? 'Processing...' 
                    : !isConnected 
                    ? 'Connect Wallet' 
                    : isWrongNetwork 
                    ? 'Switch to Arc Testnet' 
                    : (activeAction === 'Withdraw' && (activeTab === 'Degen' ? userDegenShares <= 0 : userPrimeShares <= 0))
                    ? 'No Shares to Withdraw'
                    : (activeAction === 'Withdraw' && (activeTab === 'Degen' ? !canWithdrawDegen : !canWithdrawPrime))
                    ? `🔒 Locked (${activeTab === 'Degen' ? '2' : '5'} Days)`
                    : activeAction
                  }
                </button>
              </div>
            </div>

            {/* CHART PANEL */}
            <div className="chart-panel panel">
              <div className="cp-header">
                <h3>{activeTab} Vault Performance</h3>
                <div className="chart-controls">
                  {['24h','7d','30d','90d','All'].map(tf => (
                    <button key={tf} className={`control-btn ${chartTimeframe===tf?'active':''}`} onClick={()=>setChartTimeframe(tf)}>{tf}</button>
                  ))}
                </div>
              </div>
              <div ref={chartRef} className="chart-container" style={{ width: '100%', minHeight: 260 }} />
            </div>

          </div>

          <div className="vault-history-panel panel animate-fade-in-up" style={{ marginTop: 24, padding: 24 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600, color: 'var(--color-text1)' }}>Your Activity</h3>
            {!isConnected ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text2)', padding: '24px 0' }}>Connect wallet to view history.</div>
            ) : isHistoryLoading ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text2)', padding: '24px 0' }}>Loading history...</div>
            ) : !vaultDeposits || vaultDeposits.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text2)', padding: '24px 0' }}>No recent activity found.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text2)', textAlign: 'left' }}>
                      <th style={{ padding: '12px 8px', fontWeight: 500 }}>Action</th>
                      <th style={{ padding: '12px 8px', fontWeight: 500 }}>Vault</th>
                      <th style={{ padding: '12px 8px', fontWeight: 500 }}>Conversion</th>
                      <th style={{ padding: '12px 8px', fontWeight: 500 }}>Time</th>
                      <th style={{ padding: '12px 8px', fontWeight: 500 }}>Transaction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vaultDeposits.slice(0, 10).map((d) => (
                      <tr key={d.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '12px 8px', color: d.action === 'deposit' ? 'var(--color-green)' : 'var(--color-red)', textTransform: 'capitalize' }}>{d.action}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <span className={`badge ${d.isDegen ? 'badge-orange' : 'badge-blue'}`} style={{ fontSize: 11, padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                            {d.isDegen ? 'Degen' : 'Prime'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px' }} className="font-mono">
                          {d.action === 'deposit' 
                            ? `${d.amount.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} USDC → ${d.shares.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} cUSDC`
                            : `${d.shares.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} cUSDC → ${d.amount.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} USDC`
                          }
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--color-text2)' }}>{new Date(d.timestamp).toLocaleString()}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <a href={`${BLOCK_EXPLORER_URL}/tx/${d.txHash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>
                            {d.txHash.slice(0, 6)}...{d.txHash.slice(-4)}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .vault-container { width: 100%; max-width: 1200px; margin: 0 auto; padding: 40px 24px; min-height: calc(100vh - 60px); }
        .vault-hero { text-align: center; margin-bottom: 40px; }
        .vault-hero h1 { font-size: 32px; font-weight: 600; color: var(--color-text1); margin: 0 0 12px 0; }
        .vault-subtitle { color: var(--color-text2); font-size: 16px; max-width: 600px; margin: 0 auto 32px auto; }
        
        .vault-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
        .stat-card { padding: 20px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-bg1); }
        .stat-label { color: var(--color-text2); font-size: 13px; margin-bottom: 8px; }
        .stat-value { font-size: 18px; font-weight: 600; color: var(--color-text1); }

        .tranche-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
        .tranche-card { background: var(--color-bg1); border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 24px; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; box-shadow: var(--shadow-card); }
        .tranche-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; opacity: 0; transition: opacity 0.2s; }
        .tranche-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-modal); border-color: var(--color-border-strong); }
        
        .tc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--color-border); flex-wrap: wrap; gap: 12px; }
        .tc-header h2 { font-size: 22px; font-weight: 600; color: var(--color-text1); margin: 0; }
        .tc-tagline { font-size: 13px; font-weight: 500; }
        
        .tc-stats { display: flex; justify-content: center; gap: 40px; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--color-border); }
        .tc-stat { display: flex; flex-direction: column; gap: 4px; overflow: hidden; align-items: center; text-align: center; }
        .tc-stat .label { font-size: 12px; color: var(--color-text2); text-transform: uppercase; letter-spacing: 0.5px; }
        .tc-stat .value { font-size: 18px; font-weight: 600; color: var(--color-text1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        .tc-desc { font-size: 13px; color: var(--color-text2); line-height: 1.5; margin-bottom: 24px; height: 60px; }
        .tc-user-balance { display: flex; justify-content: space-between; align-items: center; background: var(--color-bg2); padding: 12px 16px; border-radius: var(--radius-lg); font-size: 14px; color: var(--color-text2); flex-wrap: wrap; gap: 8px; }

        /* Detail Page Styles */
        .back-btn { background: transparent; border: none; color: var(--color-text2); font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center; padding: 0; margin-bottom: 24px; transition: color 0.2s; }
        .back-btn:hover { color: var(--color-text1); }
        
        .detail-header-card { display: flex; justify-content: space-between; align-items: center; padding: 24px 32px; margin-bottom: 32px; flex-wrap: wrap; gap: 24px; }
        .dh-left h2 { font-size: 28px; font-weight: 600; color: var(--color-text1); margin: 0; }
        
        .dh-stats { display: flex; gap: 64px; flex-wrap: wrap; justify-content: center; }
        .dh-stat { display: flex; flex-direction: column; gap: 4px; align-items: center; text-align: center; }
        .dh-stat .label { font-size: 12px; color: var(--color-text2); text-transform: uppercase; letter-spacing: 0.5px; }
        .dh-stat .value { font-size: 20px; font-weight: 600; color: var(--color-text1); }

        .vault-bottom-grid { display: grid; grid-template-columns: 400px 1fr; gap: 24px; align-items: start; }
        
        .border-green { border-color: rgba(46, 189, 133, 0.3); box-shadow: 0 0 30px rgba(46,189,133,0.05); }
        
        .text-green { color: #2ebd85; }
        .text-orange { color: #f97316; }
        .text-blue { color: #60a5fa; }
        .badge-green { background-color: rgba(46, 189, 133, 0.12); color: #2ebd85; border: 1px solid rgba(46, 189, 133, 0.25); }
        .badge-orange { background-color: rgba(249, 115, 22, 0.15); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.28); }
        .badge-blue { background-color: rgba(96, 165, 250, 0.15); color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.28); }
        .btn-green { background-color: #2ebd85; color: #fff; }
        .btn-green:hover { background-color: #27a675; }
        
        .action-tabs { display: flex; padding: 14px 16px 0; gap: 8px; }
        .at-btn { flex: 1; padding: 8px 0; background: var(--color-bg2); border: 1px solid var(--color-border); border-radius: var(--radius-lg); color: var(--color-text2); font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.15s; }
        .at-btn.active { background: var(--color-bg3); color: var(--color-text1); border-color: var(--color-text3); }
        
        .action-body { padding: 24px; }
        .input-header { display: flex; justify-content: space-between; font-size: 13px; color: var(--color-text2); margin-bottom: 8px; flex-wrap: wrap; gap: 4px; }
        .input-box { display: flex; align-items: center; padding: 12px 16px; margin-bottom: 16px; }
        .input-box input { flex: 1; font-size: 18px; min-width: 0; }
        .max-btn { background: var(--color-bg3); color: var(--color-text1); border: none; border-radius: var(--radius-sm); font-size: 11px; font-weight: 600; padding: 4px 8px; cursor: pointer; transition: background 0.2s; }
        .max-btn:hover { background: var(--color-text3); }
        
        .receive-box { display: flex; justify-content: space-between; align-items: center; padding: 16px; margin-bottom: 24px; font-size: 13px; color: var(--color-text2); flex-wrap: wrap; gap: 8px; }
        .receive-box .font-mono { word-break: break-all; font-size: 16px !important; }
        
        .submit-btn { width: 100%; padding: 11px 0; font-size: 14px; font-weight: 600; }
        
        .chart-panel { padding: 24px; display: flex; flex-direction: column; }
        .cp-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
        .cp-header h3 { margin: 0; font-size: 18px; color: var(--color-text1); font-weight: 600; }
        
        .chart-controls { display: flex; background: var(--color-bg2); padding: 4px; border-radius: var(--radius-lg); border: 1px solid var(--color-border); }
        .control-btn { background: transparent; border: none; color: var(--color-text2); padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer; border-radius: var(--radius-sm); }
        .control-btn.active { background: var(--color-bg3); color: var(--color-text1); }

        @media (max-width: 1024px) {
          .tranche-cards { grid-template-columns: 1fr; }
          .vault-bottom-grid { display: flex; flex-direction: column; align-items: stretch; gap: 24px; }
          .chart-panel { order: -1; }
          .tc-desc { height: auto; }
          .dh-stats { gap: 24px; }
        }
        @media (max-width: 768px) {
          .vault-container { padding: 24px 16px; }
          .vault-stats-grid { grid-template-columns: 1fr; gap: 12px; }
          .stat-card { padding: 16px; text-align: center; }
          .vault-hero h1 { font-size: 26px; }
          
          .tc-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding-bottom: 16px; }
          .dh-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; width: 100%; }
          
          .detail-header-card { flex-direction: column; text-align: center; padding: 24px 16px; gap: 16px; }
          .dh-left { flex-direction: row !important; justify-content: center; flex-wrap: wrap; }
          
          .cp-header { flex-direction: column; align-items: flex-start; gap: 12px; }
          .chart-controls { flex-wrap: wrap; }
          .action-body { padding: 16px; }
        }
      `}</style>
    </div>
  )
}

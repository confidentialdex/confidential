import { useState } from 'react'
import { keccak256, toHex, formatUnits } from 'viem'
import { useReadContract } from 'wagmi'
import { CONTRACTS, ABIS } from '../config/contracts'
import PriceChart from '../components/PriceChart'
import OrderBook from '../components/OrderBook'
import OrderForm from '../components/OrderForm'
import Positions from '../components/Positions'
import Portfolio from './Portfolio'

import { useTradeStore } from '../store/useTradeStore'
import { useAll24hVolumes, usePairStats } from '../hooks/useGoldsky'

const getAssetLogo = (pair: string) => {
  const base = pair.split('/')[0].toLowerCase()
  const map: Record<string, string> = {
    btc: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
    eth: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    sol: 'https://cryptologos.cc/logos/solana-sol-logo.png',
    link: 'https://cryptologos.cc/logos/chainlink-link-logo.png',
    arb: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
    doge: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png',
    eur: 'https://flagcdn.com/w40/eu.png',
    gbp: 'https://flagcdn.com/w40/gb.png',
    usdjpy: 'https://flagcdn.com/w40/jp.png',
    aapl: 'https://ui-avatars.com/api/?name=Apple&background=000000&color=fff&rounded=true&bold=true',
    tsla: 'https://ui-avatars.com/api/?name=Tesla&background=cc0000&color=fff&rounded=true&bold=true',
    spy: 'https://ui-avatars.com/api/?name=SPY&background=003366&color=fff&rounded=true&bold=true',
    gold: '/gold.png',
    silver: '/silver.png',
    nvda: 'https://ui-avatars.com/api/?name=Nvidia&background=76b900&color=fff&rounded=true&bold=true',
    pepe: 'https://s2.coinmarketcap.com/static/img/coins/64x64/24478.png',
    wif: '/wif.jpg',
    sui: 'https://s2.coinmarketcap.com/static/img/coins/64x64/20947.png',
    apt: 'https://s2.coinmarketcap.com/static/img/coins/64x64/21794.png',
    avax: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png',
    bnb: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png',
    xrp: '/xrp.jpg',
    near: 'https://s2.coinmarketcap.com/static/img/coins/64x64/6535.png'
  }
  return map[base] || `https://ui-avatars.com/api/?name=${base}&background=1a202c&color=fff&rounded=true&bold=true`
}

export default function Trade() {

  const { markets, activeMarketId, mobileNav, setMobileNav, setMarketSelectorOpen, watchlist, toggleWatchlist } = useTradeStore()
  const activeMarket = markets.find((m) => m.id === activeMarketId)
  const [mobileView, setMobileView] = useState<'chart' | 'orderbook' | 'trades'>('chart')
  const [mobileStatsOpen, setMobileStatsOpen] = useState(false)
  const volumes = useAll24hVolumes()
  
  // -- Fetch Real Data --
  const pairIdStr = activeMarket?.pair || 'BTC/USDC'
  const pairId = keccak256(toHex(pairIdStr))
  const realVolume = volumes[pairId.toLowerCase()] || 0

  const pairStats = usePairStats()
  const currentStat = pairStats[pairId.toLowerCase()]

  const isMajorPair = activeMarket?.pair === 'BTC/USDC' || activeMarket?.pair === 'ETH/USDC'
  const defaultLimit = isMajorPair ? 10000000 : 5000000

  let totalOI = 0
  let longOIVal = 0
  let shortOIVal = 0
  let availableLongVal = defaultLimit
  let availableShortVal = defaultLimit

  if (currentStat) {
    longOIVal = currentStat.longOI
    shortOIVal = currentStat.shortOI
    totalOI = longOIVal + shortOIVal
    availableLongVal = Math.max(0, defaultLimit - longOIVal)
    availableShortVal = Math.max(0, defaultLimit - shortOIVal)
  }

  // Read real-time OI and limits for the active pair
  const { data: activePairOiResult } = useReadContract({
    address: CONTRACTS.CORE as `0x${string}`,
    abi: ABIS.CORE,
    functionName: 'getOIInfo',
    args: [pairId],
    query: { refetchInterval: 3000 }
  })

  if (activePairOiResult) {
    const [longOI, shortOI, maxLong, maxShort] = activePairOiResult as [bigint, bigint, bigint, bigint]
    longOIVal = Number(formatUnits(longOI, 6))
    shortOIVal = Number(formatUnits(shortOI, 6))
    totalOI = longOIVal + shortOIVal
    const onChainMaxLong = Number(formatUnits(maxLong, 6))
    const onChainMaxShort = Number(formatUnits(maxShort, 6))
    const finalMaxLong = (onChainMaxLong === 10000000 && !isMajorPair) ? 5000000 : onChainMaxLong
    const finalMaxShort = (onChainMaxShort === 10000000 && !isMajorPair) ? 5000000 : onChainMaxShort
    availableLongVal = Math.max(0, finalMaxLong - longOIVal)
    availableShortVal = Math.max(0, finalMaxShort - shortOIVal)
  }

  // Read projected funding rate directly from Core contract (1hr rate in 1e18 scale)
  const { data: projectedFundingRaw } = useReadContract({
    address: CONTRACTS.CORE as `0x${string}`,
    abi: ABIS.CORE,
    functionName: 'getProjectedFundingRate',
    args: [pairId],
    query: { refetchInterval: 3000 }
  })

  // Convert 1hr projected rate (int256, 1e18 scale) to percentage
  const hourlyFundingRate = projectedFundingRaw
    ? (Number(projectedFundingRaw) / 1e18) * 100
    : 0
  const formatFR = (rate: number) => Math.abs(rate) < 0.00005 ? '0.0000%' : `${rate >= 0 ? '+' : ''}${rate.toFixed(4)}%`
  const frColor = (rate: number) => rate === 0 ? 'var(--color-text2)' : rate > 0 ? 'var(--color-green)' : 'var(--color-red)'



  const fp = (p: number) => {
    if (!p) return '0.00'
    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    if (p >= 1) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 })
    return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 10 })
  }
  const fvCompact = (v: number) => {
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B'
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M'
    if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K'
    return v.toFixed(2)
  }

  const fvCompactNoDecimals = (v: number) => {
    if (v >= 1e9) return Math.round(v / 1e9) + 'B'
    if (v >= 1e6) return Math.round(v / 1e6) + 'M'
    if (v >= 1e3) return Math.round(v / 1e3) + 'K'
    return Math.round(v).toString()
  }

  const longPct = totalOI > 0 ? Math.round((longOIVal / totalOI) * 100) : 50
  const shortPct = totalOI > 0 ? Math.round((shortOIVal / totalOI) * 100) : 50

  return (
    <div className="trade-layout">
      <div className={`trade-middle ${mobileNav !== 'markets' ? 'mobile-hidden' : ''}`}>
        <div className="trade-middle-top">
          <div className="trade-center">
        {activeMarket && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            
            {/* --- DESKTOP HEADER --- */}
            <div className="trade-desktop-only" style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--color-border)', width: '100%', overflow: 'hidden' }}>
              <button 
                className="market-selector-trigger" 
                onClick={() => setMarketSelectorOpen(true)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', 
                  color: 'var(--color-text1)', cursor: 'pointer', maxWidth: '300px',
                  padding: '0 16px', flexShrink: 0, height: '100%' 
                }}
              >
                {getAssetLogo(activeMarket.pair) && (
                  <img src={getAssetLogo(activeMarket.pair)} alt={activeMarket.pair} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', background: activeMarket.category === 'crypto' ? 'transparent' : '#fff', padding: activeMarket.category === 'rwa' ? '2px' : '0', flexShrink: 0 }} onError={(e) => e.currentTarget.style.display = 'none'} />
                )}
                <span style={{ fontSize: 18, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1 }}>{activeMarket.pair}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: 'var(--color-text2)' }}>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ background: 'rgba(247, 147, 26, 0.15)', color: '#F7931A', padding: '2px 6px', fontSize: 11, borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>
                  {activeMarket.maxLeverage}x
                </span>
              </button>

              <div 
                className="chart-header-stats" 
                style={{ 
                  flex: 1, 
                  borderBottom: 'none', 
                  overflowX: 'auto',
                  maskImage: 'linear-gradient(to right, transparent, black 15px, black calc(100% - 30px), transparent)',
                  WebkitMaskImage: 'linear-gradient(to right, transparent, black 15px, black calc(100% - 30px), transparent)'
                }}
              >
                <div className="chart-stat-item">
                  <span className="chart-stat-label">Oracle Price</span>
                  <span className="font-mono chart-stat-value" style={{ color: 'var(--color-accent)' }}>{fp(activeMarket.price)}</span>
                </div>
                <div className="chart-stat-item">
                  <span className="chart-stat-label">24h Change</span>
                  <span className="font-mono chart-stat-value" style={{ color: activeMarket.change24h >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                    {activeMarket.change24h >= 0 ? '+' : ''}{activeMarket.change24h.toFixed(2)}%
                  </span>
                </div>
                <div className="chart-stat-item">
                  <span className="chart-stat-label">24h Volume</span>
                  <span className="font-mono chart-stat-value">${fvCompact(realVolume)}</span>
                </div>
                <div className="chart-stat-item">
                  <span className="chart-stat-label">
                    Open Interest{' '}
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text2)' }}>
                      (<span style={{ color: 'var(--color-green)' }}>{longPct}%</span>/<span style={{ color: 'var(--color-red)' }}>{shortPct}%</span>)
                    </span>
                  </span>
                  <span className="font-mono chart-stat-value" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <span style={{ color: 'var(--color-green)', fontSize: '12px', lineHeight: 1 }}>↗</span>
                      <span style={{ color: 'var(--color-green)' }}>${fvCompact(longOIVal)}</span>
                    </span>
                    <span style={{ color: 'var(--color-text3)' }}>/</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <span style={{ color: 'var(--color-red)', fontSize: '12px', lineHeight: 1 }}>↘</span>
                      <span style={{ color: 'var(--color-red)' }}>${fvCompact(shortOIVal)}</span>
                    </span>
                  </span>
                </div>
                <div className="chart-stat-item">
                  <span className="chart-stat-label">Available Liquidity</span>
                  <span className="font-mono chart-stat-value" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <span style={{ color: 'var(--color-green)', fontSize: '12px', lineHeight: 1 }}>↗</span>
                      <span style={{ color: 'var(--color-text2)' }}>:</span>
                      <span style={{ color: 'var(--color-green)' }}>${fvCompactNoDecimals(availableLongVal)}</span>
                    </span>
                    <span style={{ color: 'var(--color-text3)' }}>/</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <span style={{ color: 'var(--color-red)', fontSize: '12px', lineHeight: 1 }}>↘</span>
                      <span style={{ color: 'var(--color-text2)' }}>:</span>
                      <span style={{ color: 'var(--color-red)' }}>${fvCompactNoDecimals(availableShortVal)}</span>
                    </span>
                  </span>
                </div>
                <div className="chart-stat-item chart-stat-mobile-col">
                  <span className="chart-stat-label">1hr Funding</span>
                  <span className="font-mono chart-stat-value" style={{ color: frColor(hourlyFundingRate) }}>
                    {formatFR(hourlyFundingRate)}
                  </span>
                </div>
              </div>
            </div>

            {/* --- MOBILE HEADER --- */}
            <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', width: '100%', borderBottom: '1px solid var(--color-border)', padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                {/* Left: Pair Info */}
                <button 
                  onClick={() => setMarketSelectorOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--color-text1)', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                >
                  {getAssetLogo(activeMarket.pair) && (
                    <img src={getAssetLogo(activeMarket.pair)} alt={activeMarket.pair} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', background: activeMarket.category === 'crypto' ? 'transparent' : '#fff', padding: activeMarket.category === 'rwa' ? '2px' : '0', flexShrink: 0 }} onError={(e) => e.currentTarget.style.display = 'none'} />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ 
                        fontSize: activeMarket.pair.length > 10 ? 15 : activeMarket.pair.length > 8 ? 17 : 20, 
                        fontWeight: 700, 
                        letterSpacing: '-0.02em',
                        whiteSpace: 'nowrap'
                      }}>
                        {activeMarket.pair.replace('/', '-')}
                      </span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text2)', marginTop: 1, flexShrink: 0 }}>
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: -1 }}>
                      <span style={{ fontSize: 10, padding: '1px 4px', background: 'rgba(247, 147, 26, 0.1)', color: '#F7931A', borderRadius: '4px', fontWeight: 600 }}>{activeMarket.maxLeverage}x</span>
                      <div
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleWatchlist(activeMarket.id);
                        }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24"
                          fill={watchlist.includes(activeMarket.id) ? '#F7931A' : 'none'}
                          stroke={watchlist.includes(activeMarket.id) ? '#F7931A' : 'currentColor'}
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          style={{ color: 'var(--color-text3)' }}>
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Right: Price & Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                    <span className="font-mono" style={{ fontSize: 15, fontWeight: 700 }}>{fp(activeMarket.price)}</span>
                    <span className="font-mono" style={{ color: activeMarket.change24h >= 0 ? 'var(--color-green)' : 'var(--color-red)', fontSize: 11, fontWeight: 600 }}>
                      {activeMarket.change24h >= 0 ? '+' : ''}{(activeMarket.price * (activeMarket.change24h/100)).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} / {activeMarket.change24h >= 0 ? '+' : ''}{activeMarket.change24h.toFixed(2)}%
                    </span>
                  </div>
                  <button 
                    onClick={() => setMobileStatsOpen(!mobileStatsOpen)}
                    style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 6, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text2)', cursor: 'pointer', padding: 0 }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ transform: mobileStatsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Mobile Stats Expanded */}
              {mobileStatsOpen && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px 8px', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ color: 'var(--color-text2)', fontSize: 9 }}>Oracle Price</span>
                    <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-accent)' }}>${fp(activeMarket.price)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ color: 'var(--color-text2)', fontSize: 9 }}>24h Change</span>
                    <span className="font-mono" style={{ fontSize: 11, color: activeMarket.change24h >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                      {activeMarket.change24h >= 0 ? '+' : ''}{activeMarket.change24h.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ color: 'var(--color-text2)', fontSize: 9 }}>24h Volume</span>
                    <span className="font-mono" style={{ fontSize: 11 }}>${fvCompact(realVolume)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ color: 'var(--color-text2)', fontSize: 9 }}>1hr Funding</span>
                    <span className="font-mono" style={{ fontSize: 11, color: frColor(hourlyFundingRate) }}>{formatFR(hourlyFundingRate)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ color: 'var(--color-text2)', fontSize: 9 }}>Open Interest</span>
                    <span className="font-mono" style={{ fontSize: 11 }}>${fvCompact(totalOI)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ color: 'var(--color-text2)', fontSize: 9 }}>Available Liquidity</span>
                    <span className="font-mono" style={{ fontSize: 11 }}>
                      <span style={{color:'var(--color-green)'}}>${fvCompactNoDecimals(availableLongVal)}</span> / <span style={{color:'var(--color-red)'}}>${fvCompactNoDecimals(availableShortVal)}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Mobile Sub-Navigation Tabs */}
        <div className="trade-mobile-tabs mobile-only">
          <button className={`tm-tab ${mobileView === 'chart' ? 'active' : ''}`} onClick={() => setMobileView('chart')}>
            Chart
          </button>

          <button className={`tm-tab ${mobileView === 'trades' ? 'active' : ''}`} onClick={() => setMobileView('trades')}>
            Trades
          </button>
        </div>

        {/* Desktop ALWAYS shows Chart. Mobile ONLY shows it when mobileView === 'chart' */}
        <div className={`trade-chart ${mobileView !== 'chart' ? 'mobile-hidden' : ''}`}>
          <PriceChart />
        </div>

        {/* Mobile Trades */}
        {mobileView === 'trades' && (
          <div className="trade-chart mobile-only" style={{ flexDirection: 'column' }}>
            <OrderBook hideTabs />
          </div>
        )}

          </div>
          <div className="trade-orderbook-col trade-desktop-only">
            <OrderBook />
          </div>
        </div>
        <div className="trade-positions">
          <Positions />
        </div>
      </div>
      <div className="trade-right trade-desktop-only">
        <OrderForm />
      </div>

      {mobileNav === 'trade' && (
        <div className="mobile-only trade-mobile-tab-view">
          <OrderForm />
        </div>
      )}

      {mobileNav === 'account' && (
        <div className="mobile-only trade-mobile-tab-view">
          <Portfolio isCompact={true} />
        </div>
      )}


      {/* Mobile Bottom Action Bar */}
      <div className="trade-mobile-action-bar">
        <button className={`mobile-nav-btn ${mobileNav === 'markets' ? 'active' : ''}`} onClick={() => setMobileNav('markets')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <rect x="4" y="14" width="4" height="7" rx="1"/>
            <rect x="10" y="9" width="4" height="12" rx="1"/>
            <rect x="16" y="3" width="4" height="18" rx="1"/>
          </svg>
          <span>Markets</span>
        </button>
        <button className={`mobile-nav-btn ${mobileNav === 'trade' ? 'active' : ''}`} onClick={() => setMobileNav('trade')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 4h-4v4H7l5 5 5-5h-3V4zM10 20h4v-4h3l-5-5-5 5h3v4z"/>
          </svg>
          <span>Trade</span>
        </button>
        <button className={`mobile-nav-btn ${mobileNav === 'account' ? 'active' : ''}`} onClick={() => setMobileNav('account')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z"/>
          </svg>
          <span>Account</span>
        </button>
      </div>


      <style>{`
        .trade-layout {
          display: grid;
          grid-template-columns: 1fr 300px;
          min-height: calc(100vh - 60px);
          padding: 0 12px 12px 12px;
          gap: 12px;
        }
        .trade-middle {
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 0;
          gap: 12px;
        }
        .trade-middle-top {
          display: flex;
          height: 550px;
          min-width: 0;
          gap: 12px;
        }

        .trade-center {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-height: 0;
          min-width: 0;
          flex: 1;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          background-color: var(--color-bg1);
        }
        .trade-center:fullscreen {
          background-color: var(--color-bg0);
          border: none;
          border-radius: 0;
          padding: 12px;
        }
        .trade-chart {
          flex: 1;
          min-height: 0;
        }
        
        /* ═══ Header Stats ═══ */
        .chart-header-stats {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--color-border);
          flex-wrap: nowrap;
          overflow-x: auto;
          scrollbar-width: none;
          gap: 24px;
          font-size: 13px;
          flex-shrink: 0;
        }
        .chart-header-stats::-webkit-scrollbar {
          display: none;
        }
        .chart-stat-item {
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }
        .chart-stat-label {
          color: var(--color-text3);
          font-size: 10px;
          margin-bottom: 2px;
          white-space: nowrap;
        }
        .chart-stat-value {
          font-weight: 500;
          font-size: 12px;
          white-space: nowrap;
        }
        .market-selector-trigger {
          padding: 6px 8px;
          margin-left: -8px;
          border-radius: 6px;
          transition: all 0.2s ease;
        }
        .market-selector-trigger:hover {
          background-color: var(--color-bg2) !important;
        }
        .market-selector-trigger:active {
          transform: scale(0.96);
          opacity: 0.8;
        }
        .trade-positions {
          flex: 1;
          overflow: hidden;
          background-color: transparent; /* Move card styles to mobile query or inner */
        }
        .trade-positions .positions-container {
          border: 1px solid var(--color-border);
          border-radius: 8px;
          background-color: var(--color-bg1);
          height: 100%;
        }
        .trade-orderbook-col {
          width: 260px;
          flex-shrink: 0;
          overflow: hidden;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        .trade-right {
          min-height: 0;
        }

        /* Hidden by default on desktop */
        .mobile-only {
          display: none !important;
        }
        .trade-mobile-action-bar {
          display: none;
        }
        .trade-mobile-modal-backdrop {
          display: none;
        }
        .trade-mobile-tabs {
          display: none;
        }
        .trade-mobile-tab-view {
          display: none;
        }

        .action-btn {
          flex: 1; padding: 14px;
          font-size: 14px; font-weight: 600;
          border-radius: var(--radius-md); border: none; cursor: pointer;
          letter-spacing: 0.5px;
          transition: opacity 150ms;
        }
        .action-btn:active { opacity: 0.85; transform: scale(0.98); }
        .action-buy { background-color: var(--color-green); color: #070c18; text-transform: uppercase; }
        .action-sell { background-color: var(--color-red); color: #fff; text-transform: uppercase; }
        .action-connect { background-color: var(--color-green); color: #070c18; text-transform: uppercase; font-size: 13px !important; padding: 12px !important; border-radius: 999px !important; width: 100% !important; margin: 0 !important; box-sizing: border-box !important; text-align: center !important; display: flex !important; justify-content: center !important; align-items: center !important; }
        
        .mobile-nav-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          background: none;
          border: none;
          color: var(--color-text3);
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.2s;
        }
        .mobile-nav-btn.active {
          color: var(--color-text1);
        }
        .mobile-nav-btn svg {
          width: 22px;
          height: 22px;
          stroke: currentColor;
        }
        .mobile-nav-btn:hover {
          color: var(--color-text2);
        }

        .trade-below-chart {
          display: flex;
          flex-direction: column;
          padding: 16px;
          border-bottom: 1px solid var(--color-border);
          flex-shrink: 0;
        }
        .tbc-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .tbc-dropdown {
          display: flex; gap: 4px; align-items: center;
          color: var(--color-text3); font-size: 13px;
        }
        .tbc-settings {
          display: flex; gap: 12px; align-items: center;
          color: var(--color-text3); font-size: 13px;
        }
        .tbc-segmented-control {
          display: flex;
          background: var(--color-bg2);
          border-radius: 24px;
          padding: 4px;
        }
        .tbc-seg-btn {
          padding: 8px 16px;
          background: none; border: none;
          color: var(--color-text3);
          border-radius: 20px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .tbc-seg-btn.active {
          background: var(--color-bg3);
          color: var(--color-text1);
        }
        .tbc-order-value {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }
        .tbc-ov-label {
          color: #a4b3d1;
          font-size: 13px;
        }
        .tbc-ov-value {
          color: #a4b3d1;
          font-size: 15px;
        }
        
        .trade-mobile-modal {
          background: var(--color-bg1);
          border-top-left-radius: var(--radius-xl);
          border-top-right-radius: var(--radius-xl);
          width: 100%; max-height: 85vh;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up { animation: slideUp 250ms cubic-bezier(0.23, 1, 0.32, 1); }

        /* ═══ Tablet (769px — 1024px) — 2-column layout ═══ */
        @media (max-width: 1024px) and (min-width: 769px) {
          .chart-header-stats {
            flex-wrap: nowrap;
            overflow-x: auto;
            -ms-overflow-style: none;
            scrollbar-width: none;
            padding: 10px 12px;
            gap: 16px;
          }
          .chart-header-stats::-webkit-scrollbar {
            display: none;
          }
          
          .trade-layout {
            grid-template-columns: 1fr;
            grid-template-rows: 1fr;
            padding-bottom: 68px;
          }
          .trade-sidebar {
            display: none;
          }
          .trade-middle {
            grid-column: 1;
            grid-row: 1;
          }
          .trade-chart {
            min-height: 360px;
            flex: 1;
          }
          .trade-positions {
            height: 200px;
          }
          .trade-mobile-action-bar {
            display: flex;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            width: 100%;
            box-sizing: border-box;
            background-color: var(--color-bg0);
            border-top: 1px solid var(--color-border);
            padding: 8px;
            padding-bottom: calc(8px + env(safe-area-inset-bottom));
            gap: 12px;
            z-index: 90;
            justify-content: center;
            align-items: center;
          }
          .trade-mobile-modal-backdrop {
            display: flex;
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
            z-index: 998; flex-direction: column; justify-content: flex-end;
          }
        }

        /* ═══ Mobile (<= 768px) — Hyperliquid Scrollable Layout ═══ */
        @media (max-width: 768px) {
          .trade-middle-top, .trade-center {
            width: 100%;
          }
          .chart-header-stats {
            display: flex;
            flex-wrap: nowrap;
            overflow-x: auto;
            -ms-overflow-style: none;
            scrollbar-width: none;
            padding: 12px 16px;
            gap: 20px;
            width: 100%;
            box-sizing: border-box;
          }
          .chart-header-stats::-webkit-scrollbar {
            display: none;
          }
          .chart-stat-item {
            align-items: flex-start;
          }
          .chart-stat-label {
            font-size: 10px;
            margin-bottom: 4px;
            color: var(--color-text3);
          }
          .chart-stat-value {
            font-size: 12px;
            color: var(--color-text1);
          }

          .trade-desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
          
          .trade-mobile-action-bar {
            display: flex;
            position: sticky;
            bottom: 0;
            margin-top: auto;
            width: 100%;
            box-sizing: border-box;
            background-color: var(--color-bg0);
            border-top: 1px solid var(--color-border);
            padding: 12px;
            padding-bottom: 24px;
            padding-bottom: calc(16px + env(safe-area-inset-bottom));
            gap: 10px;
            z-index: 90;
            justify-content: center;
            align-items: center;
          }
          .trade-mobile-modal-backdrop {
            display: flex;
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
            z-index: 998; flex-direction: column; justify-content: flex-end;
          }
          .trade-mobile-modal {
            background: var(--color-bg1);
            border-top-left-radius: 16px;
            border-top-right-radius: 16px;
            overflow-y: auto;
            max-height: 85vh;
            width: 100%;
            padding: 16px;
            padding-bottom: calc(16px + env(safe-area-inset-bottom));
          }
          .trade-mobile-tabs {
            display: flex;
            background: var(--color-bg1);
            border-bottom: 1px solid var(--color-border);
            flex-shrink: 0;
          }
          .tm-tab {
            flex: 1;
            text-align: center;
            padding: 10px 0;
            font-size: 13px;
            font-weight: 500;
            color: var(--color-text3);
            border: none;
            background: none;
            border-bottom: 2px solid transparent;
            cursor: pointer;
            transition: all 150ms ease;
          }
          .tm-tab.active {
            color: var(--color-text1);
            border-bottom-color: var(--color-text1);
          }
          .trade-layout {
            display: flex;
            flex-direction: column;
            /* 60px Topbar */
            height: calc(100dvh - 60px);
            min-height: calc(100vh - 60px);
            overflow-y: auto;
            overflow-x: hidden;
            width: 100%;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 80px; /* Unified bottom spacing */
          }
          .trade-sidebar {
            display: none;
          }
          
          .trade-middle-top {
            height: auto;
            flex-direction: column;
          }
          .trade-center {
            height: auto;
            flex-shrink: 0;
          }
          .trade-chart {
            min-height: 300px;
            height: 50vh;
            max-height: 450px;
            flex: none;
            overflow: hidden !important;
          }
          .trade-below-chart {
            display: none !important;
          }
          .trade-positions {
            min-height: 400px; /* Provides scroll space without extending the gray box */
            flex-shrink: 0;
            display: block !important;
            background: transparent;
            border: none;
          }
          .trade-positions .positions-container {
            height: auto;
            overflow: hidden;
            /* Inner container naturally limits the gray background to its content */
          }
          .action-btn {
            padding: 10px 8px;
            font-size: 13px;
            font-weight: 600;
            box-sizing: border-box;
            flex: 1;
            min-width: 0;
          }
          .trade-mobile-action-bar {
            display: flex !important;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            margin-top: 0;
            box-sizing: border-box;
            background: rgba(11, 16, 22, 0.98) !important;
            backdrop-filter: blur(10px) !important;
            -webkit-backdrop-filter: blur(10px) !important;
            border-top: 1px solid var(--color-border);
            padding: 8px 16px;
            padding-bottom: calc(8px + env(safe-area-inset-bottom));
            gap: 12px;
            z-index: 900;
            justify-content: center;
            align-items: center;
          }
          .mobile-nav-btn {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            background: none;
            border: none;
            color: var(--color-text3);
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          .mobile-nav-btn svg {
            width: 20px;
            height: 20px;
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.3s ease;
          }
          .mobile-nav-btn.active {
            color: var(--color-text1);
          }
          .mobile-nav-btn.active svg {
            transform: translateY(-2px) scale(1.15);
            filter: drop-shadow(0 4px 6px rgba(255, 255, 255, 0.15));
            color: var(--color-accent);
          }
          .trade-mobile-tab-view {
            display: flex;
            flex-direction: column;
            width: 100%;
            min-width: 0;
            flex-shrink: 0; /* Prevents form from shrinking when TP/SL is toggled */
            /* removed nested scroll to inherit parent scroll and padding */
          }
          .mobile-hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}

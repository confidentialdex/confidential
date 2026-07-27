import { useState, useRef, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { usePrivy } from '@privy-io/react-auth'
import { useArcWallet } from '../hooks/useArcWallet'
import { useTradeStore } from '../store/useTradeStore'
import { useTranslation } from 'react-i18next'

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
    pepe: 'https://cryptologos.cc/logos/pepe-pepe-logo.png',
    wif: '/wif.jpg',
    sui: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/sui/info/logo.png',
    apt: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/aptos/info/logo.png',
    avax: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png',
    bnb: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png',
    xrp: '/xrp.jpg',
    near: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/near/info/logo.png'
  }
  return map[base] || `https://ui-avatars.com/api/?name=${base}&background=1a202c&color=fff&rounded=true&bold=true`
}

export default function Topbar() {
  const { t } = useTranslation()
  const NAV_LINKS = [
    { to: '/trade', label: t('nav.trade') },
    { to: '/portfolio', label: t('nav.portfolio') },
    { to: '/vaults', label: 'Vaults' },
    { to: '/referrals', label: t('nav.referrals') },
    { to: '/points', label: t('nav.points') },
    { to: '/leaderboard', label: t('nav.leaderboard') },
  ]

  const { ready, login } = usePrivy()
  const { isConnected, address, balance, disconnect, isPrivyWallet, exportWallet } = useArcWallet()

  const truncatedAddress = address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : ''
  const { markets, activeMarketId, setActiveMarket, isMarketSelectorOpen, setMarketSelectorOpen, watchlist, toggleWatchlist, marketCategoryFilter, setMarketCategoryFilter } = useTradeStore()
  const volumes = useAll24hVolumes()

  const pairStats = usePairStats()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [marketSearch, setMarketSearch] = useState('')
  const marketTab = marketCategoryFilter || 'all'
  const setMarketTab = setMarketCategoryFilter
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }


  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (isMobileMenuOpen || isMarketSelectorOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen, isMarketSelectorOpen])

  const filteredMarkets = markets.filter((m) => {
    const matchesSearch = m.pair.toLowerCase().includes(marketSearch.toLowerCase())
    const matchesTab = marketTab === 'all'
      ? true
      : marketTab === 'watchlist'
        ? watchlist.includes(m.id)
        : m.category === marketTab
    return matchesSearch && matchesTab
  })

  const formatPrice = (price: number) => {
    if (price >= 10000) return price.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    if (price >= 100) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    if (price >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  }

  const formatVol = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}b`
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}m`
    if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}k`
    return `$${v.toFixed(2)}`
  }

  const formatOI = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
    if (v >= 1e3) return `$${(v / 1e3).toFixed(2)}K`
    return `$${v.toFixed(2)}`
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        {/* Left — Logo & Desktop Nav */}
        <div className="topbar-left">
          {/* Mobile Hamburger */}
          <button
            className="mobile-menu-btn"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <div className="topbar-logo-wrapper">
            <NavLink to="/" className="topbar-logo" style={{ textDecoration: 'none' }}>
              <img src="/logo.png" alt="Confidential Logo" style={{ height: 28, width: 28, objectFit: 'contain' }} />
              <span className="topbar-brand desktop-only">Confidential</span>
            </NavLink>
          </div>

          <nav className="topbar-nav desktop-only">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `topbar-nav-link ${isActive ? 'active' : ''}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>



        {/* Right — Wallet & Settings */}
        <div className="topbar-right">

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

            {/* Removed Wrong Network Warning */}



            {!isConnected ? (
              <button
                className="btn btn-connect-unified"
                style={{ padding: '6px 12px', fontSize: '13px' }}
                onClick={login}
                disabled={!ready}
              >
                <span>Connect<span className="desktop-only">&nbsp;Wallet</span></span>
              </button>
            ) : (
              <div className="topbar-account" ref={dropdownRef}>
                <button
                  className="topbar-account-btn"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                  <div className="topbar-avatar" />
                  <span className="font-mono" style={{ fontSize: '13px' }}>
                    {truncatedAddress}
                  </span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: dropdownOpen ? 'rotate(180deg)' : '', transition: 'transform 200ms' }}>
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="topbar-dropdown animate-fade-in-up" style={{ animationDuration: '200ms' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                      <div className="label" style={{ marginBottom: '4px' }}>Connected Wallet</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="font-mono" style={{ fontSize: '13px' }}>{truncatedAddress}</div>
                        <button onClick={handleCopy} title="Copy Address" style={{ background: 'none', border: 'none', color: copied ? 'var(--color-green)' : 'var(--color-text2)', cursor: 'pointer', display: 'flex', padding: 0 }}>
                          {copied ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M8 4v12a2 2 0 002 2h8a2 2 0 002-2V7.242a2 2 0 00-.586-1.414l-3.828-3.828A2 2 0 0014.172 1.5H10a2 2 0 00-2 2z" stroke="currentColor" strokeWidth="2" /><path d="M16 18v2a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2" stroke="currentColor" strokeWidth="2" /></svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                      <div className="label" style={{ marginBottom: '4px' }}>Balance</div>
                      <div className="font-mono" style={{ fontSize: '16px', color: 'var(--color-green)' }}>
                        {balance.toFixed(2)} USDC
                      </div>
                    </div>
                    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {isPrivyWallet && exportWallet && (
                        <button
                          className="btn btn-ghost"
                          style={{ width: '100%', fontSize: '13px', color: 'var(--color-text1)' }}
                          onClick={() => {
                            exportWallet()
                            setDropdownOpen(false)
                          }}
                        >
                          Export
                        </button>
                      )}
                      <button
                        className="btn btn-ghost"
                        style={{ width: '100%', fontSize: '13px', color: 'var(--color-red)' }}
                        onClick={() => {
                          disconnect()
                          setDropdownOpen(false)
                        }}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', marginLeft: '8px' }}>

          </div>


        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="mobile-menu-backdrop" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="mobile-menu-drawer" onClick={e => e.stopPropagation()}>

            <nav className="mobile-menu-nav">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `mobile-nav-link ${isActive ? 'active' : ''}`
                  }
                >
                  {link.label}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="nav-arrow">
                    <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </NavLink>
              ))}
            </nav>
            <div className="mobile-menu-footer">
              {isConnected && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="topbar-avatar" style={{ width: 24, height: 24 }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="font-mono" style={{ fontSize: '14px', color: '#fff' }}>{truncatedAddress}</span>
                        <span className="font-mono" style={{ fontSize: '12px', color: 'var(--color-green)' }}>{balance.toFixed(2)} USDC</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        disconnect();
                        setIsMobileMenuOpen(false);
                      }} 
                      style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)', color: 'var(--color-red)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: '6px 12px', borderRadius: '6px' }}
                    >
                      Disconnect
                    </button>
                  </div>
                  {isPrivyWallet && exportWallet && (
                    <button
                      onClick={() => {
                        exportWallet();
                        setIsMobileMenuOpen(false);
                      }}
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--color-text1)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: '10px', borderRadius: '8px' }}
                    >
                      Export Wallet
                    </button>
                  )}
                </div>
              )}

              <div className="mobile-socials" style={{ display: 'flex', gap: '24px', marginTop: '8px', padding: '0 8px', alignItems: 'center', justifyContent: 'center' }}>
                <a href="https://x.com/Confidentialdex" target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.5)', transition: 'color 0.2s' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                </a>
                <a href="https://github.com/confidentialdex/confidential" target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.5)', transition: 'color 0.2s' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Market Selector — Slide-in Panel from Right */}
      {isMarketSelectorOpen && (
        <div
          className="market-selector-backdrop"
          onClick={() => setMarketSelectorOpen(false)}
        >
          <div
            className="market-selector-panel"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel Header */}
            <div className="msp-header">
              <span className="msp-title">Markets</span>
              <button
                className="mobile-close-btn"
                onClick={() => setMarketSelectorOpen(false)}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="msp-search-wrapper">
              <div className="msp-search">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: 'var(--color-text3)' }}>
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <input
                  className="msp-search-input"
                  placeholder="Search markets..."
                  type="text"
                  value={marketSearch}
                  onChange={(e) => setMarketSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Category Tabs */}
            <div className="msp-tabs">
              <button
                className={`msp-tab ${marketTab === 'all' ? 'active' : ''}`}
                onClick={() => setMarketTab('all')}
              >
                All
              </button>
              <button
                className={`msp-tab ${marketTab === 'crypto' ? 'active' : ''}`}
                onClick={() => setMarketTab('crypto')}
              >
                Crypto
              </button>
              <button
                className={`msp-tab ${marketTab === 'rwa' ? 'active' : ''}`}
                onClick={() => setMarketTab('rwa')}
              >
                TradFi (RWA)
              </button>
              <button
                className={`msp-tab ${marketTab === 'forex' ? 'active' : ''}`}
                onClick={() => setMarketTab('forex')}
              >
                Forex
              </button>
              <button
                className={`msp-tab ${marketTab === 'watchlist' ? 'active' : ''}`}
                onClick={() => setMarketTab('watchlist')}
              >
                Watchlist
              </button>
            </div>

            {/* Table */}
            <div className="msp-table-wrapper">
              <table className="msp-table">
                <thead className="msp-thead">
                  <tr>
                    <th className="msp-th">Symbol</th>
                    <th className="msp-th msp-th-right">Price</th>
                    <th className="msp-th msp-th-right">24h Change</th>
                    <th className="msp-th msp-th-right desktop-col">24h Vol</th>
                    <th className="msp-th msp-th-right">Open Interest</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMarkets.map((m) => {
                    const isActive = m.id === activeMarketId
                    const leverage = `${m.maxLeverage}x`
                    const pairIdHash = m.pairHash.toLowerCase()
                    const realVolume = volumes[pairIdHash] || 0
                    
                    // Extract real OI from Goldsky
                    let realOI = 0
                    const stat = pairStats[pairIdHash]
                    if (stat) {
                      realOI = stat.longOI + stat.shortOI
                    }
                    const displayOI = realOI

                    return (
                      <tr
                        key={m.id}
                        className={`msp-row ${isActive ? 'msp-row-active' : ''}`}
                        onClick={() => {
                          setActiveMarket(m.id)
                          setMarketSelectorOpen(false)
                          setMarketSearch('')
                        }}
                      >
                        <td className="msp-td msp-td-pair">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleWatchlist(m.id);
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleWatchlist(m.id);
                              }}
                              style={{
                                position: 'relative',
                                background: 'none', border: 'none',
                                padding: '12px', margin: '-12px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', zIndex: 10
                              }}
                            >
                              <svg
                                width="14" height="14" viewBox="0 0 24 24"
                                fill={watchlist.includes(m.id) ? '#F7931A' : 'none'}
                                stroke={watchlist.includes(m.id) ? '#F7931A' : 'currentColor'}
                                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                style={{ color: 'var(--color-text3)' }}
                              >
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                              </svg>
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {getAssetLogo(m.pair) && (
                                <img src={getAssetLogo(m.pair)} alt={m.pair} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', background: m.category === 'crypto' ? 'transparent' : '#fff', padding: m.category === 'rwa' ? '2px' : '0' }} onError={(e) => e.currentTarget.style.display = 'none'} />
                              )}
                              <span style={{ fontWeight: 600 }}>{m.pair}</span>
                            </div>
                            <span style={{ fontSize: '9px', padding: '1px 3px', background: 'rgba(247, 147, 26, 0.1)', color: '#F7931A', borderRadius: '4px', fontWeight: 600 }}>{leverage}</span>
                          </div>
                        </td>
                        <td className="msp-td msp-td-price font-mono">{formatPrice(m.price)}</td>
                        <td className={`msp-td msp-td-change font-mono ${m.change24h >= 0 ? 'text-green' : 'text-red'}`}>
                          {m.change24h >= 0 ? '+' : ''}{m.change24h.toFixed(2)}%
                        </td>
                        <td className="msp-td msp-td-vol font-mono desktop-col">{formatVol(realVolume)}</td>
                        <td className="msp-td msp-td-oi font-mono">{formatOI(displayOI)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .topbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          width: 100%;
          z-index: 1100;
          background-color: #0b0e11;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: visible;
        }
        .topbar-inner {
          width: 100%;
          padding: 0 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .topbar-left {
          display: flex;
          align-items: center;
          gap: 24px;
          flex: 1;
        }
        .topbar-logo-wrapper {
          display: flex;
          align-items: center;
          height: 56px;
          flex-shrink: 0;
        }
        .mobile-menu-btn {
          display: none;
          background: none;
          border: none;
          color: var(--color-text1);
          cursor: pointer;
          padding: 4px;
        }
        .topbar-logo {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .topbar-brand {
          font-size: 18px;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: #fff;
        }
        .topbar-center {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
        }

        .mobile-only {
          display: none;
        }
        .topbar-nav {
          display: flex;
          align-items: center;
          gap: 24px;
        }
        .topbar-nav-link {
          padding: 8px 0;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
          text-decoration: none;
          transition: color 150ms ease;
        }
        .topbar-nav-link:hover {
          color: #fff;
        }
        .topbar-nav-link.active {
          color: #fff;
        }
        .topbar-right {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          flex: 1;
        }
        .btn-connect {
          padding: 6px 16px;
          font-size: 13px;
        }
        .btn-connect-unified {
          background-color: transparent !important;
          color: #26c68b !important;
          border: 1px solid rgba(38, 198, 139, 0.4) !important;
          border-radius: 4px !important;
          font-size: 13px;
          font-weight: 600;
          padding: 6px 14px;
          letter-spacing: 0.3px;
          cursor: pointer;
          transition: all 150ms;
        }
        .btn-connect-unified:hover {
          background-color: rgba(38, 198, 139, 0.1) !important;
          border-color: rgba(38, 198, 139, 0.6) !important;
        }
        .topbar-gas {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--color-text2);
        }
        .gas-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background-color: var(--color-green);
          box-shadow: 0 0 6px var(--color-green);
        }
        .topbar-account {
          position: relative;
        }
        .topbar-account-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px 4px 4px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 150ms;
          color: #fff;
          background-color: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
        }
        .topbar-account-btn:hover {
          background-color: rgba(255,255,255,0.06);
        }
        .topbar-avatar {
          width: 20px; height: 20px;
          border-radius: 4px;
          background: linear-gradient(135deg, #0052FF, #00d4aa, #0052FF);
          background-size: 200% 200%;
          animation: gradientShift 3s ease infinite;
        }
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .topbar-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 240px;
          background-color: var(--color-bg2);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid var(--color-border-strong);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-modal);
          overflow: hidden;
          z-index: 1000;
        }

        /* Mobile Drawer */
        .mobile-menu-backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(0,0,0,0.6);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 1200;
          display: flex;
          justify-content: flex-start;
          animation: fadeIn 250ms ease-out;
        }
        .mobile-menu-drawer {
          width: 80%;
          max-width: 300px;
          background-color: rgba(11, 14, 17, 0.95);
          height: 100dvh;
          display: flex;
          flex-direction: column;
          border-right: 1px solid rgba(255,255,255,0.06);
          box-shadow: 4px 0 24px rgba(0,0,0,0.5);
          animation: slideInLeft 300ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideInLeft {
          from { transform: translateX(-100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .mobile-menu-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .mobile-close-btn {
          background: none;
          border: none;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          transition: color 0.2s;
        }
        .mobile-close-btn:hover { color: #fff; }
        .mobile-menu-nav {
          display: flex;
          flex-direction: column;
          padding: 16px 0;
          gap: 4px;
          flex: 1;
          overflow-y: auto;
        }
        .mobile-nav-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 24px;
          font-size: 16px;
          font-weight: 500;
          color: rgba(255,255,255,0.5);
          text-decoration: none;
          border-left: 2px solid transparent;
          transition: all 0.2s;
        }
        .mobile-nav-link .nav-arrow {
          opacity: 0;
          transform: translateX(-8px);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .mobile-nav-link.active {
          color: #fff;
          background: linear-gradient(90deg, rgba(255,255,255,0.03) 0%, transparent 100%);
          border-left-color: #26c68b;
        }
        .mobile-nav-link.active .nav-arrow {
          opacity: 1;
          transform: translateX(0);
          color: #26c68b;
        }
        .mobile-menu-footer {
          padding: 24px;
          border-top: 1px solid rgba(255,255,255,0.06);
          background-color: rgba(255,255,255,0.01);
        }
        .mobile-socials a:hover {
          color: #fff !important;
        }

        /* ═══ Wide Market Selector Modal ═══ */
        .market-selector-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          z-index: 1200;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          animation: fadeIn 200ms ease;
        }
        .market-selector-panel {
          width: 100%;
          max-width: 680px;
          height: 100%;
          background-color: var(--color-bg0);
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--color-border-strong);
          animation: slideInLeft 250ms cubic-bezier(0.23, 1, 0.32, 1);
          box-shadow: 8px 0 48px rgba(0, 0, 0, 0.4);
          overflow: hidden;
        }

        /* Panel Header */
        .msp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid var(--color-border);
        }
        .msp-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--color-text1);
        }

        /* Search */
        .msp-search-wrapper {
          padding: 12px 12px 0;
        }
        .msp-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background-color: var(--color-bg2);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
        }
        .msp-search-input {
          width: 100%;
          font-size: 13px;
          color: var(--color-text1);
          background: transparent;
          border: none;
          outline: none;
          font-family: var(--font-ui);
        }
        .msp-search-input::placeholder {
          color: var(--color-text3);
        }

        /* Tabs */
        .msp-tabs {
          display: flex;
          gap: 16px;
          padding: 0 16px;
          border-bottom: 1px solid var(--color-border);
        }
        .msp-tab {
          background: transparent;
          border: none;
          color: var(--color-text3);
          font-size: 13px;
          font-weight: 500;
          padding: 10px 4px;
          cursor: pointer;
          transition: all 0.2s;
          border-bottom: 2px solid transparent;
        }
        .msp-tab:hover {
          color: var(--color-text1);
        }
        .msp-tab.active {
          color: #ffffff;
          border-bottom-color: #ffffff;
        }

        /* Table */
        .msp-table-wrapper {
          flex: 1;
          overflow-y: auto;
          overflow-x: auto;
          /* Removed padding-top to eliminate the empty gap */
        }
        .msp-table {
          width: 100%;
          text-align: left;
          border-collapse: collapse;
        }
        .msp-thead {
          position: sticky;
          top: 0;
          background-color: var(--color-bg0);
          z-index: 10;
          border-bottom: 1px solid var(--color-border);
        }
        .msp-th {
          font-size: 9px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--color-text3);
          padding: 8px 10px 6px 10px;
        }
        .msp-th-right {
          text-align: right;
        }
        .msp-row {
          cursor: pointer;
          transition: background-color 150ms;
          border-left: 2px solid transparent;
        }
        .msp-row:hover {
          background-color: var(--color-bg2);
        }
        .msp-row-active {
          background-color: var(--color-bg2);
          border-left-color: var(--color-accent);
        }
        .msp-td {
          padding: 8px 10px;
          font-size: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.02);
        }
        .msp-td-pair {
          font-weight: 500;
          color: var(--color-text1);
        }
        .msp-td-price {
          text-align: right;
          color: var(--color-text1);
          font-weight: 500;
        }
        .msp-td-change {
          text-align: right;
          font-weight: 500;
        }
        .msp-td-vol {
          text-align: right;
          color: var(--color-text2);
        }
        .msp-td-oi {
          text-align: right;
          color: var(--color-text1);
        }
        
        @media (max-width: 768px) {
          .msp-tabs {
            gap: 10px;
            padding: 0 10px;
            overflow-x: auto;
            white-space: nowrap;
          }
          .msp-tab {
            font-size: 11px;
            padding: 8px 2px;
          }
          .desktop-col {
            display: none;
          }
          .market-selector-panel {
            height: 100%;
            max-height: 100vh;
            border-radius: 0;
            border: none;
            width: 100%;
          }
          .market-selector-backdrop {
            padding: 0;
          }
          .msp-th {
            font-size: 8px;
            padding: 6px 4px;
            letter-spacing: 0.5px;
          }
          .msp-td {
            font-size: 10px;
            padding: 8px 4px;
          }
          .msp-td-pair img {
            width: 18px !important;
            height: 18px !important;
          }
          .msp-td-pair svg {
            width: 12px !important;
            height: 12px !important;
          }
          .msp-td-pair span {
            font-size: 11px !important;
          }
          .msp-td-pair button {
            padding: 8px !important;
            margin: -8px !important;
          }
          .msp-td-pair div {
            gap: 6px !important;
          }
        }

        /* ═══ Tablet Responsiveness (769px — 1024px) ═══ */
        @media (max-width: 1024px) and (min-width: 769px) {
          .topbar-nav {
            gap: 10px;
          }
          .topbar-nav-link {
            font-size: 13px;
          }
          .mobile-menu-btn {
            display: block;
          }
          .mobile-only {
            display: flex;
          }
          .topbar-left {
            flex: 0;
            gap: 12px;
          }
        }

        /* ═══ Mobile Responsiveness ═══ */
        @media (max-width: 768px) {
          .topbar {
            height: 60px;
          }
          .topbar-inner {
            padding: 0 16px;
            gap: 16px;
          }
          .topbar-left {
            gap: 12px;
            flex: 1;
          }
          .topbar-right {
            flex: 1;
            justify-content: flex-end;
          }
          .mobile-menu-btn {
            display: block;
          }
          .desktop-only {
            display: none !important;
          }
          .mobile-only {
            display: flex;
          }
          .btn-connect {
            display: none !important;
          }
          .topbar-account {
            display: none !important;
          }
        }
      `}</style>
    </header>
  )
}

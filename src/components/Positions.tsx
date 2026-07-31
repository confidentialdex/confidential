import { useState } from 'react'
import { keccak256, toHex } from 'viem'
import { useTradeStore } from '../store/useTradeStore'
import { useArcWallet } from '../hooks/useArcWallet'
import { useConfidentialTrading } from '../hooks/useConfidentialTrading'
import { usePositions, useOrders } from '../hooks/usePositions'
import { useClosedPositions, useTradeRecords } from '../hooks/useGoldsky'
import { BLOCK_EXPLORER_URL } from '../config/chain'

import SharePnLModal, { type SharePositionData } from './SharePnLModal'
import EditTpSlModal, { type EditTpSlData } from './EditTpSlModal'
import EditMarginModal, { type EditMarginData } from './EditMarginModal'
import PartialCloseModal, { type PartialCloseData } from './PartialCloseModal'

type Tab = 'balances' | 'positions' | 'orders' | 'trades'

export default function Positions() {
  const { markets } = useTradeStore()
  const { isConnected, balance, address, isInitializing } = useArcWallet()
  const [tab, setTab] = useState<Tab>('positions')
  const [selectedShare, setSelectedShare] = useState<SharePositionData | null>(null)
  const [selectedEditTpSl, setSelectedEditTpSl] = useState<EditTpSlData | null>(null)
  const [selectedEditMargin, setSelectedEditMargin] = useState<EditMarginData | null>(null)
  const [selectedPartialClose, setSelectedPartialClose] = useState<PartialCloseData | null>(null)

  const formatPrice = (p: number) => {
    if (!p) return '0.00'
    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    if (p >= 1) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 })
    return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 10 })
  }

  // Read from smart contract & Goldsky
  const { positions: activePositions, isLoading: isPositionsLoading } = usePositions(address || undefined)
  const { cancelOrder } = useConfidentialTrading()
  const { orders: openOrders, isLoading: isOrdersLoading } = useOrders(address || undefined)
  const { trades, isLoading: isTradesLoading } = useTradeRecords(address || undefined)
  const { closedPositions: historyPositions } = useClosedPositions(address || undefined)

  // Use on-chain positions for open positions tab
  const openPositions = activePositions
  // Filter out temporary market requests (2=MarketOpen, 3=MarketClose, 6=PartialClose, 7=RemoveCol) from Orders tab
  const displayOrders = openOrders.filter(o => o.orderType !== 2 && o.orderType !== 3 && o.orderType !== 6 && o.orderType !== 7)



  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'balances', label: 'Balances' },
    { id: 'positions', label: 'Positions' },
    { id: 'orders', label: 'Orders' },
    { id: 'trades', label: 'Trades' }
  ]

  return (
    <div className="positions-container">
      {/* Tabs */}
      <div className="pos-tabs">
        {TABS.map(t => (
          <button 
            key={t.id} 
            className={`pos-tab ${tab === t.id ? 'active' : ''}`} 
            onClick={() => setTab(t.id)}
          >
            {t.label} 
            {t.id === 'positions' && openPositions.length > 0 && <span className="tab-count">{openPositions.length}</span>}
            {t.id === 'orders' && displayOrders.length > 0 && <span className="tab-count">{displayOrders.length}</span>}
          </button>
        ))}
      </div>

      <div className="pos-content">
        {tab === 'balances' ? (
          <div className="pos-table-wrapper">
            {!isConnected ? (
              <div className="pos-empty">Please connect wallet to view balances</div>
            ) : (
              <>
                <div className="pos-header" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr', minWidth: '100%' }}>
                  <span>Asset</span>
                  <span>Total</span>
                  <span>Available</span>
                  <span>Value (USD)</span>
                </div>
                <div className="pos-row" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr', minWidth: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src="/usdc-arc.png" alt="USDC" style={{ width: 30, height: 30, flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>USDC</span>
                  </div>
                  <span className="font-mono">{balance.toFixed(2)}</span>
                  <span className="font-mono">{balance.toFixed(2)}</span>
                  <span className="font-mono">${balance.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        ) : tab === 'positions' ? (
          <div className="pos-table-wrapper">
            {isInitializing ? (
              <div className="pos-empty">Restoring session...</div>
            ) : !isConnected ? (
              <div className="pos-empty">Please connect wallet to view positions</div>
            ) : (
              <>
                <div className="pos-header" style={{ gridTemplateColumns: "100px 70px 80px 100px 100px 100px 80px 100px 280px", minWidth: "1010px" }}>
                  <span style={{ textAlign: 'left' }}>Market</span>
                  <span style={{ textAlign: 'left' }}>Side</span>
                  <span style={{ textAlign: 'center' }}>Size</span>
                  <span style={{ textAlign: 'center' }}>Entry Price</span>
                  <span style={{ textAlign: 'center' }}>Mark Price</span>
                  <span style={{ textAlign: 'center' }}>Liq. Price</span>
                  <span style={{ textAlign: 'center' }}>Margin</span>
                  <span style={{ textAlign: 'center' }}>TP / SL</span>
                  <span style={{ textAlign: 'center' }}>PnL</span>
                </div>
                {isPositionsLoading ? (
                  <div className="pos-empty">Loading positions...</div>
                ) : openPositions.length === 0 ? (
                  <div className="pos-empty">No open positions</div>
                ) : (
                  openPositions.map((p) => {
                    // Match pairId (Hash) to actual market to get live price and pair name
                    const matchedMarket = markets.find(m => keccak256(toHex(m.pair)) === p.pairId)
                    const pairName = matchedMarket ? matchedMarket.pair : p.pairId.slice(0, 10) + '...'
                    
                    const markPrice = matchedMarket && matchedMarket.price > 0 ? matchedMarket.price : p.entryPrice
                    const priceReady = matchedMarket && matchedMarket.price > 0
                    const sizeBaseAsset = p.entryPrice > 0 ? p.sizeUsd / p.entryPrice : 0
                    
                    // PnL Math — only calculate when live price is available and valid
                    const rawPnl = priceReady && sizeBaseAsset > 0
                      ? (p.isLong ? (markPrice - p.entryPrice) * sizeBaseAsset : (p.entryPrice - markPrice) * sizeBaseAsset) 
                      : 0
                    
                    // Estimated closing fee: 0.05% (takerFeeBps=5) of original sizeUsd — matches smart contract
                    const estClosingFee = p.sizeUsd * 0.0005
                    const pnl = rawPnl - estClosingFee
                    
                    const pnlPercent = p.collateral > 0 && isFinite(pnl) ? (pnl / p.collateral) * 100 : 0
                    
                    const liveTp = p.tpPrice || 0
                    const liveSl = p.slPrice || 0
                    
                    return (
                      <div key={p.id} className="pos-row" style={{ gridTemplateColumns: "100px 70px 80px 100px 100px 100px 80px 100px 280px", minWidth: "1010px" }}>
                        <span style={{ fontWeight: 600, textAlign: 'left' }}>{pairName}</span>
                        <span className={p.isLong ? 'text-green' : 'text-red'} style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 600, textAlign: 'left' }}>
                          {p.isLong ? 'long' : 'short'} {p.leverage}x
                        </span>
                        <span className="font-mono" style={{ textAlign: 'center' }}>{p.sizeUsd.toFixed(2)}</span>
                        <span className="font-mono" style={{ textAlign: 'center' }}>${formatPrice(p.entryPrice)}</span>
                        <span className="font-mono" style={{ textAlign: 'center' }}>${formatPrice(markPrice)}</span>
                        <span className="font-mono" style={{ color: 'var(--color-text2)', textAlign: 'center' }}>${formatPrice(p.liquidationPrice)}</span>
                        <span className="font-mono" style={{ textAlign: 'center' }}>${p.collateral.toFixed(2)}</span>
                        <span className="font-mono" style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', textAlign: 'center' }}>
                          <span style={{ color: liveTp > 0 ? 'var(--color-green)' : 'var(--color-text3)' }}>{liveTp > 0 ? `$${formatPrice(liveTp)}` : '-'}</span>
                          <span style={{ color: liveSl > 0 ? 'var(--color-red)' : 'var(--color-text3)' }}>{liveSl > 0 ? `$${formatPrice(liveSl)}` : '-'}</span>
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                          <span className={`font-mono ${pnl >= 0 ? 'text-green' : 'text-red'}`} style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button 
                              className={`btn-share ${p._isOptimistic ? 'opacity-50 cursor-not-allowed' : ''}`}
                              disabled={p._isOptimistic}
                              onClick={() => setSelectedEditMargin({
                                positionId: p.positionId,
                                pair: pairName,
                                pythPriceId: matchedMarket?.pythPriceId || '',
                                isLong: p.isLong,
                                currentMargin: p.collateral
                              })}
                              title="Edit Margin"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            <button 
                              className={`btn-share ${p._isOptimistic ? 'opacity-50 cursor-not-allowed' : ''}`}
                              disabled={p._isOptimistic}
                              onClick={() => setSelectedEditTpSl({
                                positionId: p.positionId,
                                pair: pairName,
                                isLong: p.isLong,
                                currentTp: liveTp,
                                currentSl: liveSl,
                                entryPrice: p.entryPrice,
                                leverage: Number(p.leverage) || 1
                              })}
                              title="Edit TP/SL"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            <button 
                              className="btn-share"
                              onClick={() => setSelectedShare({
                                pair: pairName,
                                side: p.isLong ? 'long' : 'short',
                                leverage: Number(p.leverage),
                                entryPrice: p.entryPrice,
                                markPrice: markPrice,
                                pnlPercent: pnlPercent,
                                pnlUsd: pnl
                              })}
                              title="Share PnL"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            <button 
                              disabled={p._isOptimistic}
                              onClick={() => setSelectedPartialClose({
                                positionId: p.positionId,
                                pair: pairName,
                                pythPriceId: matchedMarket?.pythPriceId || '',
                                isLong: p.isLong,
                                maxSize: p.sizeUsd
                              })} 
                              className={`btn-close ${p._isOptimistic ? 'opacity-50 cursor-not-allowed' : ''}`}
                              style={{ padding: '4px 8px', marginLeft: '4px' }}
                              title={p._isOptimistic ? "Pending execution on-chain..." : "Close position"}
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </>
            )}
          </div>
        ) : tab === 'orders' ? (
          <div className="pos-table-wrapper">
            {isInitializing ? (
              <div className="pos-empty">Restoring session...</div>
            ) : !isConnected ? (
              <div className="pos-empty">Please connect wallet to view open orders</div>
            ) : (
              <>
                <div className="pos-header" style={{ gridTemplateColumns: '170px 80px 70px 80px 90px 110px 110px 90px 210px', minWidth: '1010px', width: '100%' }}>
                  <span style={{ textAlign: 'left' }}>Time</span>
                  <span style={{ textAlign: 'left' }}>Market</span>
                  <span style={{ textAlign: 'center' }}>Side</span>
                  <span style={{ textAlign: 'center' }}>Type</span>
                  <span style={{ textAlign: 'center' }}>Size</span>
                  <span style={{ textAlign: 'center' }}>Price</span>
                  <span style={{ textAlign: 'center' }}>TP / SL</span>
                  <span style={{ textAlign: 'center' }}>Filled</span>
                  <span style={{ textAlign: 'center' }}>Action</span>
                </div>
                {isOrdersLoading ? (
                  <div className="pos-empty">Loading orders from Goldsky...</div>
                ) : displayOrders.length === 0 ? (
                  <div className="pos-empty">No open orders</div>
                ) : (
                  displayOrders.map((o) => {
                      const matchedMarket = markets.find(m => keccak256(toHex(m.pair)) === o.pairId)
                      const pairName = matchedMarket ? matchedMarket.pair : o.pairId.slice(0, 10) + '...'
                      
                    const tpPrice = o.tpPrice || 0
                    const slPrice = o.slPrice || 0
                    
                    return (
                    <div key={o.id} className="pos-row" style={{ gridTemplateColumns: '170px 80px 70px 80px 90px 110px 110px 90px 210px', minWidth: '1010px', width: '100%' }}>
                      <span style={{ color: 'var(--color-text3)', textAlign: 'left' }}>{formatTime(o.createdAt)}</span>
                      <span style={{ fontWeight: 600, textAlign: 'left' }}>{pairName}</span>
                      <span className={o.isLong ? 'text-green' : 'text-red'} style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 600, textAlign: 'center' }}>
                        {o.isLong ? 'long' : 'short'}
                      </span>
                      <span style={{ textTransform: 'capitalize', textAlign: 'center' }}>
                        {o.orderType === 0 ? 'Limit' : o.orderType === 1 ? 'Stop' : o.orderType === 4 ? 'TWAP' : 'Market'}
                      </span>
                      <span className="font-mono" style={{ textAlign: 'center' }}>{o.sizeUsd.toFixed(2)}</span>
                      <span className="font-mono" style={{ textAlign: 'center' }}>
                        {(o.orderType === 2 || o.orderType === 3 || o.orderType === 6) ? (
                          matchedMarket ? `$${formatPrice(matchedMarket.price)} (Market)` : 'Market'
                        ) : (
                          `$${formatPrice(o.triggerPrice)}`
                        )}
                      </span>
                      <span className="font-mono" style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', textAlign: 'center' }}>
                        <span style={{ color: tpPrice > 0 ? 'var(--color-green)' : 'var(--color-text3)' }}>{tpPrice > 0 ? `$${formatPrice(tpPrice)}` : '-'}</span>
                        <span style={{ color: slPrice > 0 ? 'var(--color-red)' : 'var(--color-text3)' }}>{slPrice > 0 ? `$${formatPrice(slPrice)}` : '-'}</span>
                      </span>
                      <span className="font-mono" style={{ textAlign: 'center' }}>0.00%</span>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <button 
                          disabled={o._isOptimistic}
                          title={o._isOptimistic ? "Pending execution on-chain..." : "Cancel Order"}
                          onClick={() => cancelOrder(BigInt(o.orderId))} 
                          className={`btn-close ${o._isOptimistic ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )})
                )}
              </>
            )}
          </div>
        ) : tab === 'trades' ? (
          <div className="pos-table-wrapper">
            {!isConnected ? (
              <div className="pos-empty">Please connect wallet to view activity</div>
            ) : (
              <>
                <div className="pos-header" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', minWidth: '800px' }}>
                  <span>Time</span>
                  <span style={{ textAlign: 'left' }}>Market</span>
                  <span style={{ textAlign: 'center' }}>Action</span>
                  <span style={{ textAlign: 'center' }}>Size</span>
                  <span style={{ textAlign: 'center' }}>Price</span>
                  <span style={{ textAlign: 'center' }}>Net PnL</span>
                  <span style={{ textAlign: 'center' }}>Tx Hash</span>
                </div>
                {isTradesLoading ? (
                  <div className="pos-empty">Loading activity from Goldsky...</div>
                ) : trades.length === 0 ? (
                  <div className="pos-empty">No trade activity</div>
                ) : (
                  trades.map((t) => {
                    const matchedMarket = markets.find(m => keccak256(toHex(m.pair)) === t.pairId)
                    const pairName = matchedMarket ? matchedMarket.pair : t.pairId.slice(0, 10) + '...'
                    
                    // Show PnL from TradeRecord directly if available, or fallback to history match
                    let pnlDisplay = '-'
                    let pnlColor = 'var(--color-text3)'
                    if (t.pnl !== undefined && (t.action === 'Close' || t.action === 'Liquidate' || t.action === 'PartialClose')) {
                      const isProfit = t.pnl >= 0
                      pnlDisplay = `${isProfit ? '+' : ''}$${t.pnl.toFixed(2)}`
                      pnlColor = isProfit ? 'var(--color-green)' : 'var(--color-red)'
                    } else if (t.action === 'Close' || t.action === 'Liquidate') {
                      const matchedPos = historyPositions.find(p => p.pairId === t.pairId && Math.abs((p.closedAt || 0) - t.timestamp) < 5000)
                      if (matchedPos && matchedPos.pnl !== undefined) {
                        const isProfit = matchedPos.pnl >= 0
                        pnlDisplay = `${isProfit ? '+' : ''}$${matchedPos.pnl.toFixed(2)}`
                        pnlColor = isProfit ? 'var(--color-green)' : 'var(--color-red)'
                      }
                    }

                    let displayAction = t.action;
                    let actionClass = 'text-accent';
                    
                    if (t.isLong !== undefined) {
                      const sideText = t.isLong ? 'Long' : 'Short';
                      if (t.action === 'Open') {
                        displayAction = `Open ${sideText}`;
                        actionClass = t.isLong ? 'text-green' : 'text-red';
                      } else if (t.action === 'Close') {
                        displayAction = `Close ${sideText}`;
                        actionClass = 'text-red';
                      } else if (t.action === 'Liquidate') {
                        displayAction = `Liquidate ${sideText}`;
                        actionClass = 'text-red';
                      } else if (t.action === 'PartialClose') {
                        displayAction = `Partial Close ${sideText}`;
                        actionClass = 'text-red';
                      } else if (t.action === 'Increase') {
                        displayAction = `Increase ${sideText}`;
                        actionClass = t.isLong ? 'text-green' : 'text-red';
                      } else if (t.action === 'AddCollateral') {
                        displayAction = 'Add Margin';
                        actionClass = 'text-accent';
                      } else if (t.action === 'RemoveCollateral') {
                        displayAction = 'Remove Margin';
                        actionClass = 'text-accent';
                      }
                    } else {
                      if (t.action === 'AddCollateral') displayAction = 'Add Margin';
                      if (t.action === 'RemoveCollateral') displayAction = 'Remove Margin';
                      if (t.action === 'PartialClose') displayAction = 'Partial Close';
                      actionClass = t.action === 'Open' ? 'text-green' : (t.action.includes('Close') || t.action === 'Liquidate') ? 'text-red' : 'text-accent';
                    }

                    return (
                    <div key={t.id} className="pos-row" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', minWidth: '800px' }}>
                      <span style={{ color: 'var(--color-text3)' }}>{formatTime(t.timestamp)}</span>
                      <span style={{ fontWeight: 600, textAlign: 'left' }}>{pairName}</span>
                      <span className={actionClass} style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 600, textAlign: 'center' }}>
                        {displayAction}
                      </span>
                      <span className="font-mono" style={{ textAlign: 'center' }}>{t.sizeUsd.toFixed(2)}</span>
                      <span className="font-mono" style={{ textAlign: 'center' }}>${formatPrice(t.price)}</span>
                      <span className="font-mono" style={{ textAlign: 'center', color: pnlColor, fontWeight: 600 }}>{pnlDisplay}</span>
                      <span className="font-mono text-accent" style={{ textAlign: 'center' }}>
                        <a href={`${BLOCK_EXPLORER_URL}/tx/${t.txHash}`} target="_blank" rel="noreferrer" style={{color:'inherit',textDecoration:'none'}}>View Tx</a>
                      </span>
                    </div>
                  )})
                )}
              </>
            )}
          </div>
        ) : null}
      </div>

      <style>{`
        .positions-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--color-bg0);
          border-top: 1px solid var(--color-border);
        }
        .pos-tabs {
          display: flex;
          background: var(--color-bg1);
          border-bottom: 1px solid var(--color-border);
          padding: 0 8px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .pos-tabs::-webkit-scrollbar { display: none; }
        .pos-tab {
          padding: 8px 10px;
          font-size: 11px;
          font-weight: 500;
          color: var(--color-text3);
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 150ms;
        }
        .pos-tab:hover {
          color: var(--color-text1);
        }
        .pos-tab.active {
          color: var(--color-text1);
          border-bottom-color: var(--color-green);
        }
        .tab-count {
          background: var(--color-bg3);
          color: var(--color-text1);
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 10px;
        }
        .pos-content {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .pos-empty {
          padding: 32px 16px;
          text-align: center;
          color: var(--color-text3);
          font-size: 13px;
        }
        .pos-table-wrapper {
          flex: 1;
          overflow-y: auto;
          overflow-x: auto;
          min-height: 0;
        }
        .pos-header {
          display: grid;
          grid-template-columns: minmax(0,1.2fr) minmax(0,0.8fr) minmax(0,1fr) minmax(0,1.3fr) minmax(0,1.3fr) minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.5fr) 110px;
          padding: 8px 16px;
          font-size: 11px;
          color: var(--color-text3);
          border-bottom: 1px solid var(--color-border);
          min-width: 1050px;
        }
        .pos-row {
          display: grid;
          grid-template-columns: minmax(0,1.2fr) minmax(0,0.8fr) minmax(0,1fr) minmax(0,1.3fr) minmax(0,1.3fr) minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.5fr) 110px;
          padding: 10px 16px;
          font-size: 12px;
          align-items: center;
          border-bottom: 1px solid var(--color-border);
          min-width: 1050px;
          transition: background-color 150ms;
        }
        .pos-row:hover {
          background-color: var(--color-bg2);
        }
        .btn-close {
          background: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-text2);
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          transition: all 150ms;
        }
        .btn-close:hover {
          background: var(--color-bg2);
          color: var(--color-text1);
          border-color: var(--color-text3);
        }
        .btn-share {
          background: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-text2);
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 150ms;
        }
        .btn-share:hover {
          background: var(--color-bg2);
          color: var(--color-text1);
          border-color: var(--color-text3);
        }

        @media (max-width: 768px) {
          .positions-container {
            height: auto;
            min-height: 160px;
            display: flex !important;
            flex-direction: column;
          }
          .pos-tabs {
            display: flex !important;
            justify-content: space-between;
            width: 100%;
            flex-shrink: 0;
            min-height: 36px;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            border-top: 2px solid var(--color-border);
            border-bottom: 1px solid var(--color-border);
            background: var(--color-bg1);
          }
          .pos-content {
            overflow: visible;
            flex-shrink: 0;
          }
          .pos-table-wrapper {
            overflow-x: auto;
            overflow-y: visible;
            -webkit-overflow-scrolling: touch;
          }
          .pos-tab {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: 10px 2px;
            font-size: 12px;
            white-space: nowrap;
          }
          .tab-count {
            flex-shrink: 0;
          }
          .pos-header, .pos-row {
            padding: 8px 12px;
          }
        }
      `}</style>

      {/* Share Modal */}
      <SharePnLModal 
        isOpen={!!selectedShare} 
        onClose={() => setSelectedShare(null)} 
        position={selectedShare} 
      />

      {/* Edit TP/SL Modal */}
      <EditTpSlModal
        isOpen={!!selectedEditTpSl}
        onClose={() => setSelectedEditTpSl(null)}
        data={selectedEditTpSl}
      />

      {/* Edit Margin Modal */}
      <EditMarginModal
        isOpen={!!selectedEditMargin}
        onClose={() => setSelectedEditMargin(null)}
        data={selectedEditMargin}
      />

      {/* Partial Close Modal */}
      <PartialCloseModal
        isOpen={!!selectedPartialClose}
        onClose={() => setSelectedPartialClose(null)}
        data={selectedPartialClose}
      />
    </div>
  )
}









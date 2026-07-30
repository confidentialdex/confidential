import { useTradeStore } from '../store/useTradeStore'
import { useTradeRecords } from '../hooks/useGoldsky'
import { BLOCK_EXPLORER_URL } from '../config/chain'


interface OrderBookProps {
  hideTabs?: boolean
}

export default function OrderBook({ hideTabs }: OrderBookProps = {}) {
  const { activeMarketId, markets } = useTradeStore()
  const { trades } = useTradeRecords()

  const activeMarket = markets.find((m) => m.id === activeMarketId)

  const formatPrice = (p: number) => {
    if (!activeMarket) return p.toFixed(2)
    if (activeMarket.price >= 10000) return p.toFixed(1)
    if (activeMarket.price >= 100) return p.toFixed(2)
    return p.toFixed(4)
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const activeMarketPairId = activeMarket ? activeMarket.pairHash : ''
  const realRecentTrades = trades
    .filter(t => t.pairId === activeMarketPairId && t.price > 0 && t.sizeUsd > 0)
    .slice(0, 50)
  
  return (
    <div className="orderbook-wrapper">
      {!hideTabs && (
        <div className="ob-tabs">
          <button className="ob-tab active" style={{ cursor: 'default' }}>
            Trades
          </button>
        </div>
      )}
      <div className="ob-header trades-header">
        <span>Price</span>
        <span>Size</span>
        <span>Time</span>
      </div>
      <div className="trades-list">
        {realRecentTrades.length === 0 ? (
          <div style={{ padding: 12, textAlign: 'center', color: 'var(--color-text3)', fontSize: 12 }}>No recent trades</div>
        ) : realRecentTrades.map((t) => {
          // Determine color based on trade direction (buying pressure vs selling pressure)
          let color = '#26a69a'; // TradingView green
          
          if (t.isLong !== undefined) {
            const isBuyingPressure = 
              (t.isLong && (t.action === 'Open' || t.action === 'Increase')) ||
              (!t.isLong && (t.action === 'Close' || t.action === 'Liquidate' || t.action === 'PartialClose'));
            color = isBuyingPressure ? '#26a69a' : '#ef5350';
          } else {
            color = t.action === 'Open' ? '#26a69a' : t.action === 'Liquidate' ? '#F7931A' : '#ef5350';
          }
          return (
            <div key={t.id} className="ob-row trade-row">
              <span className="font-mono" style={{ color }}>{formatPrice(t.price)}</span>
              <span className="font-mono" style={{ color: 'var(--color-text1)' }}>{(t.sizeUsd / t.price).toFixed(4)}</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', zIndex: 1 }}>
                <span className="font-mono" style={{ color: 'var(--color-text3)' }}>{formatTime(t.timestamp)}</span>
                <a href={`${BLOCK_EXPLORER_URL}/tx/${t.txHash}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', color: 'inherit' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </a>
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        .orderbook-wrapper {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: var(--color-bg1);
          border: 1px solid var(--color-border);
          border-radius: 8px;
        }
        .ob-tabs {
          display: flex;
          justify-content: center;
          border-bottom: 1px solid var(--color-border);
        }
        .ob-tab {
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text3);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 200ms;
        }
        .ob-tab:hover { color: var(--color-text2); }
        .ob-tab.active {
          color: #fff;
          border-bottom-color: #fff;
        }
        .ob-content {
          flex: 1;
          overflow-y: hidden;
          display: flex;
          flex-direction: column;
        }
        .ob-header {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr;
          padding: 6px 12px;
          font-size: 10px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--color-text3);
          border-bottom: 1px solid var(--color-border);
          position: sticky;
          top: 0;
          background-color: var(--color-bg1);
          z-index: 10;
          flex-shrink: 0;
        }
        .ob-header span:first-child { text-align: left; }
        .ob-header span:nth-child(2) { text-align: center; }
        .ob-header span:last-child { text-align: right; }
        
        .ob-row.ask > span:nth-child(2), .ob-row.bid > span:nth-child(2), .ob-row.trade-row > span:nth-child(1) { text-align: left; }
        .ob-row.ask > span:nth-child(3), .ob-row.bid > span:nth-child(3), .ob-row.trade-row > span:nth-child(2) { text-align: center; }
        .ob-row.ask > span:nth-child(4), .ob-row.bid > span:nth-child(4) { text-align: right; }
        .ob-row {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr;
          height: 30px;
          align-items: center;
          padding: 0 12px;
          font-size: 11px;
          position: relative;
          transition: background-color 100ms;
        }
        .ob-row:hover { background-color: var(--color-bg2); }
        .ob-row span { z-index: 1; }
        .ob-depth-bar {
          position: absolute;
          right: 0;
          top: 0;
          height: 100%;
          transition: width 300ms ease;
        }
        .ask-bar { background-color: rgba(224, 82, 82, 0.08); }
        .bid-bar { background-color: rgba(63, 176, 106, 0.08); }
        .ob-asks {
          display: flex;
          flex-direction: column;
          flex: 1;
          justify-content: flex-end;
          min-height: 0;
          overflow: hidden;
        }
        .ob-bids {
          display: flex;
          flex-direction: column;
          flex: 1;
          justify-content: flex-start;
          min-height: 0;
          overflow: hidden;
        }
        .ob-spread {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr;
          align-items: center;
          padding: 8px 12px;
          background-color: rgba(96, 165, 250, 0.05);
          border-top: 1px solid var(--color-border);
          border-bottom: 1px solid var(--color-border);
          z-index: 2;
        }
        .ob-spread > span:nth-child(1) { text-align: left; }
        .ob-spread > span:nth-child(2) { text-align: center; color: var(--color-text3); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
        .ob-spread > span:nth-child(3) { text-align: right; color: var(--color-text3); font-size: 11px; }
        .trade-row {
          grid-template-columns: 1.2fr 1fr 1fr;
          height: 30px;
        }
        .trades-list {
          flex: 1;
          overflow-y: auto;
        }

        @media (max-width: 768px) {
          .ob-content {
            overflow-y: auto;
          }
          .ob-header {
            font-size: 10px;
            padding: 2px 8px;
          }
          .ob-row {
            font-size: 11px;
            padding: 2px 8px;
            height: 22px;
          }
          .trade-row {
            font-size: 10px;
            height: 26px;
          }
          .ob-tab {
            font-size: 11px;
            padding: 8px 4px;
          }
          .ob-spread {
            height: 28px;
            padding: 4px 8px;
          }
          .ob-spread span:first-child {
            font-size: 12px !important;
          }
          .ob-spread span:last-child {
            font-size: 10px !important;
          }
        }
      `}</style>
    </div>
  )
}

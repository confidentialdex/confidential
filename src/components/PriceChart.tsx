import { useEffect, useRef, useState } from 'react'
import { useTradeStore } from '../store/useTradeStore'

let tvScriptLoadingPromise: Promise<void> | null = null

const getTVSymbol = (pythSymbol: string) => {
  const parts = pythSymbol.split('.')
  const cleanPair = parts[parts.length - 1].replace('/', '') // e.g., BTCUSD

  if (pythSymbol.startsWith('Crypto.')) {
    // Menggunakan datafeed asli Pyth Network di TradingView!
    return `PYTH:${cleanPair}`
  }
  
  if (pythSymbol.startsWith('Equity.US.')) {
    const symbol = parts[2].split('/')[0] // e.g. "AAPL"
    if (symbol === 'SPY') return 'AMEX:SPY'
    return `NASDAQ:${symbol}`
  }

  if (pythSymbol.startsWith('Metal.')) {
    return `OANDA:${cleanPair}`
  }

  if (pythSymbol.startsWith('FX.')) {
    // Menggunakan datafeed Pyth untuk Forex
    return `PYTH:${cleanPair}`
  }

  // Fallback
  return `PYTH:${cleanPair}`
}

export default function PriceChart() {
  const { markets, activeMarketId } = useTradeStore()
  const activeMarket = markets.find((m) => m.id === activeMarketId)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const [showFullscreenBtn, setShowFullscreenBtn] = useState(false)
  
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => {
    if (!activeMarket || !chartContainerRef.current) return;

    const tvSymbol = getTVSymbol(activeMarket.pythSymbol)
    setShowFullscreenBtn(false);
    let cancelled = false;

    const createWidget = () => {
      if (cancelled) return;
      // Clear container before recreating
      if (chartContainerRef.current) {
        chartContainerRef.current.innerHTML = '';
      }

      if ('TradingView' in window) {
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: tvSymbol,
          interval: "30",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          enable_publishing: false,
          gridColor: "rgba(255, 255, 255, 0.04)",
          hide_top_toolbar: false,
          hide_legend: true,
          save_image: true,
          hide_side_toolbar: false,
          allow_symbol_change: false, // We disable this so the header search is gone
          withdateranges: true,
          container_id: "tv_chart_container",
          favorites: {
            intervals: ["5", "60", "D", "W"]
          },
          disabled_features: [
            "header_symbol_search",
            "header_compare",
            "header_undo_redo",
            "header_saveload",
            "header_settings",
            "header_screenshot"
          ],
          studies_overrides: {
            "volume.volume.color.0": "rgba(224, 82, 82, 0.4)",
            "volume.volume.color.1": "rgba(63, 176, 106, 0.4)"
          },
          overrides: {
            "mainSeriesProperties.candleStyle.upColor": "#3FB06A",
            "mainSeriesProperties.candleStyle.downColor": "#E05252",
            "mainSeriesProperties.candleStyle.borderUpColor": "#3FB06A",
            "mainSeriesProperties.candleStyle.borderDownColor": "#E05252",
            "mainSeriesProperties.candleStyle.wickUpColor": "#3FB06A",
            "mainSeriesProperties.candleStyle.wickDownColor": "#E05252",
            "paneProperties.vertGridProperties.color": "rgba(255, 255, 255, 0)",
            "paneProperties.horzGridProperties.color": "rgba(255, 255, 255, 0.02)",
            "scalesProperties.textColor": "rgba(255, 255, 255, 0.4)",
            "scalesProperties.lineColor": "rgba(255, 255, 255, 0.06)",
          }
        });
      }
    };

    if (!tvScriptLoadingPromise) {
      tvScriptLoadingPromise = new Promise((resolve) => {
        const script = document.createElement('script');
        script.id = 'tradingview-widget-loading-script';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.type = 'text/javascript';
        script.onload = () => resolve();
        document.head.appendChild(script);
      });
    }

    tvScriptLoadingPromise.then(() => {
      if (!cancelled) {
        createWidget()
        setTimeout(() => {
          if (!cancelled) setShowFullscreenBtn(true)
        }, 3500)
      }
    });

    // Cleanup: prevent stale widget creation during HMR
    return () => {
      cancelled = true;
      if (chartContainerRef.current) {
        chartContainerRef.current.innerHTML = '';
      }
    };

  }, [activeMarket?.pythSymbol, isMobile]);

  if (!activeMarket) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-bg1)', position: 'relative' }}>
      {!isMobile && (
        <button
          onClick={(e) => {
            e.preventDefault();
            const elem = document.querySelector('.trade-center');
            if (elem) {
              if (!document.fullscreenElement) {
                elem.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen();
              }
            }
          }}
          style={{
            position: 'absolute',
            top: '3px',
            right: '44px',
            width: '36px',
            height: '34px',
            background: 'transparent',
            border: 'none',
            color: '#a3a6af',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            transition: 'opacity 0.5s ease, color 0.2s',
            opacity: showFullscreenBtn ? 1 : 0,
            pointerEvents: showFullscreenBtn ? 'auto' : 'none',
            boxShadow: 'none',
            padding: 0
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#d1d4dc'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#a3a6af'}
          title="Toggle Fullscreen"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>
      )}
      <div id="tv_chart_container" ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
      {/* Centered watermark — logo + Confidential (Binance style) */}
      <div
        style={{
          position: 'absolute',
          top: '42%',
          left: '50%',
          transform: 'translate(-50%, -50%) scaleY(1.15)',
          pointerEvents: 'none',
          zIndex: 5,
          userSelect: 'none',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: isMobile ? '6px' : '8px',
          opacity: 0.06,
        }}
      >
        <img
          src="/logo.png"
          alt=""
          draggable={false}
          style={{
            width: isMobile ? '28px' : '40px',
            height: isMobile ? '28px' : '40px',
            borderRadius: '50%',
            objectFit: 'contain',
            filter: 'grayscale(100%) brightness(3)',
          }}
        />
        <span
          style={{
            fontSize: isMobile ? '20px' : '28px',
            fontWeight: 600,
            letterSpacing: '3px',
            color: '#FFFFFF',
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            textTransform: 'uppercase',
          }}
        >
          Confidential
        </span>
      </div>
    </div>
  )
}

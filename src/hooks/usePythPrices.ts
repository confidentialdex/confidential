import { useEffect, useRef } from 'react'
import { useTradeStore } from '../store/useTradeStore'

const HERMES_URL = 'https://hermes.pyth.network/v2/updates/price/latest'

/**
 * Fetches real-time prices from Pyth Hermes API and updates the trade store.
 * Replaces the old useMockPrices hook — no more random data!
 */
export function usePythPrices() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    async function fetchPrices() {
      const state = useTradeStore.getState()
      const markets = state.markets

      // Build query string with all Pyth price IDs
      const ids = markets.map((m) => `ids[]=${m.pythPriceId}`).join('&')
      const url = `${HERMES_URL}?${ids}`

      try {
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json()

        if (!data.parsed || !Array.isArray(data.parsed)) return

        for (const feed of data.parsed) {
          const id = feed.id as string
          const market = markets.find((m) => m.pythPriceId === id)
          if (!market) continue

          const priceData = feed.price
          if (!priceData) continue

          // Convert Pyth price: price * 10^expo
          const rawPrice = Number(priceData.price)
          const rawConf = Number(priceData.conf || 0)
          const expo = Number(priceData.expo)
          const newPrice = Number(rawPrice * Math.pow(10, expo))
          const newConf = Number(rawConf * Math.pow(10, expo))

          if (newPrice > 0) {
            // On first load, also set high/low/prevPrice
            if (!initializedRef.current || market.price === 0) {
              const currentState = useTradeStore.getState()
              const updatedMarkets = currentState.markets.map((m) =>
                m.id === market.id
                  ? {
                      ...m,
                      price: newPrice,
                      conf: newConf,
                      prevPrice: newPrice,
                      change24h: 0,
                      high24h: newPrice * 1.005,
                      low24h: newPrice * 0.995,
                      lastUpdate: Date.now(),
                    }
                  : m
              )
              useTradeStore.setState({ markets: updatedMarkets })
            } else {
              state.updateMarketPrice(market.id, newPrice, newConf)
            }
          }
        }

        // Fetch historical prices once to get accurate 24h change
        // We fetch per-ID because Hermes V2 historical bulk fetch fails if even ONE ID is missing data.
        if (!initializedRef.current) {
          const ts = Math.floor(Date.now() / 1000) - 86400
          
          Promise.allSettled(
            markets.map(async (m) => {
              const histUrl = `https://hermes.pyth.network/v2/updates/price/${ts}?ids[]=${m.pythPriceId}`
              const histRes = await fetch(histUrl)
              if (!histRes.ok) throw new Error('Failed')
              const histData = await histRes.json()
              if (histData.parsed && histData.parsed.length > 0) {
                const feed = histData.parsed[0]
                if (feed.price) {
                  return {
                    id: m.pythPriceId,
                    price: Number(feed.price.price) * Math.pow(10, Number(feed.price.expo))
                  }
                }
              }
              throw new Error('No data')
            })
          ).then((results) => {
            const histPrices: Record<string, number> = {}
            for (const result of results) {
              if (result.status === 'fulfilled' && result.value.price > 0) {
                histPrices[result.value.id] = result.value.price
              }
            }
            if (Object.keys(histPrices).length > 0) {
              useTradeStore.getState().setMarketHistoricalPrices(histPrices)
            }
          }).catch((e) => console.warn('[Pyth] Historical batch error', e))
        }

        initializedRef.current = true

        // Refresh order book for active market
        useTradeStore.getState().refreshOrderBook()

        // Add a simulated recent trade based on real price
        const activeMarket = useTradeStore.getState().markets.find(
          (m) => m.id === useTradeStore.getState().activeMarketId
        )
        if (activeMarket && activeMarket.price > 0) {
          const side = Math.random() > 0.5 ? 'buy' : 'sell'
          useTradeStore.getState().addRecentTrade({
            id: `trade-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            time: Date.now(),
            side: side as 'buy' | 'sell',
            price: +(activeMarket.price + (Math.random() - 0.5) * activeMarket.price * 0.0003).toFixed(2),
            size: +(Math.random() * 3 + 0.01).toFixed(4),
          })
        }

        // Update position PnL with real prices
        useTradeStore.getState().updatePositionPnl()
      } catch (err) {
        // Silently fail — will retry next interval
        console.warn('[Pyth] Price fetch failed:', err)
      }
    }

    // Fetch immediately on mount
    fetchPrices()

    // Then poll every 2 seconds
    intervalRef.current = setInterval(fetchPrices, 2000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])
}

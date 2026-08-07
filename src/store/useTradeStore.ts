import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Market, Order, Position, RecentTrade, VaultDeposit, OrderBookEntry } from '../types'

const INITIAL_MARKETS: Market[] = [
  // Crypto Perps
  { id: 'btc-usdc', pair: 'BTC/USDC', pairHash: '0x9282eb09b844791118907b4cb066e6f9d167435f2382166b9e3594bcb4072bde', baseAsset: 'BTC', quoteAsset: 'USDC', category: 'crypto', pythPriceId: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43', pythSymbol: 'Crypto.BTC/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 100 },
  { id: 'eth-usdc', pair: 'ETH/USDC', pairHash: '0x7ea41243798f304c9efd5c2e0c82a273090146c4718014ecc8570eb373df2b78', baseAsset: 'ETH', quoteAsset: 'USDC', category: 'crypto', pythPriceId: 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', pythSymbol: 'Crypto.ETH/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 100 },
  { id: 'sol-usdc', pair: 'SOL/USDC', pairHash: '0x8c150dc41be8440d68c984f2397e7bebbdd5bf5a41f46cc17a0cc9e2e7817e44', baseAsset: 'SOL', quoteAsset: 'USDC', category: 'crypto', pythPriceId: 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d', pythSymbol: 'Crypto.SOL/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 100 },
  { id: 'link-usdc', pair: 'LINK/USDC', pairHash: '0x611c2dc3263a81a38084fe797d493e265849b95eb37c0783f9cd14f3ee6bf2ce', baseAsset: 'LINK', quoteAsset: 'USDC', category: 'crypto', pythPriceId: '8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221', pythSymbol: 'Crypto.LINK/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 50 },
  { id: 'arb-usdc', pair: 'ARB/USDC', pairHash: '0x03215667d1bb59691ce7c643da08f810a423e31cff1dee5ad4412e21365de428', baseAsset: 'ARB', quoteAsset: 'USDC', category: 'crypto', pythPriceId: '3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5', pythSymbol: 'Crypto.ARB/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 50 },
  { id: 'doge-usdc', pair: 'DOGE/USDC', pairHash: '0x5c829abc1e674ea2caa9b7b9778e8e06daec29ae375366d2d7626df4d70648ba', baseAsset: 'DOGE', quoteAsset: 'USDC', category: 'crypto', pythPriceId: 'dcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c', pythSymbol: 'Crypto.DOGE/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 50 },
  { id: 'pepe-usdc', pair: 'PEPE/USDC', pairHash: '0x2876c50266ba1a6a5d9e393ca29cfa8bcec325800655e2d1a8efaad6319173b4', baseAsset: 'PEPE', quoteAsset: 'USDC', category: 'crypto', pythPriceId: 'd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4', pythSymbol: 'Crypto.PEPE/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 50 },
  { id: 'wif-usdc', pair: 'WIF/USDC', pairHash: '0x77cb81e2ea250dc4fc5aaccd9d256377c4baf30979927c78939f60c1065e32f5', baseAsset: 'WIF', quoteAsset: 'USDC', category: 'crypto', pythPriceId: '4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc', pythSymbol: 'Crypto.WIF/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 50 },
  { id: 'sui-usdc', pair: 'SUI/USDC', pairHash: '0x6bd6cbbbc6b132c04ed97aeb9fae3b375fc78ee3b4a39f70f9b208cd3b7f732d', baseAsset: 'SUI', quoteAsset: 'USDC', category: 'crypto', pythPriceId: '23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744', pythSymbol: 'Crypto.SUI/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 50 },
  { id: 'apt-usdc', pair: 'APT/USDC', pairHash: '0x98ca01b691a198f1de86ed7ad3eb4f5d5eaf99a8456d849e78137de6b4100e7b', baseAsset: 'APT', quoteAsset: 'USDC', category: 'crypto', pythPriceId: '03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5', pythSymbol: 'Crypto.APT/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 50 },
  { id: 'avax-usdc', pair: 'AVAX/USDC', pairHash: '0x112fa91bfa10920833d9dd3e97b7313594994efb0741deb72c0c27110456bfc1', baseAsset: 'AVAX', quoteAsset: 'USDC', category: 'crypto', pythPriceId: '93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7', pythSymbol: 'Crypto.AVAX/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 50 },
  { id: 'bnb-usdc', pair: 'BNB/USDC', pairHash: '0x21878c0ff3a2aa21078f382ad4d5ccea0f40b07b4a0223072705622f8949da8e', baseAsset: 'BNB', quoteAsset: 'USDC', category: 'crypto', pythPriceId: '2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f', pythSymbol: 'Crypto.BNB/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 50 },
  { id: 'xrp-usdc', pair: 'XRP/USDC', pairHash: '0x86fee4c3b0e6ba5100f97596f82f21f126f92aac872cfb565ba0a82c663530cb', baseAsset: 'XRP', quoteAsset: 'USDC', category: 'crypto', pythPriceId: 'ec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8', pythSymbol: 'Crypto.XRP/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 50 },
  { id: 'near-usdc', pair: 'NEAR/USDC', pairHash: '0x99e8a99b0169d610cfbfd804d1b32116887a469abba9bbbf0fd80b699a88ade3', baseAsset: 'NEAR', quoteAsset: 'USDC', category: 'crypto', pythPriceId: 'c415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750', pythSymbol: 'Crypto.NEAR/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 50 },
  // RWA Perps
  { id: 'aapl-usdc', pair: 'AAPL/USDC', pairHash: '0x85a026c7f22c86be6b23fcde9d1718b0c6d59666e75718fd52031204960e2219', baseAsset: 'AAPL', quoteAsset: 'USDC', category: 'rwa', pythPriceId: '49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688', pythSymbol: 'Equity.US.AAPL/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 20 },
  { id: 'tsla-usdc', pair: 'TSLA/USDC', pairHash: '0xb852bdfc5816c02e359583cd50a02307311d17e0da406a1b95dd1d0cb721b55b', baseAsset: 'TSLA', quoteAsset: 'USDC', category: 'rwa', pythPriceId: '16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1', pythSymbol: 'Equity.US.TSLA/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 20 },
  { id: 'gold-usdc', pair: 'GOLD/USDC', pairHash: '0x6dcde08c8d8ae4b9083c333237c93a3c3c7d0667a0169fe17f2207a88b339b87', baseAsset: 'GOLD', quoteAsset: 'USDC', category: 'rwa', pythPriceId: '765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2', pythSymbol: 'Metal.XAU/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 50 },
  { id: 'silver-usdc', pair: 'SILVER/USDC', pairHash: '0x9bd2ebf8df5e3ce05c36cb1ad3a8cce7fac68e6cc91e5f64b13aa0702278e264', baseAsset: 'SILVER', quoteAsset: 'USDC', category: 'rwa', pythPriceId: 'f2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e', pythSymbol: 'Metal.XAG/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 50 },
  { id: 'spy-usdc', pair: 'SPY/USDC', pairHash: '0x1d7f66a9d126dcb5f420083b1124fdc4e8d9120e2a27981f5b55911204de7cf3', baseAsset: 'SPY', quoteAsset: 'USDC', category: 'rwa', pythPriceId: '19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5', pythSymbol: 'Equity.US.SPY/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 20 },
  { id: 'nvda-usdc', pair: 'NVDA/USDC', pairHash: '0x4f1f72a5660fa9f72dacd80703a6887c19bdb4c1a772b8d152e1c6f390cc5ec4', baseAsset: 'NVDA', quoteAsset: 'USDC', category: 'rwa', pythPriceId: 'b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593', pythSymbol: 'Equity.US.NVDA/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 20 },
  // Forex Perps
  { id: 'eur-usdc', pair: 'EUR/USDC', pairHash: '0x0bf8cece76b52d089b467dcb76c47a9d006c793576ac9fd395904ff387f26424', baseAsset: 'EUR', quoteAsset: 'USDC', category: 'forex', pythPriceId: 'a995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b', pythSymbol: 'FX.EUR/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 100 },
  { id: 'gbp-usdc', pair: 'GBP/USDC', pairHash: '0x246714b28d3c5cd9430660b13094494b1deb5e38746aaa54a3c74688d4fb743c', baseAsset: 'GBP', quoteAsset: 'USDC', category: 'forex', pythPriceId: '84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1', pythSymbol: 'FX.GBP/USD', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 100 },
  { id: 'usdjpy-usdc', pair: 'USDJPY/USDC', pairHash: '0xa284836b0532e4fb6dd55b70649bdb9c7b71674e104c7bba0dba833f2b9bd1ef', baseAsset: 'USDJPY', quoteAsset: 'USDC', category: 'forex', pythPriceId: 'ef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52', pythSymbol: 'FX.USD/JPY', price: 0, prevPrice: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, openInterest: 0, maxLeverage: 100 },
]

function generateOrderBook(midPrice: number): { bids: OrderBookEntry[]; asks: OrderBookEntry[] } {
  const spread = midPrice * 0.0002
  const bids: OrderBookEntry[] = []
  const asks: OrderBookEntry[] = []
  let bidTotal = 0
  let askTotal = 0

  for (let i = 0; i < 8; i++) {
    const bidPrice = midPrice - spread * (i + 1) - Math.random() * spread * 0.5
    const bidSize = +(Math.random() * 5 + 0.1).toFixed(4)
    bidTotal += bidSize
    bids.push({ price: +bidPrice.toFixed(2), size: bidSize, total: +bidTotal.toFixed(4) })

    const askPrice = midPrice + spread * (i + 1) + Math.random() * spread * 0.5
    const askSize = +(Math.random() * 5 + 0.1).toFixed(4)
    askTotal += askSize
    asks.unshift({ price: +askPrice.toFixed(2), size: askSize, total: +askTotal.toFixed(4) })
  }

  // Recalculate totals for asks (they are reversed)
  let runTotal = 0
  for (let i = asks.length - 1; i >= 0; i--) {
    runTotal += asks[i].size
    asks[i].total = +runTotal.toFixed(4)
  }

  return { bids, asks }
}



interface TradeStore {
  // Markets
  markets: Market[]
  activeMarketId: string
  watchlist: string[]
  setActiveMarket: (id: string) => void
  toggleWatchlist: (id: string) => void
  updateMarketPrice: (id: string, price: number, conf?: number) => void
  setMarketHistoricalPrices: (prices: Record<string, number>) => void
  updateMarketVolume: (pairHash: string, volume24h: number) => void

  // Order Book
  orderBook: { bids: OrderBookEntry[]; asks: OrderBookEntry[] }
  refreshOrderBook: () => void

  // Recent Trades
  recentTrades: RecentTrade[]
  addRecentTrade: (trade: RecentTrade) => void

  // Orders
  orders: Order[]
  placeOrder: (order: Omit<Order, 'id' | 'status' | 'timestamp'>) => void
  cancelOrder: (id: string) => void

  // Positions
  positions: Position[]
  addPosition: (position: Omit<Position, 'id' | 'openedAt' | 'status'>) => void
  closePosition: (id: string) => void
  updatePositionPnl: () => void

  // Vault
  vaultDeposits: VaultDeposit[]
  vaultBalance: number
  vaultTVL: number
  vaultAPY: number
  depositToVault: (amount: number) => void
  withdrawFromVault: (amount: number) => void

  // UI State
  isMarketSelectorOpen: boolean
  setMarketSelectorOpen: (open: boolean) => void
  selectedTimeframe: string
  setSelectedTimeframe: (tf: string) => void
  mobileNav: 'markets' | 'trade' | 'vaults' | 'account'
  setMobileNav: (nav: 'markets' | 'trade' | 'vaults' | 'account') => void
  marketCategoryFilter: 'all' | 'crypto' | 'rwa' | 'forex' | 'watchlist'
  setMarketCategoryFilter: (filter: 'all' | 'crypto' | 'rwa' | 'forex' | 'watchlist') => void

  // Mock wallet balance
  mockBalance: number
}

export const useTradeStore = create<TradeStore>()(
  persist(
    (set, get) => ({
      // Markets
      markets: INITIAL_MARKETS,
      activeMarketId: 'btc-usdc',
      watchlist: [],
      setActiveMarket: (id) => {
        set({ activeMarketId: id })
        get().refreshOrderBook()
      },
      toggleWatchlist: (id) => set((state) => ({
        watchlist: state.watchlist.includes(id) 
          ? state.watchlist.filter(w => w !== id) 
          : [...state.watchlist, id]
      })),
      updateMarketPrice: (id, price, conf) => {
        set((state) => ({
          markets: state.markets.map((m) =>
            m.id === id
              ? {
                  ...m,
                  // Do not overwrite prevPrice! It represents the 24h old price.
                  price,
                  conf: conf ?? m.conf,
                  change24h: m.prevPrice > 0 ? +(((price - m.prevPrice) / m.prevPrice) * 100).toFixed(2) : 0,
                  high24h: Math.max(m.high24h, price),
                  low24h: m.low24h > 0 ? Math.min(m.low24h, price) : price,
                  lastUpdate: Date.now(),
                }
              : m
          ),
        }))
      },
      setMarketHistoricalPrices: (prices) => {
        set((state) => ({
          markets: state.markets.map((m) => {
            const historicalPrice = prices[m.pythPriceId]
            if (historicalPrice) {
              return {
                ...m,
                prevPrice: historicalPrice,
                // Recalculate change24h immediately if we already have a current price
                change24h: m.price > 0 ? +(((m.price - historicalPrice) / historicalPrice) * 100).toFixed(2) : 0
              }
            }
            return m
          })
        }))
      },
      updateMarketVolume: (pairHash, volume24h) => {
        set((state) => ({
          markets: state.markets.map((m) =>
            m.pairHash.toLowerCase() === pairHash.toLowerCase() ? { ...m, volume24h } : m
          ),
        }))
      },

      // Order Book
      orderBook: generateOrderBook(100),  // Placeholder — refreshed when Pyth prices load
      refreshOrderBook: () => {
        const market = get().markets.find((m) => m.id === get().activeMarketId)
        if (market) {
          set({ orderBook: generateOrderBook(market.price) })
        }
      },

      // Recent Trades
      recentTrades: [],  // Populated when Pyth prices start streaming
      addRecentTrade: (trade) => {
        set((state) => ({
          recentTrades: [trade, ...state.recentTrades.slice(0, 19)],
        }))
      },

      // Orders
      orders: [],
      placeOrder: (orderData) => {
        const id = `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const order: Order = {
          ...orderData,
          id,
          status: orderData.type === 'market' ? 'filled' : 'open',
          timestamp: Date.now(),
          filledAt: orderData.type === 'market' ? Date.now() : undefined,
        }
        set((state) => ({ orders: [order, ...state.orders] }))

        // For market orders, auto-create position
        if (order.type === 'market') {
          const market = get().markets.find((m) => m.id === order.marketId)
          if (market) {
            const collateral = (order.price * order.size) / order.leverage
            const liqMultiplier = order.side === 'long' ? 1 - 0.9 / order.leverage : 1 + 0.9 / order.leverage
            get().addPosition({
              marketId: order.marketId,
              pair: order.pair,
              side: order.side,
              size: order.size,
              entryPrice: order.price,
              markPrice: order.price,
              leverage: order.leverage,
              liquidationPrice: +(order.price * liqMultiplier).toFixed(2),
              pnl: 0,
              pnlPercent: 0,
              collateral: +collateral.toFixed(2),
            })
          }
        }
      },
      cancelOrder: (id) => {
        set((state) => ({
          orders: state.orders.map((o) => (o.id === id ? { ...o, status: 'cancelled' as const } : o)),
        }))
      },

      // Positions
      positions: [],
      addPosition: (posData) => {
        const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const position: Position = {
          ...posData,
          id,
          status: 'open',
          openedAt: Date.now(),
        }
        set((state) => ({ positions: [position, ...state.positions] }))
      },
      closePosition: (id) => {
        set((state) => ({
          positions: state.positions.map((p) =>
            p.id === id ? { ...p, status: 'closed' as const, closedAt: Date.now() } : p
          ),
        }))
      },
      updatePositionPnl: () => {
        const markets = get().markets
        set((state) => ({
          positions: state.positions.map((p) => {
            if (p.status === 'closed') return p
            const market = markets.find((m) => m.id === p.marketId)
            if (!market) return p
            const markPrice = market.price
            const rawPnl = p.side === 'long'
              ? (markPrice - p.entryPrice) * p.size
              : (p.entryPrice - markPrice) * p.size
            // Closing fee: 0.05% of original sizeUsd (entryPrice * size) — matches smart contract
            const sizeUsd = p.entryPrice * p.size
            const closingFee = sizeUsd * 0.0005
            const pnl = rawPnl - closingFee
            const pnlPercent = (pnl / p.collateral) * 100
            return { ...p, markPrice, pnl: +pnl.toFixed(2), pnlPercent: +pnlPercent.toFixed(2) }
          }),
        }))
      },

      // Vault
      vaultDeposits: [],
      vaultBalance: 0,
      vaultTVL: 12_450_000,
      vaultAPY: 8.42,
      depositToVault: (amount) => {
        const deposit: VaultDeposit = {
          id: `vd-${Date.now()}`,
          action: 'deposit',
          amount,
          timestamp: Date.now(),
          txHash: `0x${Math.random().toString(16).slice(2, 66)}`,
        }
        set((state) => ({
          vaultDeposits: [deposit, ...state.vaultDeposits],
          vaultBalance: state.vaultBalance + amount,
          vaultTVL: state.vaultTVL + amount,
          mockBalance: state.mockBalance - amount,
        }))
      },
      withdrawFromVault: (amount) => {
        const withdrawal: VaultDeposit = {
          id: `vd-${Date.now()}`,
          action: 'withdraw',
          amount,
          timestamp: Date.now(),
          txHash: `0x${Math.random().toString(16).slice(2, 66)}`,
        }
        set((state) => ({
          vaultDeposits: [withdrawal, ...state.vaultDeposits],
          vaultBalance: Math.max(0, state.vaultBalance - amount),
          vaultTVL: state.vaultTVL - amount,
          mockBalance: state.mockBalance + amount,
        }))
      },

      // UI State
      isMarketSelectorOpen: false,
      setMarketSelectorOpen: (open) => set({ isMarketSelectorOpen: open }),
      selectedTimeframe: '1h',
      setSelectedTimeframe: (tf) => set({ selectedTimeframe: tf }),
      mobileNav: 'markets',
      setMobileNav: (nav) => set({ mobileNav: nav }),
      marketCategoryFilter: 'all',
      setMarketCategoryFilter: (filter) => set({ marketCategoryFilter: filter }),

      // Mock wallet balance
      mockBalance: 1200,
    }), {
      name: 'arc-trade-storage',
      version: 8,
      partialize: (state) => ({
        // Only persist user-specific data, NOT live market data
        activeMarketId: state.activeMarketId,
        watchlist: state.watchlist,
        orders: state.orders,
        positions: state.positions,
        vaultDeposits: state.vaultDeposits,
        vaultBalance: state.vaultBalance,
        mockBalance: state.mockBalance,
        selectedTimeframe: state.selectedTimeframe,
      }),
      migrate: () => {
        // v8: Add watchlist state
        return {}
      },
}))

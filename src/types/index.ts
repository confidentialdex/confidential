export type MarketCategory = 'crypto' | 'rwa' | 'forex';
export type OrderSide = 'long' | 'short';
export type OrderType = 'limit' | 'market' | 'twap' | 'stop market' | 'stop limit';
export type OrderStatus = 'open' | 'filled' | 'cancelled';
export type PositionStatus = 'open' | 'closed';

export interface Market {
  id: string;
  pair: string;
  baseAsset: string;
  quoteAsset: string;
  category: MarketCategory;
  pythPriceId: string;
  pythSymbol: string;
  pairHash: string;
  price: number;
  prevPrice: number;
  conf?: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  openInterest: number;
  maxLeverage: number;
  lastUpdate?: number;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookEntry {
  price: number;
  size: number;
  total: number;
}

export interface Order {
  id: string;
  marketId: string;
  pair: string;
  side: OrderSide;
  type: OrderType;
  price: number;
  size: number;
  leverage: number;
  status: OrderStatus;
  timestamp: number;
  filledAt?: number;
}

export interface Position {
  id: string;
  marketId: string;
  pair: string;
  side: OrderSide;
  size: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  liquidationPrice: number;
  pnl: number;
  pnlPercent: number;
  collateral: number;
  status: PositionStatus;
  openedAt: number;
  closedAt?: number;
}

export interface RecentTrade {
  id: string;
  time: number;
  side: 'buy' | 'sell';
  price: number;
  size: number;
}

export interface VaultDeposit {
  id: string;
  action: 'deposit' | 'withdraw';
  amount: number;
  timestamp: number;
  txHash: string;
}

export interface BridgeTransaction {
  id: string;
  fromChain: string;
  toChain: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  timestamp: number;
  txHash: string;
  estimatedTime: number;
}

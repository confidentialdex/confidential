/**
 * ═══════════════════════════════════════════════════════════════
 *  Confidential DEX — Pairs Configuration (Single Source of Truth)
 * ═══════════════════════════════════════════════════════════════
 *
 * This file defines ALL trading pairs, Pyth feed IDs, leverage tiers,
 * and OI limits for the Confidential DEX protocol.
 *
 * Used by: deploy_v1.js, setup_all_pairs.js, update_leverages.js
 *
 * Leverage Tiers (per docs/trading/fees-and-impact.md):
 *   Tier 1 — Major Crypto + Forex:  100x, $10M OI (crypto) / $5M OI (forex)
 *   Tier 2 — Altcoins + Commodities: 50x, $5M OI
 *   Tier 3 — Stock Indices:           20x, $5M OI
 */

// ── Tier 1: Major Crypto (100x leverage, $10M OI per side) ──
const TIER1_CRYPTO = [
  { name: 'BTC/USDC',  pythFeedId: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43' },
  { name: 'ETH/USDC',  pythFeedId: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace' },
  { name: 'SOL/USDC',  pythFeedId: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d' },
].map(p => ({ ...p, maxLeverage: 100, maxOI: '10000000', tier: 1 }));

// ── Tier 1: Forex (100x leverage, $5M OI per side) ──
const TIER1_FOREX = [
  { name: 'EUR/USDC',    pythFeedId: '0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b' },
  { name: 'GBP/USDC',    pythFeedId: '0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1' },
  { name: 'USDJPY/USDC', pythFeedId: '0xef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52' },
].map(p => ({ ...p, maxLeverage: 100, maxOI: '5000000', tier: 1 }));

// ── Tier 2: Altcoins (50x leverage, $5M OI per side) ──
const TIER2_ALTCOINS = [
  { name: 'BNB/USDC',  pythFeedId: '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f' },
  { name: 'XRP/USDC',  pythFeedId: '0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8' },
  { name: 'LINK/USDC', pythFeedId: '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221' },
  { name: 'ARB/USDC',  pythFeedId: '0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5' },
  { name: 'AVAX/USDC', pythFeedId: '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7' },
  { name: 'SUI/USDC',  pythFeedId: '0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744' },
  { name: 'APT/USDC',  pythFeedId: '0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5' },
  { name: 'NEAR/USDC', pythFeedId: '0xc415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750' },
  { name: 'DOGE/USDC', pythFeedId: '0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c' },
  { name: 'PEPE/USDC', pythFeedId: '0xd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4' },
  { name: 'WIF/USDC',  pythFeedId: '0x4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc' },
].map(p => ({ ...p, maxLeverage: 50, maxOI: '5000000', tier: 2 }));

// ── Tier 2: Commodities (50x leverage, $5M OI per side) ──
const TIER2_COMMODITIES = [
  { name: 'GOLD/USDC',   pythFeedId: '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2' },
  { name: 'SILVER/USDC', pythFeedId: '0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e' },
].map(p => ({ ...p, maxLeverage: 50, maxOI: '5000000', tier: 2 }));

// ── Tier 3: Stock Indices (20x leverage, $5M OI per side) ──
const TIER3_STOCKS = [
  { name: 'AAPL/USDC', pythFeedId: '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688' },
  { name: 'TSLA/USDC', pythFeedId: '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1' },
  { name: 'SPY/USDC',  pythFeedId: '0x19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5' },
  { name: 'NVDA/USDC', pythFeedId: '0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593' },
].map(p => ({ ...p, maxLeverage: 20, maxOI: '5000000', tier: 3 }));

// ══════════════════════════════════════════════════════════════
//  Combined Config (all 23 pairs)
// ══════════════════════════════════════════════════════════════

export const PAIRS_CONFIG = [
  ...TIER1_CRYPTO,
  ...TIER1_FOREX,
  ...TIER2_ALTCOINS,
  ...TIER2_COMMODITIES,
  ...TIER3_STOCKS,
];

// Default max position % per user (basis points). 2000 = 20% of max OI.
export const DEFAULT_MAX_POSITION_PCT = 2000;

// ── Network Constants ──
export const NETWORKS = {
  ARC_TESTNET: {
    name: 'Arc Testnet',
    chainId: 5042002,
    rpcUrl: 'https://rpc.drpc.testnet.arc.network',
    pythAddress: '0x2880aB155794e7179c9eE2e38200202908C17B43',
    usdcAddress: '0x3600000000000000000000000000000000000000',
  },
  // ARC_MAINNET: {
  //   name: 'Arc Mainnet',
  //   chainId: TBD,
  //   rpcUrl: 'TBD',
  //   pythAddress: 'TBD',
  //   usdcAddress: 'TBD',
  // },
};

import { defineChain } from 'viem'

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: [
        'https://5042002.rpc.thirdweb.com',
        'https://rpc.drpc.testnet.arc.io',
        'https://rpc.quicknode.testnet.arc.io',
        'https://rpc.blockdaemon.testnet.arc.io',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arcscan',
      url: 'https://testnet.arcscan.app',
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    },
  },
  testnet: true,
})

export const BLOCK_EXPLORER_URL = import.meta.env.VITE_ARC_EXPLORER || arcTestnet.blockExplorers.default.url

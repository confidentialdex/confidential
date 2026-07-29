import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/docs/',
  cleanUrls: true,
  title: "Confidential DEX",
  description: "Advanced Agentic Trading Platform",
  appearance: 'dark',
  themeConfig: {
    logo: '/logo.png',
    logoLink: 'javascript:window.location.href="/"',
    nav: [
      { text: 'Overview', link: '/overview/introduction' },
      { text: 'Trading', link: '/trading/mechanics' },
      { text: 'Liquidity', link: '/liquidity/dual-vaults' }
    ],
    sidebar: [
      {
        text: '📖 Introduction',
        collapsed: false,
        items: [
          { text: 'Welcome to Confidential', link: '/overview/introduction' },
          { text: 'System Architecture', link: '/overview/architecture' }
        ]
      },
      {
        text: '📈 Trade',
        collapsed: false,
        items: [
          { text: 'Trading Mechanics', link: '/trading/mechanics' },
          { text: 'Order Types', link: '/trading/order-types' },
          { text: 'Margin & Leverage', link: '/trading/margin-leverage' },
          { text: 'Funding Rates', link: '/trading/funding-rates' },
          { text: 'Fees & Price Impact', link: '/trading/fees-and-impact' },
          { text: 'Liquidations', link: '/trading/liquidations' }
        ]
      },
      {
        text: '🏦 Earn (Liquidity)',
        collapsed: false,
        items: [
          { text: 'Dual-Tranche Vaults', link: '/liquidity/dual-vaults' },
          { text: 'Providing Liquidity', link: '/liquidity/providing-liquidity' },
          { text: 'Risk & Stability', link: '/liquidity/risk-management' }
        ]
      },
      {
        text: '💻 Developers & Security',
        collapsed: false,
        items: [
          { text: 'Smart Contracts', link: '/developers/smart-contracts' },
          { text: 'Keeper Network', link: '/developers/keeper-network' },
          { text: 'Oracles & Pricing', link: '/developers/oracles' }
        ]
      },
      {
        text: '⚖️ Legal',
        collapsed: false,
        items: [
          { text: 'Privacy Policy', link: '/legal/privacy-policy' },
          { text: 'Terms of Service', link: '/legal/terms-of-service' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/confidentialdex/confidential' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026-present Confidential DEX'
    },
    
    search: {
      provider: 'local'
    }
  }
})

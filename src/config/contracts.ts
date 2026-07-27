import ConfidentialTradingABI from '../abis/ConfidentialTradingV1.json'
import ConfidentialVaultABI from '../abis/ConfidentialVaultV1.json'
import ConfidentialCoreABI from '../abis/ConfidentialCoreV1.json'
import ERC20ABI from '../abis/ERC20.json'

// Arc Testnet Smart Contract Addresses
export const CONTRACTS = {
  USDC: '0x3600000000000000000000000000000000000000',
  CORE: '0x0026Ceb6a0dB61224a1A94EfDDd3A37C424cF797',
  VAULT: '0xd0ABFF86ED2493008A2d26C6dA44FE26581f0A79',
  TRADING: '0xFE7f9dDc814D51d487510BA32BD5F611Af131C20',
  ORACLE: '0x7e8f460ebBAE6A767bC80561c322e3c589a8A3C7',
} as const

// Typed ABIs for Wagmi
export const ABIS = {
  USDC: ERC20ABI,
  CORE: (ConfidentialCoreABI as any).abi || ConfidentialCoreABI,
  VAULT: (ConfidentialVaultABI as any).abi || ConfidentialVaultABI,
  TRADING: (ConfidentialTradingABI as any).abi || ConfidentialTradingABI,
} as const

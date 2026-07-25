import ConfidentialTradingABI from '../abis/ConfidentialTradingV1.json'
import ConfidentialVaultABI from '../abis/ConfidentialVaultV1.json'
import ConfidentialCoreABI from '../abis/ConfidentialCoreV1.json'
import ERC20ABI from '../abis/ERC20.json'

// Arc Testnet Smart Contract Addresses
export const CONTRACTS = {
  USDC: '0x3600000000000000000000000000000000000000',
  CORE: '0x5539f6388B921aEA3df086A5704B049c41D6C110',
  VAULT: '0xFA9eEC6c9D64DD4863fDb9990f5cb5b3CfE812C3',
  TRADING: '0x61DDc8A6614e4F519649Fa8a0D76dd75356e8D70',
  ORACLE: '0x9412f25FE26D924DD7729Ae6407F060e34A5b3a4',
} as const

// Typed ABIs for Wagmi
export const ABIS = {
  USDC: ERC20ABI,
  CORE: (ConfidentialCoreABI as any).abi || ConfidentialCoreABI,
  VAULT: (ConfidentialVaultABI as any).abi || ConfidentialVaultABI,
  TRADING: (ConfidentialTradingABI as any).abi || ConfidentialTradingABI,
} as const

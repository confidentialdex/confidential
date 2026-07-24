import ConfidentialTradingABI from '../abis/ConfidentialTradingV1.json'
import ConfidentialVaultABI from '../abis/ConfidentialVaultV1.json'
import ConfidentialCoreABI from '../abis/ConfidentialCoreV1.json'
import ERC20ABI from '../abis/ERC20.json'

// Arc Testnet Smart Contract Addresses
export const CONTRACTS = {
  USDC: '0x3600000000000000000000000000000000000000',
  CORE: '0xBe7b5a030b9e30BD4F6a2Cdf3De2ab14d4E49767',
  VAULT: '0xE9723B722Db4516F1e807ef25e15b61170459dA5',
  TRADING: '0x26c357F2d84842d67F584E6b532bC0d94dC29fEd',
  ORACLE: '0x85ce6Ed04e2bCfdde5B1994d443836AeAdCa3176',
} as const

// Typed ABIs for Wagmi
export const ABIS = {
  USDC: ERC20ABI,
  CORE: (ConfidentialCoreABI as any).abi || ConfidentialCoreABI,
  VAULT: (ConfidentialVaultABI as any).abi || ConfidentialVaultABI,
  TRADING: (ConfidentialTradingABI as any).abi || ConfidentialTradingABI,
} as const

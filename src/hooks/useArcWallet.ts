import { useAccount, useDisconnect, useReadContract, useBalance, useSwitchChain } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { formatUnits } from 'viem'
import { CONTRACTS, ABIS } from '../config/contracts'
import { arcTestnet } from '../config/chain'
import { useEffect } from 'react'


export function useArcWallet() {
  const { address: wagmiAddress, isConnected: wagmiConnected, chainId } = useAccount()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { authenticated, user, logout: privyLogout, login, exportWallet } = usePrivy()


  const privyAddress = user?.wallet?.address
  const privyEmail = user?.email?.address
  const address = wagmiAddress || privyAddress
  const isConnected = wagmiConnected || authenticated

  // Balance from chain (USDC ERC-20)
  const { data: balanceData, error: balanceError, isLoading: balanceLoading, status: balanceStatus } = useReadContract({
    address: CONTRACTS.USDC as `0x${string}`,
    abi: ABIS.USDC,
    functionName: 'balanceOf',
    args: address ? [address as `0x${string}`] : undefined,
    chainId: arcTestnet.id,
    query: {
      enabled: !!address,
      refetchInterval: 10_000, // Refresh every 10s
    },
  })

  // Native balance (for debugging)
  const { data: nativeBalance } = useBalance({
    address: address as `0x${string}` | undefined,
    chainId: arcTestnet.id,
  })

  // Use chain balance if available, else 0
  const balance = typeof balanceData !== 'undefined' && balanceData !== null
    ? Number(formatUnits(balanceData as bigint, 6))
    : 0

  // Debug logging
  useEffect(() => {
    if (address) {
      console.log('[ArcWallet] Address:', address)
      console.log('[ArcWallet] Chain ID:', chainId, '| Expected:', arcTestnet.id)
      console.log('[ArcWallet] USDC Contract:', CONTRACTS.USDC)
      console.log('[ArcWallet] Balance Status:', balanceStatus, '| Loading:', balanceLoading)
      console.log('[ArcWallet] Balance Raw:', balanceData)
      console.log('[ArcWallet] Balance Formatted:', balance)
      if (balanceError) {
        console.error('[ArcWallet] Balance Error:', balanceError.message)
      }
      const formattedNative = nativeBalance?.value !== undefined
        ? formatUnits(nativeBalance.value, nativeBalance.decimals)
        : '0'
      console.log('[ArcWallet] Native Balance:', formattedNative, nativeBalance?.symbol)
    }
  }, [address, balanceData, balanceError, balanceStatus, balanceLoading, nativeBalance, chainId, balance])

  // Only flag as wrong network if chainId is explicitly defined and incorrect.
  // This prevents false positives when chainId is momentarily undefined during connection.
  const isWrongNetwork = isConnected && chainId !== undefined && chainId !== arcTestnet.id

  const truncatedAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : privyEmail
      ? privyEmail.length > 15 ? `${privyEmail.slice(0, 12)}...` : privyEmail
      : 'Loading...'

  const isPrivyWallet = user?.wallet?.walletClientType === 'privy'
  const connect = () => {
    login()
  }

  const disconnect = async () => {
    wagmiDisconnect()
    await privyLogout()
  }

  return {
    address,
    isConnected,
    balance,
    isWrongNetwork,
    truncatedAddress,
    connect,
    disconnect,
    switchNetwork: () => switchChain?.({ chainId: arcTestnet.id }),
    ready: true,
    chainId,
    exportWallet,
    isPrivyWallet
  }
}

import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi'
import { parseUnits, keccak256, toHex } from 'viem'
import { CONTRACTS, ABIS } from '../config/contracts'
import toast from 'react-hot-toast'
import { useUSDCApproval } from './useUSDCApproval'
import { useTradeStore } from '../store/useTradeStore'
import { 
  addOptimisticPosition, 
  addOptimisticOrder, 
  removeOptimisticPosition, 
  updateOptimisticPosition, 
  removeOptimisticOrder 
} from './usePositions'

// Optimistic Liquidation Price Calculator
export function calcLiqPrice(entryPrice: number, sizeUsd: number, collateral: number, isLong: boolean): number {
  if (sizeUsd === 0 || collateral === 0) return 0
  const maxLoss = collateral * 0.9
  const estimatedFees = sizeUsd * 0.0015 // 15 bps fee buffer
  const netAllowable = estimatedFees >= maxLoss ? (sizeUsd * 0.01) : (maxLoss - estimatedFees)
  
  if (isLong) {
    return entryPrice - (entryPrice * netAllowable) / sizeUsd
  } else {
    return entryPrice + (entryPrice * netAllowable) / sizeUsd
  }
}

export function useConfidentialTrading() {
  const { writeContractAsync, data: hash, isPending } = useWriteContract()
  const { address: walletAddress } = useAccount()
  
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash,
  })

  // Hook for USDC Approval specifically for Trading Contract
  const { 
    isApproved, 
    approveInfinite, 
    isApproving 
  } = useUSDCApproval(CONTRACTS.TRADING)

  const EXECUTION_FEE = parseUnits('0.013', 18) // 0.013 ARC for keeper gas

  // Auto-retry wrapper for RPC "failed to fetch" errors
  const retryWrite = async (args: Parameters<typeof writeContractAsync>[0], maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await writeContractAsync(args)
      } catch (err: any) {
        const msg = (err?.message || err?.shortMessage || '').toLowerCase()
        const isNetworkError = msg.includes('failed to fetch') || msg.includes('network') || msg.includes('timeout') || msg.includes('econnrefused')
        if (isNetworkError && attempt < maxRetries) {
          console.warn(`[RetryWrite] Attempt ${attempt}/${maxRetries} failed (network), retrying in ${attempt}s...`)
          await new Promise(r => setTimeout(r, attempt * 1000))
          continue
        }
        throw err // non-network error or final attempt — let caller handle
      }
    }
    throw new Error('Max retries exceeded')
  }

  // Open Market Position
  const openPosition = async (
    pairName: string, 
    isLong: boolean, 
    sizeUsd: number, 
    leverage: number, 
    collateralUsd: number,
    tpPriceUsd: number = 0,
    slPriceUsd: number = 0,
    acceptablePriceUsd: number = 0
  ) => {
    try {
      const fee = sizeUsd * 0.0005
      const totalRequired = collateralUsd + fee
      
      if (!isApproved(totalRequired)) {
        await approveInfinite()
        await new Promise(res => setTimeout(res, 5000))
      }

      toast.loading(`⚡ Submitting Market ${isLong ? 'Long' : 'Short'} (${pairName})...`, { id: 'trade' })

      const pairId = keccak256(toHex(pairName))
      const sizeUnits = parseUnits(sizeUsd.toFixed(6), 6)
      const tpUnits = tpPriceUsd > 0 ? parseUnits(tpPriceUsd.toFixed(18), 18) : 0n
      const slUnits = slPriceUsd > 0 ? parseUnits(slPriceUsd.toFixed(18), 18) : 0n
      const acceptablePriceUnits = acceptablePriceUsd > 0 ? parseUnits(acceptablePriceUsd.toFixed(18), 18) : 0n

      const market = useTradeStore.getState().markets.find(m => m.pair === pairName)
      if (!market) throw new Error("Market not found")

      const tx = await retryWrite({
        address: CONTRACTS.TRADING as any,
        abi: ABIS.TRADING as any,
        functionName: 'placeOrder',
        args: [
          pairId,
          isLong,
          sizeUnits,
          BigInt(leverage),
          acceptablePriceUnits,
          2, // 2 = market_open
          tpUnits,
          slUnits
        ],
        value: EXECUTION_FEE,
      } as any)

      // ── Optimistic Update: inject position immediately ──
      addOptimisticPosition({
        id: `optimistic-${Date.now()}`,
        positionId: `pending`,
        pairId: pairId,
        trader: walletAddress || '',
        isLong,
        sizeUsd,
        collateral: collateralUsd,
        entryPrice: market.price,
        leverage,
        liquidationPrice: isLong
          ? market.price * (1 - 0.9 / leverage)
          : market.price * (1 + 0.9 / leverage),
        openedAt: Date.now(),
        isOpen: true,
        tpPrice: tpPriceUsd,
        slPrice: slPriceUsd,
        _isOptimistic: true,
      })

      toast.success(`✨ Market ${isLong ? 'Long' : 'Short'} Placed (${pairName})`, { id: 'trade' })
      return tx
    } catch (error: any) {
      toast.error(error.shortMessage || 'Failed to request position', { id: 'trade' })
      throw error
    }
  }

  // Close Position
  const closePosition = async (positionId: bigint) => {
    try {
      toast.loading('⚡ Submitting Close Position (100%)...', { id: 'close' })
      
      const tx = await retryWrite({
        address: CONTRACTS.TRADING as any,
        abi: ABIS.TRADING as any,
        functionName: 'createCloseRequest',
        args: [positionId],
        value: EXECUTION_FEE,
      } as any)
      
      // ── Optimistic Update: remove position immediately ──
      removeOptimisticPosition(positionId.toString())

      toast.success('✨ Position Close Request Placed (100%)', { id: 'close' })
      return tx
    } catch (error: any) {
      toast.error(error.shortMessage || 'Failed to request close', { id: 'close' })
      throw error
    }
  }

  // Place Limit/Stop Order
  const placeOrder = async (
    pairName: string,
    isLong: boolean,
    sizeUsd: number,
    leverage: number,
    triggerPriceUsd: number,
    orderType: number, // 0 = limit, 1 = stop
    tpPriceUsd: number = 0,
    slPriceUsd: number = 0
  ) => {
    try {
      const collateralUsd = sizeUsd / leverage
      const feeRate = orderType === 0 ? 0.0003 : 0.0005
      const totalRequired = collateralUsd + (sizeUsd * feeRate)
      
      if (!isApproved(totalRequired)) {
        await approveInfinite()
        await new Promise(res => setTimeout(res, 5000))
      }

      toast.loading(`⚡ Placing ${orderType === 0 ? 'Limit' : 'Stop'} Order (${pairName})...`, { id: 'order' })

      const pairId = keccak256(toHex(pairName))

      const sizeUnits = parseUnits(sizeUsd.toFixed(6), 6)
      const priceUnits = parseUnits(triggerPriceUsd.toFixed(18), 18)
      const tpUnits = tpPriceUsd > 0 ? parseUnits(tpPriceUsd.toFixed(18), 18) : 0n
      const slUnits = slPriceUsd > 0 ? parseUnits(slPriceUsd.toFixed(18), 18) : 0n

      const tx = await retryWrite({
        address: CONTRACTS.TRADING as any,
        abi: ABIS.TRADING as any,
        functionName: 'placeOrder',
        args: [
          pairId,
          isLong,
          sizeUnits,
          BigInt(leverage),
          priceUnits,
          orderType,
          tpUnits,
          slUnits
        ],
        value: EXECUTION_FEE,
      } as any)

      // ── Optimistic Update: inject order immediately ──
      addOptimisticOrder({
        id: `optimistic-order-${Date.now()}`,
        orderId: -1, // Will be replaced by real data
        pairId: pairId,
        trader: walletAddress || '',
        isLong,
        sizeUsd,
        collateral: collateralUsd,
        leverage,
        triggerPrice: triggerPriceUsd,
        orderType,
        isActive: true,
        createdAt: Date.now(),
        _isOptimistic: true,
      })

      toast.success(`✨ ${orderType === 0 ? 'Limit' : 'Stop'} Order Placed (${pairName})`, { id: 'order' })
      return tx
    } catch (error: any) {
      toast.error(error.shortMessage || 'Failed to place order', { id: 'order' })
      throw error
    }
  }

  // Create TWAP Order
  const createTwapOrder = async (
    pairName: string,
    isLong: boolean,
    totalSizeUsd: number,
    leverage: number,
    slices: number,
    intervalSec: number,
    tpPriceUsd: number = 0,
    slPriceUsd: number = 0
  ) => {
    try {
      const collateralUsd = totalSizeUsd / leverage
      const totalRequired = collateralUsd + (totalSizeUsd * 0.0005)
      
      if (!isApproved(totalRequired)) {
        await approveInfinite()
        await new Promise(res => setTimeout(res, 5000))
      }

      toast.loading(`⚡ Submitting TWAP Order (${pairName})...`, { id: 'twap' })

      const pairId = keccak256(toHex(pairName))

      const sizeUnits = parseUnits(totalSizeUsd.toFixed(6), 6)
      const tpUnits = tpPriceUsd > 0 ? parseUnits(tpPriceUsd.toFixed(18), 18) : 0n
      const slUnits = slPriceUsd > 0 ? parseUnits(slPriceUsd.toFixed(18), 18) : 0n

      const tx = await retryWrite({
        address: CONTRACTS.TRADING as any,
        abi: ABIS.TRADING as any,
        functionName: 'createTwapOrder',
        args: [
          pairId,
          isLong,
          sizeUnits,
          BigInt(leverage),
          BigInt(slices),
          BigInt(intervalSec),
          tpUnits,
          slUnits
        ],
        value: EXECUTION_FEE,
      } as any)

      toast.success(`✨ TWAP Order Placed (${pairName})`, { id: 'twap' })
      return tx
    } catch (error: any) {
      toast.error(error.shortMessage || 'Failed to create TWAP order', { id: 'twap' })
      throw error
    }
  }

  // Cancel Order
  const cancelOrder = async (orderId: bigint) => {
    try {
      toast.loading('⚡ Cancelling Order...', { id: 'cancel' })
      const tx = await retryWrite({
        address: CONTRACTS.TRADING as any,
        abi: ABIS.TRADING as any,
        functionName: 'cancelOrder',
        args: [orderId],
      } as any)
      
      // ── Optimistic Update: remove order immediately ──
      removeOptimisticOrder(orderId.toString())

      toast.success('✨ Order Cancelled', { id: 'cancel' })
      return tx
    } catch (error: any) {
      toast.error(error.shortMessage || 'Failed to cancel order', { id: 'cancel' })
      throw error
    }
  }

  // Update TP/SL
  const updateTpSl = async (positionId: bigint, tpPriceUsd: number, slPriceUsd: number) => {
    try {
      toast.loading('⚡ Updating TP / SL...', { id: 'updateTpSl' })
      const tpUnits = tpPriceUsd > 0 ? parseUnits(tpPriceUsd.toFixed(18), 18) : 0n
      const slUnits = slPriceUsd > 0 ? parseUnits(slPriceUsd.toFixed(18), 18) : 0n

      const tx = await retryWrite({
        address: CONTRACTS.TRADING as any,
        abi: ABIS.TRADING as any,
        functionName: 'updateTpSl',
        args: [positionId, tpUnits, slUnits],
      } as any)
      
      // ── Optimistic Update: update TP/SL immediately ──
      updateOptimisticPosition(positionId.toString(), {
        tpPrice: tpPriceUsd,
        slPrice: slPriceUsd
      })

      toast.success('✨ TP / SL Updated', { id: 'updateTpSl' })
      return tx
    } catch (error: any) {
      toast.error(error.shortMessage || 'Failed to update TP/SL', { id: 'updateTpSl' })
      throw error
    }
  }

  // Add Collateral
  const addCollateral = async (positionId: bigint, amountUsd: number) => {
    try {
      if (!isApproved(amountUsd)) {
        await approveInfinite()
        await new Promise(res => setTimeout(res, 5000))
      }

      toast.loading(`⚡ Adding Margin ($${amountUsd.toFixed(2)})...`, { id: 'addCol' })
      const amountUnits = parseUnits(amountUsd.toFixed(6), 6)

      const tx = await retryWrite({
        address: CONTRACTS.TRADING as any,
        abi: ABIS.TRADING as any,
        functionName: 'addCollateral',
        args: [positionId, amountUnits],
      } as any)
      
      // ── Optimistic Update ──
      updateOptimisticPosition(positionId.toString(), (prev: any) => {
        const newCollateral = prev.collateral + amountUsd
        return {
          collateral: newCollateral,
          leverage: Math.round(prev.sizeUsd / newCollateral),
          liquidationPrice: calcLiqPrice(prev.entryPrice, prev.sizeUsd, newCollateral, prev.isLong)
        }
      })

      toast.success(`✨ Margin Added ($${amountUsd.toFixed(2)})`, { id: 'addCol' })
      return tx
    } catch (error: any) {
      toast.error(error.shortMessage || 'Failed to add collateral', { id: 'addCol' })
      throw error
    }
  }

  // Remove Collateral
  const removeCollateral = async (positionId: bigint, amountUsd: number) => {
    try {
      toast.loading(`⚡ Submitting Remove Margin ($${amountUsd.toFixed(2)})...`, { id: 'rmCol' })
      const amountUnits = parseUnits(amountUsd.toFixed(6), 6)

      const tx = await retryWrite({
        address: CONTRACTS.TRADING as any,
        abi: ABIS.TRADING as any,
        functionName: 'createRemoveCollateralRequest',
        args: [positionId, amountUnits],
        value: EXECUTION_FEE,
      } as any)
      
      // ── Optimistic Update ──
      updateOptimisticPosition(positionId.toString(), (prev: any) => {
        const newCollateral = Math.max(0, prev.collateral - amountUsd)
        return {
          collateral: newCollateral,
          leverage: newCollateral > 0 ? Math.round(prev.sizeUsd / newCollateral) : prev.leverage,
          liquidationPrice: calcLiqPrice(prev.entryPrice, prev.sizeUsd, newCollateral, prev.isLong)
        }
      })

      toast.success(`✨ Remove Margin Placed ($${amountUsd.toFixed(2)})`, { id: 'rmCol' })
      return tx
    } catch (error: any) {
      toast.error(error.shortMessage || 'Failed to remove collateral', { id: 'rmCol' })
      throw error
    }
  }

  // Close Position Partial
  const closePositionPartial = async (positionId: bigint, closePercentBps: number) => {
    try {
      toast.loading(`⚡ Submitting Partial Close (${closePercentBps / 100}%)...`, { id: 'closePartial' })
      
      const tx = await retryWrite({
        address: CONTRACTS.TRADING as any,
        abi: ABIS.TRADING as any,
        functionName: 'createPartialCloseRequest',
        args: [positionId, BigInt(closePercentBps)],
        value: EXECUTION_FEE,
      } as any)
      
      // ── Optimistic Update ──
      updateOptimisticPosition(positionId.toString(), (prev: any) => {
        const factor = 1 - (closePercentBps / 10000)
        return {
          sizeUsd: prev.sizeUsd * factor,
          collateral: prev.collateral * factor
        }
      })

      toast.success(`✨ Partial Close Placed (${closePercentBps / 100}%)`, { id: 'closePartial' })
      return tx
    } catch (error: any) {
      toast.error(error.shortMessage || 'Failed to request partial close', { id: 'closePartial' })
      throw error
    }
  }

  // Increase Position
  const increasePosition = async (
    positionId: bigint, 
    additionalSizeUsd: number, 
    additionalLeverage: number,
    acceptablePriceUsd: number
  ) => {
    try {
      const fee = additionalSizeUsd * 0.0005
      const collateral = additionalSizeUsd / additionalLeverage
      const totalRequired = collateral + fee
      
      if (!isApproved(totalRequired)) {
        await approveInfinite()
        await new Promise(res => setTimeout(res, 5000))
      }

      toast.loading(`⚡ Submitting Position Increase (+$${additionalSizeUsd.toFixed(2)})...`, { id: 'increase' })
      
      const sizeUnits = parseUnits(additionalSizeUsd.toFixed(6), 6)
      const acceptablePriceUnits = acceptablePriceUsd > 0 ? parseUnits(acceptablePriceUsd.toFixed(18), 18) : 0n

      const tx = await retryWrite({
        address: CONTRACTS.TRADING as any,
        abi: ABIS.TRADING as any,
        functionName: 'createIncreaseRequest',
        args: [positionId, sizeUnits, BigInt(additionalLeverage), acceptablePriceUnits],
        value: EXECUTION_FEE,
      } as any)
      
      // ── Optimistic Update ──
      updateOptimisticPosition(positionId.toString(), (prev: any) => {
        const newSize = prev.sizeUsd + additionalSizeUsd
        const newCollateral = prev.collateral + collateral
        
        // Calculate average entry price
        const prevBase = prev.sizeUsd / prev.entryPrice
        const addBase = additionalSizeUsd / acceptablePriceUsd
        const newEntryPrice = newSize / (prevBase + addBase)
        
        // Calculate new liquidation price
        const isLong = prev.isLong
        const liqPrice = isLong
          ? newEntryPrice * (1 - (0.9 * newCollateral) / newSize)
          : newEntryPrice * (1 + (0.9 * newCollateral) / newSize)

        return {
          sizeUsd: newSize,
          collateral: newCollateral,
          leverage: Math.round(newSize / newCollateral),
          entryPrice: newEntryPrice,
          liquidationPrice: liqPrice
        }
      })

      toast.success(`✨ Position Increase Placed (+$${additionalSizeUsd.toFixed(2)})`, { id: 'increase' })
      return tx
    } catch (error: any) {
      toast.error(error.shortMessage || 'Failed to request increase position', { id: 'increase' })
      throw error
    }
  }

  return {
    openPosition,
    closePosition,
    placeOrder,
    createTwapOrder,
    cancelOrder,
    updateTpSl,
    addCollateral,
    removeCollateral,
    closePositionPartial,
    increasePosition,
    isTxPending: isPending || isConfirming || isApproving,
  }
}



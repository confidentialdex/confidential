import { useReadContract, useReadContracts } from 'wagmi'
import { CONTRACTS, ABIS } from '../config/contracts'
import { formatUnits } from 'viem'
import { useMemo, useRef, useEffect, useCallback, useState } from 'react'
import { subscribeToRefetch } from './useContractEvents'

// ─── Optimistic Position Store ───
// Shared across hook instances so all consumers see the same optimistic data
let optimisticPositions: any[] = []
let optimisticOrders: any[] = []
const optimisticListeners = new Set<() => void>()

function notifyOptimisticListeners() {
  optimisticListeners.forEach(fn => fn())
}

export function addOptimisticPosition(pos: any) {
  optimisticPositions = [pos, ...optimisticPositions]
  notifyOptimisticListeners()
}

export function addOptimisticOrder(order: any) {
  optimisticOrders = [order, ...optimisticOrders]
  notifyOptimisticListeners()
}

export function clearOptimisticPositions() {
  optimisticPositions = []
  notifyOptimisticListeners()
}

export function clearOptimisticOrders() {
  optimisticOrders = []
  notifyOptimisticListeners()
}

function useOptimisticState() {
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const listener = () => forceUpdate(n => n + 1)
    optimisticListeners.add(listener)
    return () => { optimisticListeners.delete(listener) }
  }, [])
  return { optimisticPositions, optimisticOrders }
}

// ─── Positions Hook (Event-Driven) ───
export function usePositions(address?: string) {
  const lastSuccessRef = useRef<any[]>([])
  const { optimisticPositions: optPositions } = useOptimisticState()

  // 1. Get nextPositionId to know what position IDs exist
  const { data: nextPosIdRaw, refetch: refetchNextId, isLoading: isNextIdLoading } = useReadContract({
    address: CONTRACTS.TRADING as any,
    abi: ABIS.TRADING as any,
    functionName: 'nextPositionId',
    query: {
      enabled: !!address,
      // NO refetchInterval — event-driven only
    }
  })

  // 2. Query the latest 20 position IDs backwards from nextPositionId - 1
  const detailContracts = useMemo(() => {
    if (!address || !nextPosIdRaw) return []
    const nextId = Number(nextPosIdRaw)
    const count = Math.min(nextId - 1, 20) // Check latest 20 positions
    const ids: bigint[] = []
    for (let i = nextId - 1; i >= nextId - count; i--) {
      if (i >= 1) ids.push(BigInt(i))
    }
    return ids.map((id) => ({
      address: CONTRACTS.TRADING as any,
      abi: ABIS.TRADING as any,
      functionName: 'positions',
      args: [id],
    }))
  }, [address, nextPosIdRaw])

  const { data: positionsData, refetch: refetchDetails, isLoading: isDetailsLoading } = useReadContracts({
    contracts: detailContracts,
    query: {
      enabled: detailContracts.length > 0,
      // NO refetchInterval — event-driven only
    }
  })

  // 3. Parse position details with error preservation
  const onChainPositions = useMemo(() => {
    if (!positionsData || detailContracts.length === 0) {
      return lastSuccessRef.current
    }
    
    const parsed = positionsData
      .map((res: any, index: number) => {
        if (res.status !== 'success' || !res.result) return null
        const pos: any = res.result
        const isOpen = pos[9] as boolean
        if (!isOpen) return null // Only show open positions
        
        const trader = pos[1] as string
        if (!address || trader.toLowerCase() !== address.toLowerCase()) return null
        
        const posId = detailContracts[index].args[0] as bigint
        return {
          id: posId.toString(),
          positionId: posId.toString(),
          pairId: pos[0],
          trader: pos[1],
          isLong: pos[2],
          sizeUsd: Number(formatUnits(pos[3], 6)),
          collateral: Number(formatUnits(pos[4], 6)),
          entryPrice: Number(formatUnits(pos[5], 18)),
          leverage: Number(pos[6]),
          liquidationPrice: Number(formatUnits(pos[7], 18)),
          openedAt: Number(pos[8]) * 1000,
          isOpen: isOpen,
          tpPrice: Number(formatUnits(pos[10], 18)),
          slPrice: Number(formatUnits(pos[11], 18)),
        }
      })
      .filter(Boolean) as any[]

    const allSuccess = positionsData && positionsData.every((r: any) => r.status === 'success')
    if (parsed.length > 0 || allSuccess) {
      lastSuccessRef.current = parsed
    }

    return parsed.length > 0 ? parsed : lastSuccessRef.current
  }, [positionsData, detailContracts, address])

  // 4. Merge on-chain + optimistic (filter out optimistic that already appear on-chain)
  const positions = useMemo(() => {
    if (optPositions.length === 0) return onChainPositions

    // Filter optimistic positions that match the current user
    const userOptimistic = optPositions.filter(op =>
      op.trader?.toLowerCase() === address?.toLowerCase()
    )

    if (userOptimistic.length === 0) return onChainPositions

    // Remove optimistic entries whose pairId+isLong already exist in on-chain data
    // (meaning the event already arrived and real data is available)
    const onChainKeys = new Set(
      onChainPositions.map((p: any) => `${p.pairId}-${p.isLong}-${p.sizeUsd}`)
    )
    const filtered = userOptimistic.filter(op =>
      !onChainKeys.has(`${op.pairId}-${op.isLong}-${op.sizeUsd}`)
    )

    return [...filtered, ...onChainPositions]
  }, [onChainPositions, optPositions, address])

  const refetchAll = useCallback(() => {
    // Clear optimistic data when real data arrives
    clearOptimisticPositions()
    refetchNextId()
    refetchDetails()
  }, [refetchNextId, refetchDetails])

  // 5. Subscribe to event watcher
  useEffect(() => {
    const unsubscribe = subscribeToRefetch('positions-hook', ['positions'], refetchAll)
    return unsubscribe
  }, [refetchAll])

  return { 
    positions, 
    isLoading: isNextIdLoading || isDetailsLoading, 
    refetchPositions: refetchAll 
  }
}

// ─── Orders Hook (Event-Driven) ───
export function useOrders(address?: string) {
  const lastSuccessRef = useRef<any[]>([])
  const { optimisticOrders: optOrders } = useOptimisticState()

  // 1. Get nextOrderId to know what order IDs exist
  const { data: nextOrderIdRaw, refetch: refetchNextId, isLoading: isNextIdLoading } = useReadContract({
    address: CONTRACTS.TRADING as any,
    abi: ABIS.TRADING as any,
    functionName: 'nextOrderId',
    query: {
      enabled: !!address,
      // NO refetchInterval — event-driven only
    }
  })

  // 2. Query the latest 15 order IDs backwards from nextOrderId - 1
  const detailContracts = useMemo(() => {
    if (!address || !nextOrderIdRaw) return []
    const nextId = Number(nextOrderIdRaw)
    const count = Math.min(nextId - 1, 15) // Check latest 15 orders
    const ids: bigint[] = []
    for (let i = nextId - 1; i >= nextId - count; i--) {
      if (i >= 1) ids.push(BigInt(i))
    }
    return ids.map((id) => ({
      address: CONTRACTS.TRADING as any,
      abi: ABIS.TRADING as any,
      functionName: 'pendingOrders',
      args: [id],
    }))
  }, [address, nextOrderIdRaw])

  const { data: ordersData, refetch: refetchDetails, isLoading: isDetailsLoading } = useReadContracts({
    contracts: detailContracts,
    query: {
      enabled: detailContracts.length > 0,
      // NO refetchInterval — event-driven only
    }
  })

  // 3. Parse order details with error preservation
  const onChainOrders = useMemo(() => {
    if (!ordersData || detailContracts.length === 0) {
      return lastSuccessRef.current
    }
    
    const parsed = ordersData
      .map((res: any, index: number) => {
        if (res.status !== 'success' || !res.result) return null
        const order: any = res.result
        const isActive = order[8] as boolean
        if (!isActive) return null // Only show active orders
        
        const trader = order[1] as string
        if (!address || trader.toLowerCase() !== address.toLowerCase()) return null
        
        const orderId = detailContracts[index].args[0] as bigint
        return {
          id: orderId.toString(),
          orderId: Number(orderId),
          pairId: order[0],
          trader: order[1],
          isLong: order[2],
          sizeUsd: Number(formatUnits(order[3], 6)),
          collateral: Number(formatUnits(order[4], 6)),
          leverage: Number(order[5]),
          triggerPrice: Number(formatUnits(order[6], 18)),
          orderType: Number(order[7]),
          isActive: isActive,
          createdAt: Number(order[9]) * 1000,
          positionId: Number(order[10]),
          feePaid: Number(formatUnits(order[11], 6)),
          executionFee: Number(formatUnits(order[12], 18)),
          tpPrice: Number(formatUnits(order[13], 18)),
          slPrice: Number(formatUnits(order[14], 18)),
        }
      })
      .filter(Boolean) as any[]

    const allSuccess = ordersData && ordersData.every((r: any) => r.status === 'success')
    if (parsed.length > 0 || allSuccess) {
      lastSuccessRef.current = parsed
    }

    return parsed.length > 0 ? parsed : lastSuccessRef.current
  }, [ordersData, detailContracts, address])

  // 4. Merge on-chain + optimistic orders
  const orders = useMemo(() => {
    if (optOrders.length === 0) return onChainOrders

    const userOptimistic = optOrders.filter(oo =>
      oo.trader?.toLowerCase() === address?.toLowerCase()
    )
    if (userOptimistic.length === 0) return onChainOrders

    // Remove optimistic orders that now exist on-chain
    const onChainIds = new Set(onChainOrders.map((o: any) => o.orderId))
    const filtered = userOptimistic.filter(oo => !onChainIds.has(oo.orderId))

    return [...filtered, ...onChainOrders]
  }, [onChainOrders, optOrders, address])

  const refetchAll = useCallback(() => {
    clearOptimisticOrders()
    refetchNextId()
    refetchDetails()
  }, [refetchNextId, refetchDetails])

  // 5. Subscribe to event watcher
  useEffect(() => {
    const unsubscribe = subscribeToRefetch('orders-hook', ['orders'], refetchAll)
    return unsubscribe
  }, [refetchAll])

  return { 
    orders, 
    isLoading: isNextIdLoading || isDetailsLoading, 
    refetchOrders: refetchAll 
  }
}

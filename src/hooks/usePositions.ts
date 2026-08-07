import { useReadContracts, useReadContract } from 'wagmi'
import { CONTRACTS, ABIS } from '../config/contracts'
import { arcTestnet } from '../config/chain'
import { formatUnits } from 'viem'
import { useMemo, useRef, useEffect, useCallback, useState } from 'react'
import { subscribeToRefetch } from './useContractEvents'
import { useQuery } from '@tanstack/react-query'
import { gql } from 'graphql-request'
import { gqlClient } from '../config/graphql'
// ─── Optimistic Position Store ───
// Shared across hook instances so all consumers see the same optimistic data
let optimisticPositions: any[] = []
let optimisticOrders: any[] = []

// State for mutating existing on-chain data before events arrive
let optimisticPositionUpdates: Record<string, any> = {}
let optimisticPositionRemovals: Set<string> = new Set()
let optimisticOrderRemovals: Set<string> = new Set()

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

export function updateOptimisticPosition(id: string, updater: any | ((prev: any) => any)) {
  // Create a new reference so React useMemo updates
  optimisticPositionUpdates = { ...optimisticPositionUpdates }
  
  if (typeof updater === 'function') {
    // We store an array of updaters if needed, but for simplicity, let's just store the latest function
    // and a wrapper that applies previous updates.
    const prev = optimisticPositionUpdates[id]
    optimisticPositionUpdates[id] = (p: any) => {
      const base = prev ? (typeof prev === 'function' ? prev(p) : { ...p, ...prev }) : p
      return { ...base, ...updater(base) }
    }
  } else {
    const prev = optimisticPositionUpdates[id]
    if (typeof prev === 'function') {
      optimisticPositionUpdates[id] = (p: any) => ({ ...prev(p), ...updater })
    } else {
      optimisticPositionUpdates[id] = { ...prev, ...updater }
    }
  }
  notifyOptimisticListeners()
}

export function removeOptimisticPosition(id: string) {
  optimisticPositionRemovals = new Set(optimisticPositionRemovals)
  optimisticPositionRemovals.add(id)
  notifyOptimisticListeners()
}

export function removeOptimisticOrder(id: string) {
  optimisticOrderRemovals = new Set(optimisticOrderRemovals)
  optimisticOrderRemovals.add(id)
  notifyOptimisticListeners()
}

export function clearOptimisticPositions() {
  optimisticPositions = []
  optimisticPositionUpdates = {}
  optimisticPositionRemovals.clear()
  notifyOptimisticListeners()
}

export function clearOptimisticOrders() {
  optimisticOrders = []
  optimisticOrderRemovals.clear()
  notifyOptimisticListeners()
}

function useOptimisticState() {
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const listener = () => forceUpdate(n => n + 1)
    optimisticListeners.add(listener)
    return () => { optimisticListeners.delete(listener) }
  }, [])
  return { 
    optimisticPositions, 
    optimisticOrders,
    optimisticPositionUpdates,
    optimisticPositionRemovals,
    optimisticOrderRemovals
  }
}

// ─── Positions Hook (Event-Driven) ───
export function usePositions(address?: string) {
  const lastSuccessRef = useRef<any[]>([])
  const lastAddressRef = useRef<string | undefined>(undefined)
  const { 
    optimisticPositions: optPositions,
    optimisticPositionUpdates: optUpdates,
    optimisticPositionRemovals: optRemovals
  } = useOptimisticState()

  // Bug #2 Fix: Reset lastSuccessRef when address changes
  useEffect(() => {
    if (lastAddressRef.current !== address) {
      lastSuccessRef.current = []
      lastAddressRef.current = address
    }
  }, [address])

  // 1. Get user's active position IDs from Goldsky Subgraph
  const { data: goldskyPosIds, refetch: refetchGoldskyIds, isLoading: isGoldskyLoading } = useQuery({
    queryKey: ['goldskyActivePositions', address],
    queryFn: async () => {
      if (!address) return []
      const query = gql`
        query GetUserActivePositions($user: Bytes!) {
          positions(where: { trader: $user, isOpen: true }) {
            positionId
          }
        }
      `
      const data: any = await gqlClient.request(query, { user: address.toLowerCase() })
      return data.positions.map((p: any) => BigInt(p.positionId))
    },
    enabled: !!address,
    refetchInterval: 5000, // 5s auto-refresh
  })

  // 2. Query only the specific active position IDs
  const detailContracts = useMemo(() => {
    if (!address || !goldskyPosIds) return []
    
    // Create a Set to ensure unique IDs (and later we can inject any unindexed numeric optimistic IDs here if needed)
    const ids = new Set<bigint>(goldskyPosIds)
    
    return Array.from(ids).map((id) => ({
      address: CONTRACTS.TRADING as any,
      abi: ABIS.TRADING as any,
      functionName: 'positions',
      args: [id],
      chainId: arcTestnet.id,
    }))
  }, [address, goldskyPosIds])

  const { data: positionsData, refetch: refetchDetails, isLoading: isDetailsLoading } = useReadContracts({
    contracts: detailContracts,
    query: {
      enabled: detailContracts.length > 0,
      refetchInterval: 5000, // 5s auto-refresh for live PnL & collateral updates
    }
  })

  // 3. Parse position details with error preservation
  const onChainPositions = useMemo(() => {
    // Bug #3 Fix: Return empty array (not stale data) when no contracts to query
    if (detailContracts.length === 0) {
      return lastSuccessRef.current.length > 0 ? lastSuccessRef.current : []
    }
    if (!positionsData) {
      return lastSuccessRef.current
    }
    
    const parsed = positionsData
      .map((res: any, index: number) => {
        if (res.status !== 'success' || !res.result) return null
        const pos: any = res.result
        const isArray = Array.isArray(pos)
        
        const isOpen = isArray ? Boolean(pos[9]) : Boolean(pos.isOpen)
        if (!isOpen) return null // Only show open positions
        
        const trader = isArray ? (pos[1] as string) : (pos.trader as string)
        if (!address || !trader || trader.toLowerCase() !== address.toLowerCase()) return null
        
        const posId = detailContracts[index].args[0] as bigint
        const pairId = isArray ? pos[0] : pos.pairId
        const isLong = isArray ? pos[2] : pos.isLong
        const sizeUsdRaw = isArray ? pos[3] : pos.sizeUsd
        const collateralRaw = isArray ? pos[4] : pos.collateral
        const entryPriceRaw = isArray ? pos[5] : pos.entryPrice
        const leverageRaw = isArray ? pos[6] : pos.leverage
        const liqPriceRaw = isArray ? pos[7] : pos.liquidationPrice
        const openedAtRaw = isArray ? pos[8] : pos.openedAt
        const tpPriceRaw = isArray ? pos[10] : pos.tpPrice
        const slPriceRaw = isArray ? pos[11] : pos.slPrice

        return {
          id: posId.toString(),
          positionId: posId.toString(),
          pairId: pairId,
          trader: trader,
          isLong: Boolean(isLong),
          sizeUsd: Number(formatUnits(sizeUsdRaw || 0n, 6)),
          collateral: Number(formatUnits(collateralRaw || 0n, 6)),
          entryPrice: Number(formatUnits(entryPriceRaw || 0n, 18)),
          leverage: Number(leverageRaw || 0),
          liquidationPrice: Number(formatUnits(liqPriceRaw || 0n, 18)),
          openedAt: Number(openedAtRaw || 0) * 1000,
          isOpen: isOpen,
          tpPrice: Number(formatUnits(tpPriceRaw || 0n, 18)),
          slPrice: Number(formatUnits(slPriceRaw || 0n, 18)),
        }
      })
      .filter(Boolean) as any[]

    const allSuccess = positionsData && positionsData.every((r: any) => r.status === 'success')
    if (parsed.length > 0 || allSuccess) {
      lastSuccessRef.current = parsed
      // Auto-clear stale optimistic updates/removals once real data arrives
      if (Object.keys(optimisticPositionUpdates).length > 0 || optimisticPositionRemovals.size > 0) {
        setTimeout(() => {
          optimisticPositionUpdates = {}
          optimisticPositionRemovals = new Set()
          // Also clear injected optimistic positions that now exist on-chain
          if (optimisticPositions.length > 0) {
            const onChainKeys = new Set(parsed.map((p: any) => `${p.pairId}-${p.isLong}`))
            optimisticPositions = optimisticPositions.filter(op => !onChainKeys.has(`${op.pairId}-${op.isLong}`))
          }
          notifyOptimisticListeners()
        }, 500)
      }
    }

    return parsed.length > 0 ? parsed : lastSuccessRef.current
  }, [positionsData, detailContracts, address])

  // 4. Merge on-chain + optimistic
  const positions = useMemo(() => {
    // 1. Apply removals & updates to existing on-chain data
    let base = onChainPositions
    
    if (optRemovals.size > 0) {
      base = base.filter((p: any) => !optRemovals.has(p.id))
    }
    
    if (Object.keys(optUpdates).length > 0) {
      base = base.map((p: any) => {
        if (optUpdates[p.id]) {
          const updates = typeof optUpdates[p.id] === 'function' ? optUpdates[p.id](p) : optUpdates[p.id]
          return { ...p, ...updates, _isOptimisticUpdate: true }
        }
        return p
      })
    }

    if (optPositions.length === 0) return base

    // 2. Add new optimistic positions that don't exist on-chain yet
    const userOptimistic = optPositions.filter(op =>
      op.trader?.toLowerCase() === address?.toLowerCase()
    )

    if (userOptimistic.length === 0) return base

    const onChainKeys = new Set(
      base.map((p: any) => `${p.pairId}-${p.isLong}`)
    )
    const filtered = userOptimistic.filter(op =>
      !onChainKeys.has(`${op.pairId}-${op.isLong}`)
    )

    return [...filtered, ...base]
  }, [onChainPositions, optPositions, optUpdates, optRemovals, address])

  const isLoading = (!address) ? false : (isGoldskyLoading || isDetailsLoading)

  // 5. Setup event-driven refetch
  const refetchAll = useCallback(() => {
    refetchGoldskyIds()
    refetchDetails()
    // Subgraph indexing delay mitigation: refetch again after 3s and 6s
    setTimeout(() => { refetchGoldskyIds(); refetchDetails() }, 3000)
    setTimeout(() => { refetchGoldskyIds(); refetchDetails() }, 6000)
  }, [refetchGoldskyIds, refetchDetails])

  // 5. Subscribe to event watcher
  useEffect(() => {
    const unsubscribe = subscribeToRefetch('positions-hook', ['positions'], refetchAll)
    return unsubscribe
  }, [refetchAll])

  return { positions, refetchPositions: refetchAll, isLoading }
}

// ─── Orders Hook (Event-Driven) ───
export function useOrders(address?: string) {
  const lastSuccessRef = useRef<any[]>([])
  const lastAddressRef = useRef<string | undefined>(undefined)
  const { 
    optimisticOrders: optOrders,
    optimisticOrderRemovals: optRemovals
  } = useOptimisticState()

  // Bug #2 Fix: Reset lastSuccessRef when address changes
  useEffect(() => {
    if (lastAddressRef.current !== address) {
      lastSuccessRef.current = []
      lastAddressRef.current = address
    }
  }, [address])

  // 1. Get user's active order IDs from Goldsky Subgraph
  const { data: goldskyOrderIds, refetch: refetchGoldskyIds, isLoading: isGoldskyLoading } = useQuery({
    queryKey: ['goldskyActiveOrders', address],
    queryFn: async () => {
      if (!address) return []
      const query = gql`
        query GetUserActiveOrders($user: Bytes!) {
          orders(where: { trader: $user, isActive: true }) {
            orderId
          }
        }
      `
      const data: any = await gqlClient.request(query, { user: address.toLowerCase() })
      return data.orders.map((o: any) => BigInt(o.orderId))
    },
    enabled: !!address,
    refetchInterval: 5000, // 5s auto-refresh
  })

  // 1b. Fetch nextOrderId to manually scan recent orders (to catch Market Orders ignored by Goldsky)
  const { data: nextOrderIdRaw } = useReadContract({
    address: CONTRACTS.TRADING as any,
    abi: ABIS.TRADING as any,
    functionName: 'nextOrderId',
    chainId: arcTestnet.id,
    query: {
      refetchInterval: 5000,
    }
  })

  // 2. Query specific active order IDs + last 50 orders
  const detailContracts = useMemo(() => {
    if (!address) return []
    
    // Create a Set to ensure unique IDs
    const ids = new Set<bigint>(goldskyOrderIds || [])
    
    if (nextOrderIdRaw) {
      const nextId = Number(nextOrderIdRaw)
      const startId = Math.max(1, nextId - 50)
      for (let i = startId; i < nextId; i++) {
        ids.add(BigInt(i))
      }
    }
    
    return Array.from(ids).map((id) => ({
      address: CONTRACTS.TRADING as any,
      abi: ABIS.TRADING as any,
      functionName: 'pendingOrders',
      args: [id],
      chainId: arcTestnet.id,
    }))
  }, [address, goldskyOrderIds, nextOrderIdRaw])

  const { data: ordersData, refetch: refetchDetails, isLoading: isDetailsLoading } = useReadContracts({
    contracts: detailContracts,
    query: {
      enabled: detailContracts.length > 0,
      refetchInterval: 5000, // 5s auto-refresh
    }
  })

  // 3. Parse order details with error preservation
  const onChainOrders = useMemo(() => {
    // Bug #3 Fix: Return empty array when no contracts to query
    if (detailContracts.length === 0) {
      return lastSuccessRef.current.length > 0 ? lastSuccessRef.current : []
    }
    if (!ordersData) {
      return lastSuccessRef.current
    }
    
    const parsed = ordersData
      .map((res: any, index: number) => {
        if (res.status !== 'success' || !res.result) return null
        const order: any = res.result
        const isArray = Array.isArray(order)

        const isActive = isArray ? Boolean(order[8]) : Boolean(order.isActive)
        if (!isActive) return null // Only show active orders
        
        const trader = isArray ? (order[1] as string) : (order.trader as string)
        if (!address || !trader || trader.toLowerCase() !== address.toLowerCase()) return null
        
        const orderId = detailContracts[index].args[0] as bigint
        const pairId = isArray ? order[0] : order.pairId
        const isLong = isArray ? order[2] : order.isLong
        const sizeUsdRaw = isArray ? order[3] : order.sizeUsd
        const collateralRaw = isArray ? order[4] : order.collateral
        const leverageRaw = isArray ? order[5] : order.leverage
        const triggerPriceRaw = isArray ? order[6] : order.triggerPrice
        const orderTypeRaw = isArray ? order[7] : order.orderType
        const createdAtRaw = isArray ? order[9] : order.createdAt
        const positionIdRaw = isArray ? order[10] : order.positionId
        const feePaidRaw = isArray ? order[11] : order.feePaid
        const executionFeeRaw = isArray ? order[12] : order.executionFee
        const tpPriceRaw = isArray ? order[13] : order.tpPrice
        const slPriceRaw = isArray ? order[14] : order.slPrice

        return {
          id: orderId.toString(),
          orderId: Number(orderId),
          pairId: pairId,
          trader: trader,
          isLong: Boolean(isLong),
          sizeUsd: Number(formatUnits(sizeUsdRaw || 0n, 6)),
          collateral: Number(formatUnits(collateralRaw || 0n, 6)),
          leverage: Number(leverageRaw || 0),
          triggerPrice: Number(formatUnits(triggerPriceRaw || 0n, 18)),
          orderType: Number(orderTypeRaw || 0),
          isActive: isActive,
          createdAt: Number(createdAtRaw || 0) * 1000,
          positionId: Number(positionIdRaw || 0),
          feePaid: Number(formatUnits(feePaidRaw || 0n, 6)),
          executionFee: Number(formatUnits(executionFeeRaw || 0n, 18)),
          tpPrice: Number(formatUnits(tpPriceRaw || 0n, 18)),
          slPrice: Number(formatUnits(slPriceRaw || 0n, 18)),
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
    let base = onChainOrders
    
    if (optRemovals.size > 0) {
      base = base.filter((o: any) => !optRemovals.has(o.id) && !optRemovals.has(o.orderId?.toString()))
    }

    if (optOrders.length === 0) return base

    const userOptimistic = optOrders.filter(oo =>
      oo.trader?.toLowerCase() === address?.toLowerCase()
    )
    if (userOptimistic.length === 0) return base

    // Remove optimistic orders that now exist on-chain
    const onChainIds = new Set(base.map((o: any) => o.orderId))
    const filtered = userOptimistic.filter(oo => {
      if (onChainIds.has(oo.orderId)) return false
      
      // Match by signature since optimistic orderId is -1
      const existsOnChain = base.some((b: any) => 
        b.pairId === oo.pairId &&
        b.isLong === oo.isLong &&
        b.orderType === oo.orderType &&
        Math.abs(b.triggerPrice - oo.triggerPrice) < 0.0001 &&
        Math.abs(b.createdAt - oo.createdAt) < 60000 // within 1 minute
      )
      return !existsOnChain
    })

    return [...filtered, ...base]
  }, [onChainOrders, optOrders, optRemovals, address])

  // Bug #1 Fix: refetchAll no longer clears optimistic state prematurely
  const refetchAll = useCallback(() => {
    refetchGoldskyIds()
    refetchDetails()
    // Subgraph indexing delay mitigation: refetch again after 3s and 6s
    setTimeout(() => { refetchGoldskyIds(); refetchDetails() }, 3000)
    setTimeout(() => { refetchGoldskyIds(); refetchDetails() }, 6000)
  }, [refetchGoldskyIds, refetchDetails])

  // 5. Subscribe to event watcher
  useEffect(() => {
    const unsubscribe = subscribeToRefetch('orders-hook', ['orders'], refetchAll)
    return unsubscribe
  }, [refetchAll])

  const isLoading = isGoldskyLoading || (!!address && detailContracts.length > 0 && (!ordersData || isDetailsLoading || ordersData.some((r: any) => r.status === 'pending')))

  return { orders, refetchOrders: refetchAll, isLoading }
}

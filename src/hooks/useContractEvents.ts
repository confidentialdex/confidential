import { useWatchContractEvent } from 'wagmi'
import { CONTRACTS, ABIS } from '../config/contracts'
import { useArcWallet } from './useArcWallet'

type RefetchTarget = 'positions' | 'orders' | 'closedPositions' | 'trades'

interface EventSubscriber {
  id: string
  targets: RefetchTarget[]
  callback: () => void
}

// Global subscriber registry (survives re-renders)
const subscribers = new Map<string, EventSubscriber>()

/**
 * Register a refetch callback that fires when specific data targets are invalidated.
 * Returns an unsubscribe function.
 */
export function subscribeToRefetch(
  id: string,
  targets: RefetchTarget[],
  callback: () => void
): () => void {
  subscribers.set(id, { id, targets, callback })
  return () => { subscribers.delete(id) }
}

/**
 * Notify all subscribers interested in the given targets.
 * Uses a small debounce to batch rapid events.
 */
let pendingTargets = new Set<RefetchTarget>()
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function notifySubscribers(targets: RefetchTarget[]) {
  targets.forEach(t => pendingTargets.add(t))

  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    const toNotify = new Set(pendingTargets)
    pendingTargets = new Set()

    subscribers.forEach(sub => {
      if (sub.targets.some(t => toNotify.has(t))) {
        try { sub.callback() } catch (e) { console.error('[EventWatcher] Subscriber error:', e) }
      }
    })
  }, 300) // 300ms debounce — batch multiple events from same block
}

/**
 * Core hook: watches Trading contract events and triggers targeted refetches.
 * Mount once at app root via <EventWatcherLoader />.
 */
export function useContractEvents() {
  const { address } = useArcWallet()

  // ─── Position Events ───
  useWatchContractEvent({
    address: CONTRACTS.TRADING as `0x${string}`,
    abi: ABIS.TRADING as any,
    eventName: 'PositionOpened',
    onLogs(logs) {
      const relevant = !address || logs.some((log: any) => 
        log.args?.trader?.toLowerCase() === address.toLowerCase()
      )
      if (relevant) {
        console.log('[EventWatcher] PositionOpened detected')
        notifySubscribers(['positions', 'orders'])
        setTimeout(() => notifySubscribers(['positions', 'orders']), 5000)
      }
    },
    poll: true,
    pollingInterval: 2_000,
  })

  useWatchContractEvent({
    address: CONTRACTS.TRADING as `0x${string}`,
    abi: ABIS.TRADING as any,
    eventName: 'PositionClosed',
    onLogs(logs) {
      const relevant = !address || logs.some((log: any) => 
        log.args?.trader?.toLowerCase() === address.toLowerCase()
      )
      if (relevant) {
        console.log('[EventWatcher] PositionClosed detected')
        notifySubscribers(['positions', 'closedPositions', 'trades'])
        setTimeout(() => notifySubscribers(['positions', 'closedPositions', 'trades']), 5000)
      }
    },
    poll: true,
    pollingInterval: 2_000,
  })

  useWatchContractEvent({
    address: CONTRACTS.TRADING as `0x${string}`,
    abi: ABIS.TRADING as any,
    eventName: 'PositionLiquidated',
    onLogs(logs) {
      const relevant = !address || logs.some((log: any) => 
        log.args?.trader?.toLowerCase() === address.toLowerCase()
      )
      if (relevant) {
        console.log('[EventWatcher] PositionLiquidated detected')
        notifySubscribers(['positions', 'closedPositions', 'trades'])
        setTimeout(() => notifySubscribers(['positions', 'closedPositions', 'trades']), 5000)
      }
    },
    poll: true,
    pollingInterval: 2_000,
  })

  useWatchContractEvent({
    address: CONTRACTS.TRADING as `0x${string}`,
    abi: ABIS.TRADING as any,
    eventName: 'PositionIncreased',
    onLogs(logs) {
      const relevant = !address || logs.some((log: any) => 
        log.args?.trader?.toLowerCase() === address.toLowerCase()
      )
      if (relevant) {
        console.log('[EventWatcher] PositionIncreased detected')
        notifySubscribers(['positions'])
        setTimeout(() => notifySubscribers(['positions']), 5000)
      }
    },
    poll: true,
    pollingInterval: 2_000,
  })

  useWatchContractEvent({
    address: CONTRACTS.TRADING as `0x${string}`,
    abi: ABIS.TRADING as any,
    eventName: 'PositionPartialClose',
    onLogs(logs) {
      const relevant = !address || logs.some((log: any) => 
        log.args?.trader?.toLowerCase() === address.toLowerCase()
      )
      if (relevant) {
        console.log('[EventWatcher] PositionPartialClose detected')
        notifySubscribers(['positions', 'trades'])
        setTimeout(() => notifySubscribers(['positions', 'trades']), 5000)
      }
    },
    poll: true,
    pollingInterval: 2_000,
  })

  // ─── Collateral Events ───
  useWatchContractEvent({
    address: CONTRACTS.TRADING as `0x${string}`,
    abi: ABIS.TRADING as any,
    eventName: 'CollateralAdded',
    onLogs(logs) {
      const relevant = !address || logs.some((log: any) => 
        log.args?.trader?.toLowerCase() === address.toLowerCase()
      )
      if (relevant) {
        console.log('[EventWatcher] CollateralAdded detected')
        notifySubscribers(['positions'])
        setTimeout(() => notifySubscribers(['positions']), 5000)
      }
    },
    poll: true,
    pollingInterval: 2_000,
  })

  useWatchContractEvent({
    address: CONTRACTS.TRADING as `0x${string}`,
    abi: ABIS.TRADING as any,
    eventName: 'CollateralRemoved',
    onLogs(logs) {
      const relevant = !address || logs.some((log: any) => 
        log.args?.trader?.toLowerCase() === address.toLowerCase()
      )
      if (relevant) {
        console.log('[EventWatcher] CollateralRemoved detected')
        notifySubscribers(['positions'])
        setTimeout(() => notifySubscribers(['positions']), 5000)
      }
    },
    poll: true,
    pollingInterval: 2_000,
  })

  // ─── Order Events ───
  useWatchContractEvent({
    address: CONTRACTS.TRADING as `0x${string}`,
    abi: ABIS.TRADING as any,
    eventName: 'OrderPlaced',
    onLogs(logs) {
      const relevant = !address || logs.some((log: any) => 
        log.args?.trader?.toLowerCase() === address.toLowerCase()
      )
      if (relevant) {
        console.log('[EventWatcher] OrderPlaced detected')
        notifySubscribers(['orders'])
        setTimeout(() => notifySubscribers(['orders']), 5000)
      }
    },
    poll: true,
    pollingInterval: 2_000,
  })

  useWatchContractEvent({
    address: CONTRACTS.TRADING as `0x${string}`,
    abi: ABIS.TRADING as any,
    eventName: 'OrderExecuted',
    onLogs() {
      console.log('[EventWatcher] OrderExecuted detected')
      notifySubscribers(['positions', 'orders'])
      setTimeout(() => notifySubscribers(['positions', 'orders']), 5000)
    },
    poll: true,
    pollingInterval: 2_000,
  })

  useWatchContractEvent({
    address: CONTRACTS.TRADING as `0x${string}`,
    abi: ABIS.TRADING as any,
    eventName: 'OrderCancelled',
    onLogs() {
      console.log('[EventWatcher] OrderCancelled detected')
      notifySubscribers(['orders'])
      setTimeout(() => notifySubscribers(['orders']), 5000)
    },
    poll: true,
    pollingInterval: 2_000,
  })

  // ─── TP/SL Events ───
  useWatchContractEvent({
    address: CONTRACTS.TRADING as `0x${string}`,
    abi: ABIS.TRADING as any,
    eventName: 'TPSLTriggered',
    onLogs() {
      console.log('[EventWatcher] TPSLTriggered detected')
      notifySubscribers(['positions', 'closedPositions', 'trades'])
      setTimeout(() => notifySubscribers(['positions', 'closedPositions', 'trades']), 5000)
    },
    poll: true,
    pollingInterval: 2_000,
  })
}

import { useState, useMemo, useEffect, useRef } from 'react'
import { keccak256, toHex, formatUnits } from 'viem'
import { useReadContracts } from 'wagmi'
import { CONTRACTS, ABIS } from '../config/contracts'
import { useTradeStore } from '../store/useTradeStore'
import { useArcWallet } from '../hooks/useArcWallet'
import { useConfidentialTrading, calcLiqPrice } from '../hooks/useConfidentialTrading'
import { usePositions } from '../hooks/usePositions'
import type { OrderSide, OrderType } from '../types'


interface OrderFormProps {
  initialSide?: OrderSide
  onClose?: () => void
}

export default function OrderForm({ initialSide = 'long', onClose }: OrderFormProps) {
  const { markets, activeMarketId, placeOrder: placeMockOrder } = useTradeStore()
  const { isConnected, balance, connect, isWrongNetwork, address } = useArcWallet()
  const { openPosition, placeOrder, createTwapOrder, isTxPending, increasePosition } = useConfidentialTrading()
  const { positions: activePositions, isLoading: isPositionsLoading } = usePositions(address || undefined)
  
  const [orderType, setOrderType] = useState<OrderType>('market')
  const [isProDropdownOpen, setIsProDropdownOpen] = useState(false)
  const [durationHours, setDurationHours] = useState('1')
  const [durationMins, setDurationMins] = useState('0')
  const [slippage, setSlippage] = useState('0.30')
  const [showSlippageSlider, setShowSlippageSlider] = useState(false)
  const [side, setSide] = useState<OrderSide>(initialSide)

  const activeMarket = markets.find((m) => m.id === activeMarketId)
  
  const currentMarketPairId = activeMarket ? activeMarket.pairHash : ''
  const currentPosition = activePositions.find(p => p.pairId === currentMarketPairId && p.isLong === (side === 'long'))
  const currentPositionSizeUsd = currentPosition ? currentPosition.sizeUsd : 0
  const currentPositionSizeBase = activeMarket && currentPosition ? currentPositionSizeUsd / currentPosition.entryPrice : 0

  const unrealizedPnl = activePositions.reduce((sum, p) => {
    const matchedMarket = markets.find(m => m.pairHash === p.pairId)
    const markPrice = matchedMarket ? matchedMarket.price : p.entryPrice
    const sizeBaseAsset = p.sizeUsd / p.entryPrice
    const pnl = matchedMarket ? (p.isLong ? (markPrice - p.entryPrice) * sizeBaseAsset : (p.entryPrice - markPrice) * sizeBaseAsset) : 0
    return sum + pnl
  }, 0)

  const equity = balance + activePositions.reduce((sum, p) => sum + p.collateral, 0) + unrealizedPnl

  // --- Real-Time OI & Liquidity Fetching ---
  const pairIdStr = activeMarket?.pair || 'BTC/USDC'
  const pairId = keccak256(toHex(pairIdStr))

  const { data: oiInfo } = useReadContracts({
    contracts: [
      { address: CONTRACTS.CORE as `0x${string}`, abi: ABIS.CORE, functionName: 'longOI', args: [pairId] },
      { address: CONTRACTS.CORE as `0x${string}`, abi: ABIS.CORE, functionName: 'shortOI', args: [pairId] },
      { address: CONTRACTS.CORE as `0x${string}`, abi: ABIS.CORE, functionName: 'getOIInfo', args: [pairId] }
    ],
    query: { refetchInterval: 3000 }
  })

  const isMajorPair = pairIdStr === 'BTC/USDC' || pairIdStr === 'ETH/USDC'
  const defaultMaxOI = isMajorPair ? 10000000 : 5000000
  
  const oiRef = useRef({ long: 0, short: 0, maxLong: defaultMaxOI, maxShort: defaultMaxOI })

  if (oiInfo && oiInfo[0] && oiInfo[1]) {
    if (oiInfo[0].status === 'success' && oiInfo[0].result !== undefined) {
      oiRef.current.long = Number(formatUnits(oiInfo[0].result as bigint, 6))
    }
    if (oiInfo[1].status === 'success' && oiInfo[1].result !== undefined) {
      oiRef.current.short = Number(formatUnits(oiInfo[1].result as bigint, 6))
    }
  }

  // Read real maxOI from getOIInfo (returns [longOI, shortOI, maxLongOI, maxShortOI])
  if (oiInfo && oiInfo[2] && oiInfo[2].status === 'success' && oiInfo[2].result) {
    const oiResult = oiInfo[2].result as [bigint, bigint, bigint, bigint]
    const onChainMaxLong = Number(formatUnits(oiResult[2], 6))
    const onChainMaxShort = Number(formatUnits(oiResult[3], 6))
    oiRef.current.maxLong = (onChainMaxLong === 10000000 && !isMajorPair) ? 5000000 : onChainMaxLong
    oiRef.current.maxShort = (onChainMaxShort === 10000000 && !isMajorPair) ? 5000000 : onChainMaxShort
  }

  const longOIVal = oiRef.current.long
  const shortOIVal = oiRef.current.short
  const maxLongOIVal = oiRef.current.maxLong
  const maxShortOIVal = oiRef.current.maxShort
  const maxOISide = side === 'long' ? maxLongOIVal : maxShortOIVal
  const availableLiquidity = side === 'long' ? Math.max(0, maxLongOIVal - longOIVal) : Math.max(0, maxShortOIVal - shortOIVal)

  const isMarketClosed = activeMarket && activeMarket.price > 0 && activeMarket.lastUpdate ? (Date.now() - activeMarket.lastUpdate > 60000) : false;

  // ----------------------------------------

  useEffect(() => {
    setSide(initialSide)
  }, [initialSide])
  const [price, setPrice] = useState('')
  const [size, setSize] = useState('')
  const [sizePercent, setSizePercent] = useState<number>(0)
  const [leverage, setLeverage] = useState(10)
  const [isLeverageModalOpen, setIsLeverageModalOpen] = useState(false)
  const [tempLeverage, setTempLeverage] = useState<number | string>('')
  
  // Dynamic leverage presets based on market category
  const maxMarketLeverage = activeMarket?.maxLeverage || 50
  
  const leveragePresets = useMemo(() => {
    if (maxMarketLeverage <= 10) return [1, 3, 5, maxMarketLeverage]
    if (maxMarketLeverage <= 20) return [1, 5, 10, maxMarketLeverage]
    if (maxMarketLeverage <= 25) return [1, 10, 15, maxMarketLeverage]
    if (maxMarketLeverage <= 50) return [1, 10, 25, maxMarketLeverage]
    return [1, 25, 50, maxMarketLeverage] // for 100x
  }, [maxMarketLeverage])

  useEffect(() => {
    if (activeMarket) {
      // Default to the max leverage of the new category when switching markets
      setLeverage(leveragePresets[leveragePresets.length - 1])
      setSize('')
      setSizePercent(0)
      setPrice('')
      setTriggerPrice('')
      setTakeProfit('')
      setStopLoss('')
      setShowTpSl(false)
    }
  }, [activeMarket?.id]) // Only run when the market ID itself changes
  const [showTpSl, setShowTpSl] = useState(false)
  const [takeProfit, setTakeProfit] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [triggerPrice, setTriggerPrice] = useState('')

  const [inputCurrency, setInputCurrency] = useState<'BASE' | 'USD'>('BASE')
  const isCustomLeverage = !leveragePresets.includes(leverage)
  const maxLeverage = leveragePresets[leveragePresets.length - 1]

  const initialEffectivePrice = orderType === 'market' || orderType === 'twap'
    ? (activeMarket?.price ?? 0)
    : orderType === 'stop market'
      ? (Number(triggerPrice) || activeMarket?.price || 0)
      : (Number(price) || 0)
  const sizeNum = Number(size) || 0
  
  const initialUsdSize = inputCurrency === 'USD' ? sizeNum : (sizeNum * initialEffectivePrice)

  // --- Price Impact & Discount Calculation ---
  const sizeUsdValue = Number(initialUsdSize) || 0;
  let priceImpactPct = 0;
  let feeDiscountUsd = 0;

  if (sizeUsdValue > 0 && maxOISide > 0) {
    let overshootSize = 0;
    let isBalancing = false;

    // Neutral Case
    if (longOIVal === shortOIVal) {
      overshootSize = sizeUsdValue;
      isBalancing = false;
    } else {
      // Determine balancing vs merusak
      if ((side === 'long' && shortOIVal > longOIVal) || (side === 'short' && longOIVal > shortOIVal)) {
        isBalancing = true;
        const gap = side === 'long' ? (shortOIVal - longOIVal) : (longOIVal - shortOIVal);
        if (sizeUsdValue <= gap) {
          overshootSize = 0;
        } else {
          overshootSize = sizeUsdValue - gap;
        }
      } else {
        isBalancing = false;
        overshootSize = sizeUsdValue;
      }
    }

    // Quadratic Impact for Overshoot portion
    if (overshootSize > 0) {
      const ratio = overshootSize / maxOISide;
      let rawImpactBps = (ratio * ratio) * 200; // maxPriceImpactBps = 200
      if (rawImpactBps > 200) rawImpactBps = 200; // Cap at max
      
      priceImpactPct = rawImpactBps / 100;
    }

    // 25% Fee Discount for traders helping to balance OI skew (applied to entire fee)
    if (isBalancing) {
      const feeMultiplier = orderType === 'limit' ? 0.0003 : 0.0005;
      const totalFee = sizeUsdValue * feeMultiplier;
      feeDiscountUsd = totalFee * 0.25; // 25% discount on full fee
    }
  }

  // Apply Impact to Effective Price
  let effectivePrice = initialEffectivePrice;
  if (priceImpactPct > 0) {
    const impactShift = (initialEffectivePrice * priceImpactPct) / 100;
    effectivePrice = side === 'long' ? initialEffectivePrice + impactShift : initialEffectivePrice - impactShift;
  }

  const baseSize = inputCurrency === 'BASE' ? sizeNum : (effectivePrice ? sizeNum / effectivePrice : 0)
  const usdSize = inputCurrency === 'USD' ? sizeNum : (sizeNum * effectivePrice)
  
  // Total Monetary Penalty (Dollar Loss)
  const priceImpactVal = (usdSize * priceImpactPct) / 100;

  const orderSummary = useMemo(() => {
    if (!effectivePrice || !sizeNum) return null
    const notional = usdSize
    const collateral = notional / leverage
    const feeMultiplier = orderType === 'limit' ? 0.0003 : 0.0005
    const originalFees = notional * feeMultiplier
    const fees = Math.max(0, originalFees - feeDiscountUsd)

    let finalLiqPrice = 0
    let finalEntryPrice = effectivePrice

    // If position exists, calculate VWAP Average
    if (currentPosition) {
      const newSizeUsd = currentPosition.sizeUsd + notional
      const newCollateral = currentPosition.collateral + collateral
      
      const posBase = currentPosition.sizeUsd / currentPosition.entryPrice
      const addBase = notional / effectivePrice
      const newEntryPrice = newSizeUsd / (posBase + addBase)
      finalEntryPrice = newEntryPrice

      finalLiqPrice = calcLiqPrice(newEntryPrice, newSizeUsd, newCollateral, side === 'long')
    } else {
      // Single Position Fallback
      finalLiqPrice = calcLiqPrice(effectivePrice, notional, collateral, side === 'long')
    }

    return {
      collateral: collateral.toFixed(2),
      notional: notional.toFixed(2),
      liqPrice: finalLiqPrice.toFixed(2),
      entryPrice: finalEntryPrice.toFixed(2), // Optional: can be displayed if wanted
      fees: fees.toFixed(2),
      feeDiscount: feeDiscountUsd.toFixed(2),
      totalRequired: collateral + fees
    }
  }, [effectivePrice, sizeNum, leverage, side, usdSize, feeDiscountUsd, currentPosition, orderType])

  const handleSideChange = (newSide: OrderSide) => {
    if (newSide === side) return;
    setSide(newSide);
    if (activeMarket) {
      setLeverage(leveragePresets[leveragePresets.length - 1]);
    }
    setSize('');
    setSizePercent(0);
    setTakeProfit('');
    setStopLoss('');
    setShowTpSl(false);
  }

  const handleSizePercentChange = (percent: number) => {
    setSizePercent(percent)
    if (!activeMarket || !effectivePrice || !isConnected || balance <= 0) return
    const feeMultiplier = orderType === 'limit' ? 0.0003 : 0.0005
    const maxNotional = balance / (1 / leverage + feeMultiplier)
    
    if (inputCurrency === 'USD') {
      const newSize = ((maxNotional * percent) / 100).toFixed(2)
      setSize(newSize === '0.00' ? '' : newSize)
    } else {
      const maxBaseAsset = maxNotional / effectivePrice
      const newSize = ((maxBaseAsset * percent) / 100).toFixed(4)
      setSize(newSize === '0.0000' ? '' : newSize)
    }
  }

  const handleSizeChange = (val: string) => {
    setSize(val)
    if (!activeMarket || !effectivePrice || !isConnected || balance <= 0) return
    const feeMultiplier = orderType === 'limit' ? 0.0002 : 0.0004
    const maxNotional = balance / (1 / leverage + feeMultiplier)
    const valNum = Number(val) || 0
    
    if (inputCurrency === 'USD') {
      if (maxNotional > 0) setSizePercent(Math.min(100, (valNum / maxNotional) * 100))
    } else {
      const maxBaseAsset = maxNotional / effectivePrice
      if (maxBaseAsset > 0) setSizePercent(Math.min(100, (valNum / maxBaseAsset) * 100))
    }
  }

  const toggleCurrency = (currency: 'BASE' | 'USD') => {
    if (currency === inputCurrency) return
    setInputCurrency(currency)
    if (!sizeNum) return
    if (currency === 'USD') setSize(usdSize.toFixed(2))
    else setSize(baseSize.toFixed(4))
  }

  const handleTpPercent = (percent: number) => {
    if (!effectivePrice) return;
    const movePct = percent / leverage / 100;
    const targetPrice = side === 'long' 
      ? effectivePrice * (1 + movePct) 
      : effectivePrice * (1 - movePct);
    setTakeProfit(targetPrice < 10 ? targetPrice.toFixed(4) : targetPrice.toFixed(2));
  }

  const handleSlPercent = (percent: number) => {
    if (!effectivePrice) return;
    const movePct = percent / leverage / 100;
    const targetPrice = side === 'long' 
      ? effectivePrice * (1 - movePct) 
      : effectivePrice * (1 + movePct);
    setStopLoss(targetPrice < 10 ? targetPrice.toFixed(4) : targetPrice.toFixed(2));
  }

  const isInsufficientBalance = orderSummary ? orderSummary.totalRequired > balance : false
  const exceedsLiquidity = (Number(orderSummary?.notional) || 0) > availableLiquidity

  const handleSubmit = async () => {
    if (!isConnected || isWrongNetwork) { connect(); return }
    if (!activeMarket || !sizeNum || !orderSummary || isInsufficientBalance || exceedsLiquidity || isPositionsLoading) return
    
    try {
      const tpNum = showTpSl ? Number(takeProfit) : 0;
      const slNum = showTpSl ? Number(stopLoss) : 0;
      const slippageNum = Math.min(5, Math.max(0.1, Number(slippage) || 0.3));

      let acceptablePriceUsd = 0;
      if (activeMarket.price > 0 && orderType === 'market') {
        const slippageMultiplier = slippageNum / 100;
        if (side === 'long') {
           acceptablePriceUsd = activeMarket.price * (1 + slippageMultiplier);
        } else {
           acceptablePriceUsd = activeMarket.price * (1 - slippageMultiplier);
        }
      }

      if (orderType === 'twap') {
        const totalHours = Number(durationHours) || 0;
        const totalMins = Number(durationMins) || 0;
        const totalSeconds = (totalHours * 3600) + (totalMins * 60);
        // Default to 1 slice per 10 mins, min 2 slices, max 100 slices
        const slices = Math.max(2, Math.min(100, Math.ceil(totalSeconds / 600) || 2)); 
        const interval = totalSeconds > 0 ? Math.floor(totalSeconds / slices) : 600;

        await createTwapOrder(
          activeMarket.pair,
          side === 'long',
          usdSize,
          leverage,
          slices,
          Math.max(60, interval),
          tpNum,
          slNum
        )
      } else if (orderType === 'market') {
        if (currentPosition) {
          await increasePosition(
            BigInt(currentPosition.positionId),
            usdSize,
            leverage,
            acceptablePriceUsd
          )
        } else {
          await openPosition(
            activeMarket.pair, // e.g. "BTC/USDC"
            side === 'long',
            usdSize,
            leverage,
            Number(orderSummary.collateral),
            tpNum,
            slNum,
            acceptablePriceUsd
          )
        }
      } else if (orderType === 'limit' || orderType === 'stop market') {
        const orderTypeValue = orderType === 'limit' ? 0 : 1;
        await placeOrder(
          activeMarket.pair,
          side === 'long',
          usdSize,
          leverage,
          Number(triggerPrice || price),
          orderTypeValue,
          tpNum,
          slNum
        )
        // Sync to local store so it appears in the UI tab
        placeMockOrder({
          marketId: activeMarket.id,
          pair: activeMarket.pair,
          type: orderType,
          side: side,
          price: Number(triggerPrice || price),
          size: baseSize,
          leverage: leverage,
        })
      }
      setSize(''); setPrice(''); setSizePercent(0)
      onClose?.()
    } catch (e) {
      console.error(e)
    }
  }

  if (!activeMarket) return null

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:16,background:'transparent', color:'#fff', fontFamily:'Inter, sans-serif', flexShrink: 0 }}>
      
      {/* Mobile Modal Header */}
      {onClose && (
        <div className="mobile-only" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{activeMarket.pair}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8e8e93', cursor: 'pointer', padding: 4 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* Main Trade Card */}
      <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-bg1)' }}>

      {isMarketClosed && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#ef444420', color: '#ef4444', padding: '8px', borderRadius: '6px', fontSize: 13, fontWeight: 600 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          MARKET CLOSED
        </div>
      )}

      {/* Top Bar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13 }}>
        <span style={{ color:'#8e8e93' }}>Available to trade</span>
        <span style={{ fontWeight:600 }}>${balance.toFixed(2)} USDC</span>
      </div>

      {/* Long / Short */}
      <div style={{ display:'flex', background:'var(--color-bg2)', border:'1px solid var(--color-border)', borderRadius:8, padding:2, marginTop: 4 }}>
        <button onClick={()=>handleSideChange('long')} style={{ flex:1, padding:'6px 0', borderRadius:6, border:'none', background:side==='long'?'var(--color-green)':'transparent', color:side==='long'?'#000':'#8e8e93', fontWeight:600, fontSize:14, cursor:'pointer', transition:'all 0.2s' }}>Long</button>
        <button onClick={()=>handleSideChange('short')} style={{ flex:1, padding:'6px 0', borderRadius:6, border:'none', background:side==='short'?'#e55f48':'transparent', color:side==='short'?'#fff':'#8e8e93', fontWeight:600, fontSize:14, cursor:'pointer', transition:'all 0.2s' }}>Short</button>
      </div>

      {/* Order Type Tabs */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
        <button 
          onClick={() => { setOrderType('market'); setIsProDropdownOpen(false); setPrice(''); setTriggerPrice(''); setDurationHours('1'); setDurationMins('0'); }}
          style={{ background: 'none', border: 'none', color: orderType === 'market' ? '#fff' : '#8e8e93', fontSize: '15px', fontWeight: orderType === 'market' ? 600 : 500, cursor: 'pointer', padding: 0, position: 'relative' }}
        >
          Market
          {orderType === 'market' && <div style={{ position: 'absolute', bottom: '-9px', left: 0, right: 0, height: '2px', background: '#fbbf24' }} />}
        </button>

        <button 
          onClick={() => { setOrderType('limit'); setIsProDropdownOpen(false); setPrice(''); setTriggerPrice(''); setDurationHours('1'); setDurationMins('0'); }}
          style={{ background: 'none', border: 'none', color: orderType === 'limit' ? '#fff' : '#8e8e93', fontSize: '15px', fontWeight: orderType === 'limit' ? 600 : 500, cursor: 'pointer', padding: 0, position: 'relative' }}
        >
          Limit
          {orderType === 'limit' && <div style={{ position: 'absolute', bottom: '-9px', left: 0, right: 0, height: '2px', background: '#fbbf24' }} />}
        </button>

        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setIsProDropdownOpen(!isProDropdownOpen)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: (orderType !== 'market' && orderType !== 'limit') ? '#fff' : '#8e8e93', fontSize: '15px', fontWeight: (orderType !== 'market' && orderType !== 'limit') ? 600 : 500, cursor: 'pointer', padding: 0 }}
          >
            <span style={{ textTransform: 'capitalize' }}>
              {(orderType !== 'market' && orderType !== 'limit') ? orderType : 'Pro'}
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isProDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M6 9l6 6 6-6"/></svg>
            {(orderType !== 'market' && orderType !== 'limit') && <div style={{ position: 'absolute', bottom: '-9px', left: 0, right: 0, height: '2px', background: '#fbbf24' }} />}
          </button>

          {isProDropdownOpen && (
            <div className="animate-fade-in-up" style={{ position: 'absolute', top: '100%', left: 0, marginTop: '12px', background: '#121214', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '4px', zIndex: 10, minWidth: '130px', display: 'flex', flexDirection: 'column', gap: '2px', animationDuration: '150ms' }}>
              <button 
                onClick={() => { setOrderType('stop market'); setIsProDropdownOpen(false); setPrice(''); setTriggerPrice(''); setDurationHours('1'); setDurationMins('0'); }}
                style={{ background: orderType === 'stop market' ? 'var(--color-bg2)' : 'transparent', border: 'none', color: '#fff', padding: '8px 12px', textAlign: 'left', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
              >
                Stop Market
              </button>
              <button 
                onClick={() => { setOrderType('twap'); setIsProDropdownOpen(false); setPrice(''); setTriggerPrice(''); setDurationHours('1'); setDurationMins('0'); }}
                style={{ background: orderType === 'twap' ? 'var(--color-bg2)' : 'transparent', border: 'none', color: '#fff', padding: '8px 12px', textAlign: 'left', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
              >
                TWAP
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Leverage */}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <span style={{ fontSize:12, color:'#8e8e93', fontWeight:500 }}>Leverage</span>
        <div style={{ display:'flex', gap:4 }}>
          {leveragePresets.map(l => (
            <button key={l} onClick={()=>setLeverage(l)} style={{ flex:1, background:leverage===l?'var(--color-bg3)':'var(--color-bg2)', border:'1px solid', borderColor:leverage===l?'var(--color-border-strong)':'var(--color-border)', color:'#fff', padding:'6px 0', borderRadius:6, fontSize:13, fontWeight:500, cursor:'pointer' }}>{l}x</button>
          ))}
          <div 
            onClick={() => {
              setTempLeverage(leverage)
              setIsLeverageModalOpen(true)
            }}
            style={{ 
              flex: 1.2, 
              background: isCustomLeverage ? 'var(--color-bg3)' : 'var(--color-bg2)', 
              borderRadius: 6, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '0 8px', 
              border: isCustomLeverage ? '1px solid var(--color-border-strong)' : '1px solid var(--color-border)', 
              cursor: 'pointer' 
            }}
          >
             <span style={{ fontSize:13, color: isCustomLeverage ? '#fff' : '#8e8e93', fontWeight: isCustomLeverage ? 500 : 400 }}>
               {isCustomLeverage ? `${leverage}x` : 'Custom'}
             </span>
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>
      </div>

      {/* Current Position */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12 }}>
        <span style={{ color:'#8e8e93' }}>Current Position</span>
        <span style={{ fontWeight:500, color: currentPositionSizeUsd > 0 ? (currentPosition?.isLong ? 'var(--color-green)' : 'var(--color-red)') : 'var(--color-text1)' }}>
          {activeMarket ? (inputCurrency === 'BASE' ? `${currentPositionSizeBase.toFixed(4)} ${activeMarket.baseAsset}` : `$${currentPositionSizeUsd.toFixed(2)}`) : '$0.00'}
        </span>
      </div>

      {/* Dynamic Order Settings */}
      {orderType !== 'market' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4, marginBottom: 4, animationDuration: '200ms' }}>
          {orderType === 'limit' && (
            <div style={{ display:'flex', flexDirection:'column', background:'var(--color-bg0)', border:'1px solid var(--color-border)', borderRadius:8, padding:'6px 10px', transition:'border 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize:11, color:'#8e8e93' }}>Limit Price</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(side === 'long' ? [-1, -2, -5] : [1, 2, 5]).map(p => (
                    <span key={p} onClick={() => { if (!activeMarket?.price) return; const adj = activeMarket.price * (1 + p / 100); setPrice(adj >= 1000 ? adj.toFixed(1) : adj >= 1 ? adj.toFixed(2) : adj.toFixed(6)); }} style={{ fontSize: 10, cursor: 'pointer', color: p < 0 ? '#4BFF99' : '#ff4b4b', background: p < 0 ? 'rgba(75, 255, 153, 0.1)' : 'rgba(255, 75, 75, 0.1)', padding: '2px 6px', borderRadius: 4, fontWeight: 600, transition: 'background 0.2s' }}>{p > 0 ? '+' : ''}{p}%</span>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center' }}>
                <input type="number" placeholder="0.00" value={price} onChange={e=>setPrice(e.target.value)} style={{ flex:1, background:'transparent', border:'none', color:'#fff', fontSize:16, outline:'none', minWidth:0, textAlign:'right', fontFamily: 'var(--font-mono)' }} />
                <span style={{ fontSize:12, color:'#8e8e93', marginLeft: 8 }}>USD</span>
              </div>
            </div>
          )}

          {orderType === 'stop market' && (
            <div style={{ display:'flex', alignItems:'center', background:'var(--color-bg0)', border:'1px solid var(--color-border)', borderRadius:8, padding:'6px 10px', transition:'border 0.2s' }}>
              <span style={{ fontSize:13, color:'#8e8e93', marginRight:8, whiteSpace:'nowrap' }}>Trigger Price</span>
              <input type="number" placeholder="0.00" value={triggerPrice} onChange={e=>setTriggerPrice(e.target.value)} style={{ flex:1, background:'transparent', border:'none', color:'#fff', fontSize:16, outline:'none', minWidth:0, textAlign:'right', fontFamily: 'var(--font-mono)' }} />
              <span style={{ fontSize:12, color:'#8e8e93', marginLeft: 8 }}>USD</span>
            </div>
          )}

          {orderType === 'twap' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display:'flex', alignItems:'center', background:'var(--color-bg0)', border:'1px solid var(--color-border)', borderRadius:8, padding:'6px 10px', transition:'border 0.2s' }}>
                <span style={{ fontSize:13, color:'#8e8e93', marginRight:8, whiteSpace:'nowrap' }}>Hours</span>
                <input type="number" placeholder="0" min="0" value={durationHours} onChange={e=>setDurationHours(e.target.value)} style={{ flex:1, background:'transparent', border:'none', color:'#fff', fontSize:16, outline:'none', minWidth:0, textAlign:'right', fontFamily: 'var(--font-mono)' }} />
              </div>
              <div style={{ display:'flex', alignItems:'center', background:'var(--color-bg0)', border:'1px solid var(--color-border)', borderRadius:8, padding:'6px 10px', transition:'border 0.2s' }}>
                <span style={{ fontSize:13, color:'#8e8e93', marginRight:8, whiteSpace:'nowrap' }}>Minutes</span>
                <input type="number" placeholder="0" min="0" max="59" value={durationMins} onChange={e=>setDurationMins(e.target.value)} style={{ flex:1, background:'transparent', border:'none', color:'#fff', fontSize:16, outline:'none', minWidth:0, textAlign:'right', fontFamily: 'var(--font-mono)' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Order Size Input */}
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        <div style={{ display:'flex', alignItems:'center', background:'var(--color-bg0)', border:(size !== '' && !sizeNum)?'1px solid var(--color-red)':'1px solid var(--color-border)', borderRadius:8, padding:'6px 10px', transition:'border 0.2s' }}>
          <span style={{ fontSize:13, color:'#8e8e93', marginRight:8, whiteSpace:'nowrap' }}>Order Size</span>
          <input type="number" placeholder="0" value={size} onChange={e=>handleSizeChange(e.target.value)} style={{ flex:1, background:'transparent', border:'none', color:'#fff', fontSize:16, outline:'none', minWidth:0 }} />
          <div style={{ display:'flex', background:'var(--color-bg2)', borderRadius:4, padding:2, marginLeft:8 }}>
            <span 
              onClick={() => toggleCurrency('BASE')}
              style={{ padding:'2px 6px', fontSize:11, cursor:'pointer', color: inputCurrency === 'BASE' ? '#fff' : '#8e8e93', background: inputCurrency === 'BASE' ? 'var(--color-bg3)' : 'transparent', borderRadius:2 }}
            >{activeMarket.baseAsset}</span>
            <span 
              onClick={() => toggleCurrency('USD')}
              style={{ padding:'2px 6px', fontSize:11, cursor:'pointer', color: inputCurrency === 'USD' ? '#fff' : '#8e8e93', background: inputCurrency === 'USD' ? 'var(--color-bg3)' : 'transparent', borderRadius:2 }}
            >USD</span>
          </div>
        </div>
        {(size !== '' && !sizeNum) && (
          <div style={{ color:'#e55f48', fontSize:11, display:'flex', alignItems:'center', gap:4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            Must be at least 0.00002
          </div>
        )}
      </div>

      {/* Percent Slider */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <input type="range" min={0} max={100} value={sizePercent} onChange={e=>handleSizePercentChange(Number(e.target.value))} style={{ flex:1, accentColor:'#eab308' }} />
        <div style={{ border:'1px solid var(--color-border)', borderRadius:6, padding:'4px 8px', fontSize:12, display:'flex', alignItems:'center', gap:2, background:'var(--color-bg2)' }}>
          <span>{sizePercent.toFixed(0)}</span>
          <span style={{ color:'#8e8e93' }}>%</span>
        </div>
      </div>

      {/* Checkboxes */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
          <input type="checkbox" checked={showTpSl} onChange={()=>setShowTpSl(!showTpSl)} style={{ accentColor:'#8e8e93', width:14, height:14, cursor:'pointer', background:'var(--color-bg2)', border:'1px solid var(--color-border)', borderRadius:4 }} />
          <span style={{ fontSize:12, color:'#8e8e93', borderBottom:'1px dashed var(--color-border)', paddingBottom:2 }}>Take Profit / Stop Loss</span>
        </label>

        {showTpSl && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4, animationDuration: '200ms' }}>
            <div style={{ display:'flex', flexDirection:'column', background:'var(--color-bg0)', border:'1px solid var(--color-border)', borderRadius:8, padding:'6px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize:11, color:'#8e8e93' }}>Take Profit</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[25, 50, 100, 300].map(p => (
                    <span key={p} onClick={() => handleTpPercent(p)} style={{ fontSize: 10, cursor: 'pointer', color: '#4BFF99', background: 'rgba(75, 255, 153, 0.1)', padding: '2px 6px', borderRadius: 4, fontWeight: 600, transition: 'background 0.2s' }}>{p}%</span>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center' }}>
                <input type="number" placeholder="0.00" value={takeProfit} onChange={e=>setTakeProfit(e.target.value)} style={{ flex:1, background:'transparent', border:'none', color:'#fff', fontSize:16, outline:'none', minWidth:0, fontFamily: 'var(--font-mono)' }} />
                <span style={{ fontSize:11, color:'#8e8e93' }}>USD</span>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', background:'var(--color-bg0)', border:'1px solid var(--color-border)', borderRadius:8, padding:'6px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize:11, color:'#8e8e93' }}>Stop Loss</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[10, 25, 50, 75].map(p => (
                    <span key={p} onClick={() => handleSlPercent(p)} style={{ fontSize: 10, cursor: 'pointer', color: '#ff4b4b', background: 'rgba(255, 75, 75, 0.1)', padding: '2px 6px', borderRadius: 4, fontWeight: 600, transition: 'background 0.2s' }}>-{p}%</span>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center' }}>
                <input type="number" placeholder="0.00" value={stopLoss} onChange={e=>setStopLoss(e.target.value)} style={{ flex:1, background:'transparent', border:'none', color:'#fff', fontSize:16, outline:'none', minWidth:0, fontFamily: 'var(--font-mono)' }} />
                <span style={{ fontSize:11, color:'#8e8e93' }}>USD</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button 
        onClick={handleSubmit} 
        disabled={isTxPending || isMarketClosed || isPositionsLoading || (isConnected && (!sizeNum || isInsufficientBalance || exceedsLiquidity))} 
        style={{ 
          width: '100%', 
          padding: '10px', 
          borderRadius: '8px', 
          border: 'none', 
          boxShadow: 'none',
          background: !isConnected 
            ? 'var(--color-green, #26c68b)' 
            : (isTxPending || isMarketClosed || isPositionsLoading || !sizeNum || isInsufficientBalance || exceedsLiquidity) 
              ? 'var(--color-bg3)' 
              : (side === 'long' ? 'var(--color-green, #26c68b)' : 'var(--color-red)'), 
          color: !isConnected 
            ? '#0b0e11' 
            : (isTxPending || isMarketClosed || isPositionsLoading || !sizeNum || isInsufficientBalance || exceedsLiquidity) 
              ? '#8e8e93' 
              : (side === 'long' ? '#0b0e11' : '#fff'), 
          fontSize: '15px', 
          fontWeight: 600, 
          cursor: (isTxPending || isMarketClosed || isPositionsLoading || (isConnected && (!sizeNum || isInsufficientBalance || exceedsLiquidity))) ? 'not-allowed' : 'pointer',
          marginTop: 4
        }}
      >
        {isTxPending 
          ? 'Processing...' 
          : isMarketClosed
            ? 'Market Closed'
            : isPositionsLoading
            ? 'Syncing Positions...'
          : !isConnected 
            ? 'Connect Wallet' 
            : exceedsLiquidity
              ? `❌ Max Capacity: $${availableLiquidity >= 1e6 ? (availableLiquidity / 1e6).toFixed(2) + 'M' : availableLiquidity >= 1e3 ? (availableLiquidity / 1e3).toFixed(2) + 'K' : availableLiquidity.toFixed(2)}`
              : isInsufficientBalance 
                ? 'Insufficient Balance' 
                : orderType === 'limit' || orderType === 'stop market'
                  ? `Place ${orderType === 'limit' ? 'Limit' : 'Stop'} Order`
                  : (currentPosition && orderType === 'market') 
                    ? `Average / Increase ${activeMarket.baseAsset}` 
                    : `${side === 'long' ? 'Buy / Long' : 'Sell / Short'} ${activeMarket.baseAsset}`
        }
      </button>
      {/* Summary Stats */}
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 11 }}>
        <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'#8e8e93' }}>Leverage</span><span style={{ color:'#fbbf24' }}>{leverage}x</span></div>
        <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'#8e8e93' }}>Position Size</span><span style={{ color:'#fbbf24' }}>{baseSize ? baseSize.toFixed(4) : '0.00'} {activeMarket.baseAsset} / ${orderSummary?.notional || '0.00'}</span></div>
        <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'#8e8e93' }}>Est. Liq. Price</span><span style={{ borderBottom:'1px dashed var(--color-border)' }}>{orderSummary?.liqPrice ? `$${orderSummary.liqPrice}` : 'N/A'}</span></div>
        <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'#8e8e93' }}>Margin Required</span><span>${orderSummary?.collateral || '0.00'}</span></div>
        <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'#8e8e93' }}>Est. Fee ({orderType === 'limit' ? '0.03%' : '0.05%'})</span><span style={{ borderBottom:'1px dashed var(--color-border)' }}>${orderSummary?.fees || '0.00'}</span></div>
        {Number(orderSummary?.feeDiscount) > 0 && (
          <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'#26c68b' }}>Fee Discount (25%)</span><span style={{ borderBottom:'1px dashed var(--color-border)', color:'#26c68b' }}>-${orderSummary?.feeDiscount}</span></div>
        )}
        <div style={{ display:'flex', justifyContent:'space-between' }}>
          <span style={{ color:'#8e8e93' }}>Price Impact (Penalty)</span>
          <span style={{ borderBottom:'1px dashed var(--color-border)', color: priceImpactPct > 0 ? '#e55f48' : '#fff' }}>
            {priceImpactPct > 0 ? '-' : ''}${Math.abs(priceImpactVal).toFixed(2)} ({priceImpactPct > 0 ? '-' : ''}{Math.abs(priceImpactPct).toFixed(4)}%)
          </span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ color:'#8e8e93', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Allowed Slippage
            {Number(slippage) > 1 && (
              <span style={{ color: '#e55f48', fontSize: '9px', padding: '1px 4px', background: 'rgba(229,95,72,0.1)', borderRadius: '4px', border: '1px solid rgba(229,95,72,0.3)' }}>High</span>
            )}
          </span>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            <button 
              type="button" 
              onClick={() => setShowSlippageSlider(!showSlippageSlider)} 
              style={{ background:'transparent', border:'none', color: showSlippageSlider ? 'var(--color-primary)' : '#8e8e93', cursor:'pointer', fontSize:'11px', textDecoration:'underline', transition: 'color 0.2s' }}
            >
              Custom
            </button>
            <div style={{ display:'flex', alignItems:'center', background:'var(--color-bg2)', padding:'4px 8px', borderRadius:'4px', border:'1px solid var(--color-border)' }}>
              <span style={{ color:'#fff', width:'36px', textAlign:'right', fontSize:'11px', fontFamily:'var(--font-mono)' }}>{Number(slippage).toFixed(2)}</span>
              <span style={{ color:'#8e8e93', marginLeft:'2px', fontSize:'11px' }}>%</span>
            </div>
          </div>
        </div>
        {showSlippageSlider && (
          <div style={{ marginTop: '4px', padding: '12px', background: 'var(--color-bg2)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#8e8e93', marginBottom: '8px' }}>
              <span>0.1% (Min)</span>
              <span style={{ color: Number(slippage) > 1 ? '#e55f48' : 'var(--color-primary)', fontWeight: 600, fontSize: '12px' }}>{slippage}%</span>
              <span>5.0% (Max)</span>
            </div>
            <input 
              type="range" 
              min="0.1" 
              max="5.0" 
              step="0.1" 
              value={slippage} 
              onChange={(e) => setSlippage(e.target.value)}
              style={{ width: '100%', cursor: 'pointer', accentColor: '#fbbf24', height: '4px' }}
            />
          </div>
        )}
      </div>
      </div>

      {/* Account Overview (Hidden on Mobile) */}
      <div className="account-overview-box" style={{ border:'1px solid var(--color-border)', borderRadius:'8px', padding:'16px', display:'flex', flexDirection:'column', gap:'8px', fontSize:11, background:'var(--color-bg1)' }}>
        <div style={{ fontWeight:600, marginBottom:2, fontSize:12 }}>Account Overview</div>
        <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'#8e8e93' }}>Total Equity</span><span className="font-mono">${equity.toFixed(2)}</span></div>
        <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'#8e8e93' }}>Available Balance</span><span className="font-mono">${balance.toFixed(2)}</span></div>
        <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'#8e8e93' }}>PnL (Unrealized)</span><span className={`font-mono ${unrealizedPnl >= 0 ? 'text-green' : 'text-red'}`}>{unrealizedPnl >= 0 ? '+' : ''}${Math.abs(unrealizedPnl).toFixed(2)}</span></div>
        <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'#8e8e93' }}>Margin Type</span><span className="font-mono">Isolated</span></div>
      </div>

      {/* Adjust Leverage Modal */}
      {isLeverageModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}>
          <div className="animate-fade-in" style={{ background: 'var(--color-bg0)', padding: '24px', borderRadius: '16px', width: '90%', maxWidth: '340px', border: '1px solid var(--color-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 600, color: '#fff' }}>Adjust Leverage</h3>
            
            <div style={{ background: 'var(--color-bg1)', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input 
                type="number"
                min="1" max={maxLeverage}
                value={tempLeverage}
                onChange={(e) => setTempLeverage(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '16px', outline: 'none', width: '32px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}
              />
              <span style={{ color: '#8e8e93', fontSize: '15px', fontWeight: 500, marginLeft: '2px' }}>x</span>
            </div>

            <div style={{ marginBottom: '32px', position: 'relative' }}>
              <input 
                type="range" 
                min="1" max={maxLeverage} 
                value={Number(tempLeverage) || 1} 
                onChange={(e) => setTempLeverage(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#fbbf24', height: '4px', cursor: 'pointer' }} 
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8e8e93', marginTop: '12px', fontWeight: 500 }}>
                <span>1x</span>
                <span>{maxLeverage}x</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setIsLeverageModalOpen(false)}
                style={{ flex: 1, padding: '14px', background: '#3a3a3c', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  const val = Math.min(maxLeverage, Math.max(1, Math.round(Number(tempLeverage) || 1)));
                  setLeverage(val);
                  setIsLeverageModalOpen(false);
                }}
                style={{ flex: 1, padding: '14px', background: 'var(--color-accent)', color: '#000', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .account-overview-box {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useConfidentialTrading } from '../hooks/useConfidentialTrading'

export interface PartialCloseData {
  positionId: number
  pair: string
  pythPriceId: string
  isLong: boolean
  maxSize: number
}

interface PartialCloseModalProps {
  isOpen: boolean
  onClose: () => void
  data: PartialCloseData | null
}

export default function PartialCloseModal({ isOpen, onClose, data }: PartialCloseModalProps) {
  const { closePosition, closePositionPartial, isTxPending } = useConfidentialTrading()
  const [amount, setAmount] = useState('')
  const [percentage, setPercentage] = useState<number | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setAmount('')
      setPercentage(null)
    }
  }, [isOpen])

  if (!isOpen || !data) return null

  const handlePercentageClick = (pct: number) => {
    setPercentage(pct)
    if (pct === 100) {
      setAmount(data.maxSize.toString()) // Use exact max size for 100%
    } else {
      setAmount(((data.maxSize * pct) / 100).toFixed(2))
    }
  }

  const handleAmountChange = (val: string) => {
    setAmount(val)
    setPercentage(null)
  }

  const handleSubmit = async () => {
    try {
      const amt = Number(amount)
      if (amt <= 0 || amt > data.maxSize) return
      
      const closePercentBps = Math.floor((amt / data.maxSize) * 10000)
      
      if (amt === data.maxSize || closePercentBps >= 10000) {
        await closePosition(BigInt(data.positionId))
      } else {
        await closePositionPartial(BigInt(data.positionId), closePercentBps)
      }
      onClose()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}>
      <div className="animate-fade-in" style={{ background: '#121214', padding: '24px', borderRadius: '16px', width: '90%', maxWidth: '340px', border: '1px solid #2c2c2e', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#fff' }}>Partial Close</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8e8e93', cursor: 'pointer', padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div style={{ fontSize: 13, color: '#8e8e93' }}>
          Market: <span style={{ color: '#fff', fontWeight: 500 }}>{data.pair}</span> 
          <span className={data.isLong ? 'text-green' : 'text-red'} style={{ marginLeft: 8, textTransform: 'uppercase', fontSize: 11, fontWeight: 600 }}>{data.isLong ? 'LONG' : 'SHORT'}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8e8e93' }}>
            <span>Close Size</span>
            <span>Max: ${data.maxSize.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg0)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 12px' }}>
            <input 
              type="number" 
              placeholder="0.00" 
              value={amount} 
              onChange={e => handleAmountChange(e.target.value)} 
              max={data.maxSize}
              style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: 15, outline: 'none', fontFamily: 'var(--font-mono)' }} 
            />
            <span style={{ fontSize: 12, color: '#8e8e93' }}>USD</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {[25, 50, 75, 100].map(pct => (
            <button
              key={pct}
              onClick={() => handlePercentageClick(pct)}
              style={{ flex: 1, padding: '4px 0', fontSize: 11, background: percentage === pct ? 'var(--color-bg3)' : 'var(--color-bg1)', color: percentage === pct ? '#fff' : '#8e8e93', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer' }}
            >
              {pct}%
            </button>
          ))}
        </div>

        <button 
          onClick={handleSubmit} 
          disabled={isTxPending || !amount || Number(amount) <= 0 || Number(amount) > data.maxSize}
          style={{ width: '100%', padding: '12px', background: isTxPending || !amount || Number(amount) <= 0 || Number(amount) > data.maxSize ? 'var(--color-bg3)' : 'var(--color-red)', color: isTxPending || !amount || Number(amount) <= 0 || Number(amount) > data.maxSize ? '#8e8e93' : '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: isTxPending || !amount || Number(amount) <= 0 || Number(amount) > data.maxSize ? 'not-allowed' : 'pointer', transition: 'background 0.2s', marginTop: 8 }}
        >
          {isTxPending ? 'Processing...' : 'Confirm Close'}
        </button>
      </div>
    </div>
  )
}

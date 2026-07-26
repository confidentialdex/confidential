import React from 'react'

export function TierBadgeIcon({ tier, style }: { tier: string; style?: React.CSSProperties }) {
  const t = tier.toLowerCase()
  if (t.includes('diamond')) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--color-accent)', filter: 'drop-shadow(0 0 3px var(--color-accent))', verticalAlign: 'middle', ...style }}>
        <path d="M12 2L2 12l10 10 10-10z" fill="rgba(46, 189, 133, 0.2)" />
      </svg>
    )
  }
  if (t.includes('gold')) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#FFB020', filter: 'drop-shadow(0 0 3px rgba(255, 176, 32, 0.4))', verticalAlign: 'middle', ...style }}>
        <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5" fill="rgba(255, 176, 32, 0.15)" />
      </svg>
    )
  }
  // Silver
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#A0A8B4', verticalAlign: 'middle', ...style }}>
      <circle cx="12" cy="12" r="10" fill="rgba(160, 168, 180, 0.15)" />
    </svg>
  )
}

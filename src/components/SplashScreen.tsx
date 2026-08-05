import { useEffect, useState } from 'react'

let hasLoadedOnce = false

export default function SplashScreen() {
  const [isVisible, setIsVisible] = useState(!hasLoadedOnce)
  const [isFadingOut, setIsFadingOut] = useState(false)

  useEffect(() => {
    if (hasLoadedOnce) return;

    // Keep it fully visible for 2500ms, then start fading out
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true)
    }, 2500)

    // Remove from DOM completely after fade out completes
    const removeTimer = setTimeout(() => {
      setIsVisible(false)
      hasLoadedOnce = true
    }, 2800) // 2500ms + 300ms fade duration

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [])

  if (!isVisible) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#0d1117', // Match var(--color-bg0)
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isFadingOut ? 0 : 1,
        transition: 'opacity 300ms ease-in-out',
        pointerEvents: isFadingOut ? 'none' : 'auto'
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}
      >
        <img 
          src="/logo.png" 
          alt="Loading..." 
          style={{ 
            width: '64px', 
            height: '64px',
            animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }} 
        />
        <style>
          {`
            @keyframes pulse {
              0%, 100% {
                opacity: 1;
                transform: scale(1);
              }
              50% {
                opacity: .5;
                transform: scale(0.9);
              }
            }
          `}
        </style>
      </div>
    </div>
  )
}

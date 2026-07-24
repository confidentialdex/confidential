import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Topbar from './components/Topbar'

import Trade from './pages/Trade'
import Vault from './pages/Vault'
import Portfolio from './pages/Portfolio'
import Home from './pages/Home'
import { usePythPrices } from './hooks/usePythPrices'
import { useMarketVolumes } from './hooks/useGoldsky'

function PythPriceLoader() {
  usePythPrices()
  return null
}

function MarketVolumeLoader() {
  useMarketVolumes()
  return null
}

export default function App() {
  const location = useLocation()
  const isHome = location.pathname === '/'


  return (
    <>
      <Toaster position="top-right" toastOptions={{
        style: {
          background: 'rgba(26, 26, 26, 0.85)',
          backdropFilter: 'blur(12px)',
          color: '#F2F2F2',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          fontSize: '13px',
          fontWeight: 500,
          padding: '12px 16px',
        },
        success: {
          iconTheme: {
            primary: '#00E599',
            secondary: '#1A1A1A',
          },
        },
        error: {
          iconTheme: {
            primary: '#FF4A4A',
            secondary: '#1A1A1A',
          },
        },
      }} />
      <MarketVolumeLoader />
      {/* Only load Pyth prices on non-home pages to prevent trade state interference */}
      {!isHome && <PythPriceLoader />}
      {!isHome && <Topbar />}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: isHome ? 0 : 60 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/trade" element={<Trade />} />
          <Route path="/vaults" element={<Vault />} />
          <Route path="/portfolio" element={<Portfolio />} />

          {/* Catch-all: redirect any unknown route to Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

    </>
  )
}

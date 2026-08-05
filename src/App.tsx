import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Topbar from './components/Topbar'

import Trade from './pages/Trade'
import Vault from './pages/Vault'
import Portfolio from './pages/Portfolio'
import Leaderboard from './pages/Leaderboard'
import Home from './pages/Home'
import { usePythPrices } from './hooks/usePythPrices'
import { useMarketVolumes } from './hooks/useGoldsky'
import { useContractEvents } from './hooks/useContractEvents'

function PythPriceLoader() {
  usePythPrices()
  return null
}

function MarketVolumeLoader() {
  useMarketVolumes()
  return null
}

function EventWatcherLoader() {
  useContractEvents()
  return null
}

export default function App() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  const DummyPage = ({ title }: { title: string }) => (
    <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--color-text3)' }}>
      <h2>{title}</h2>
      <p>Coming soon...</p>
    </div>
  )


  return (
    <>
      <Toaster position="top-right" toastOptions={{
        style: {
          background: 'rgba(22, 27, 34, 0.94)',
          backdropFilter: 'blur(12px)',
          color: '#d1d4dc',
          border: '1px solid #21262d',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          fontSize: '13px',
          fontWeight: 500,
          padding: '12px 16px',
        },
        success: {
          iconTheme: {
            primary: '#26a69a',
            secondary: '#0d1117',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef5350',
            secondary: '#0d1117',
          },
        },
      }} />
      <MarketVolumeLoader />
      {/* Only load Pyth prices on non-home pages to prevent trade state interference */}
      {!isHome && <PythPriceLoader />}
      {!isHome && <EventWatcherLoader />}
      {!isHome && <Topbar />}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: isHome ? 0 : 60 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/trade" element={<Trade />} />
          <Route path="/vaults" element={<Vault />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/referrals" element={<DummyPage title="Referrals" />} />
          <Route path="/points" element={<DummyPage title="Points" />} />
          <Route path="/leaderboard" element={<Leaderboard />} />

          {/* Catch-all: redirect any unknown route to Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

    </>
  )
}

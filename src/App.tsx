import { NavLink, Route, Routes } from 'react-router-dom'
import { CurrencyProvider, useCurrency } from './context/CurrencyContext'
import Dashboard from './pages/Dashboard'
import Entries from './pages/Entries'
import Portfolio from './pages/Portfolio'
import Settings from './pages/Settings'
import './App.css'

function CurrencyToggle() {
  const { currency, setCurrency } = useCurrency()
  return (
    <div className="currency-toggle">
      <button
        className={currency === 'ARS' ? 'active' : ''}
        onClick={() => setCurrency('ARS')}
      >
        ARS
      </button>
      <button
        className={currency === 'USD' ? 'active' : ''}
        onClick={() => setCurrency('USD')}
      >
        USD
      </button>
    </div>
  )
}

function VisibilityToggle() {
  const { amountsHidden, toggleAmountsHidden } = useCurrency()
  return (
    <button
      className={`visibility-toggle${amountsHidden ? ' active' : ''}`}
      onClick={toggleAmountsHidden}
      title={amountsHidden ? 'Show amounts' : 'Hide amounts'}
    >
      {amountsHidden ? '○' : '●'}
    </button>
  )
}

export default function App() {
  return (
    <CurrencyProvider>
      <div className="app">
        <header className="app-header">
          <span className="app-title">Personal Finances</span>
          <nav className="app-nav">
            <NavLink to="/" end>Dashboard</NavLink>
            <NavLink to="/entries">Entries</NavLink>
            <NavLink to="/portfolio">Portfolio</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </nav>
          <CurrencyToggle />
          <VisibilityToggle />
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/entries" element={<Entries />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </CurrencyProvider>
  )
}

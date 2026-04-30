import { createContext, useContext } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

type Currency = 'ARS' | 'USD'

interface CurrencyContextType {
  currency: Currency
  setCurrency: (c: Currency) => void
  usdRate: number
  setUsdRate: (rate: number) => void
  convert: (amount: number) => number
}

const CurrencyContext = createContext<CurrencyContextType | null>(null)

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useLocalStorage<Currency>('pf-currency', 'ARS')
  const [usdRate, setUsdRate] = useLocalStorage<number>('pf-usd-rate', 1)

  const convert = (amount: number) => currency === 'USD' ? amount / usdRate : amount

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, usdRate, setUsdRate, convert }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider')
  return ctx
}

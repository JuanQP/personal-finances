import { createContext, useContext } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

type Currency = 'ARS' | 'USD'

interface CurrencyContextType {
  currency: Currency
  setCurrency: (c: Currency) => void
  usdRate: number
  setUsdRate: (rate: number) => void
  convert: (amount: number) => number
  amountsHidden: boolean
  toggleAmountsHidden: () => void
}

const CurrencyContext = createContext<CurrencyContextType | null>(null)

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useLocalStorage<Currency>('pf-currency', 'ARS')
  const [usdRate, setUsdRate] = useLocalStorage<number>('pf-usd-rate', 1)
  const [amountsHidden, setAmountsHidden] = useLocalStorage<boolean>('pf-amounts-hidden', false)

  const convert = (amount: number) => currency === 'USD' ? amount / usdRate : amount
  const toggleAmountsHidden = () => setAmountsHidden(h => !h)

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, usdRate, setUsdRate, convert, amountsHidden, toggleAmountsHidden }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider')
  return ctx
}

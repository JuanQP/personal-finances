import { useState } from 'react'
import { useCurrency } from '../context/CurrencyContext'

export default function Settings() {
  const { usdRate, setUsdRate } = useCurrency()
  const [input, setInput] = useState(String(usdRate))
  const [saved, setSaved] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = parseFloat(input)
    if (isNaN(parsed) || parsed <= 0) return
    setUsdRate(parsed)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="settings">
      <h2>Currency</h2>
      <p className="settings-description">
        Set the exchange rate used to convert your ARS values to USD. For example, if 1 USD = 1,000 ARS, enter 1000.
      </p>
      <form className="settings-form" onSubmit={handleSubmit}>
        <label>
          <span>1 USD =</span>
          <input
            type="number"
            value={input}
            min="0"
            step="any"
            onChange={e => { setInput(e.target.value); setSaved(false) }}
          />
          <span>ARS</span>
        </label>
        <button type="submit">{saved ? 'Saved!' : 'Save'}</button>
      </form>
    </div>
  )
}

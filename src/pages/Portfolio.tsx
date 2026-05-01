import { useState, useEffect } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useCurrency } from '../context/CurrencyContext'
import { fmt, uuid } from '../utils'
import type { Position, HistoricalEntry, Ticker } from '../types'

interface EditState {
  id: string
  ticker: string
  quantity: string
  bucket: string
}

interface PriceEditState {
  ticker: string
  price: string
  multiplier: string
  description: string
}

function positionValue(p: Position, tickers: Record<string, Ticker>) {
  const t = tickers[p.ticker]
  return t ? t.price * t.multiplier * p.quantity : 0
}

export default function Portfolio() {
  const [positions, setPositions] = useLocalStorage<Position[]>('pf-positions', [])
  const [tickers, setTickers] = useLocalStorage<Record<string, Ticker>>('pf-tickers', {})
  const [history, setHistory] = useLocalStorage<HistoricalEntry[]>('pf-portfolio-history', [])

  // One-time migration: if pf-tickers is empty but old positions still carry price/multiplier,
  // extract them into pf-tickers and also pull in pf-ticker-descriptions.
  useEffect(() => {
    if (Object.keys(tickers).length === 0 && positions.length > 0 && 'price' in (positions[0] as any)) {
      const oldDescs: Record<string, string> = JSON.parse(localStorage.getItem('pf-ticker-descriptions') || '{}')
      const migrated: Record<string, Ticker> = {}
      for (const p of positions as any[]) {
        if (!migrated[p.ticker]) {
          migrated[p.ticker] = { price: p.price, multiplier: p.multiplier }
          if (oldDescs[p.ticker]) migrated[p.ticker].description = oldDescs[p.ticker]
        }
      }
      setTickers(migrated)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [historyText, setHistoryText] = useState(() =>
    history.map(e => `${e.date},${e.amount}`).join('\n')
  )
  const [historySaved, setHistorySaved] = useState(false)
  const [historyError, setHistoryError] = useState('')

  const [bulkPricesText, setBulkPricesText] = useState('')
  const [bulkPricesSaved, setBulkPricesSaved] = useState(false)
  const [bulkPricesError, setBulkPricesError] = useState('')

  const [bulkHoldingsText, setBulkHoldingsText] = useState('')
  const [bulkHoldingsSaved, setBulkHoldingsSaved] = useState(false)
  const [bulkHoldingsError, setBulkHoldingsError] = useState('')

  useEffect(() => {
    setBulkPricesText(
      Object.entries(tickers)
        .map(([name, t]) => `${name},${t.price},${t.multiplier},${t.description ?? ''}`)
        .join('\n')
    )
  }, [tickers])

  useEffect(() => {
    setBulkHoldingsText(
      positions.map(p => `${p.ticker},${p.quantity},${p.bucket}`).join('\n')
    )
  }, [positions])

  const { currency, convert } = useCurrency()

  const [ticker, setTicker] = useState('')
  const [price, setPrice] = useState('')
  const [multiplier, setMultiplier] = useState('1')
  const [quantity, setQuantity] = useState('')
  const [bucket, setBucket] = useState('')

  const [editing, setEditing] = useState<EditState | null>(null)
  const [editingPrice, setEditingPrice] = useState<PriceEditState | null>(null)

  const existingBuckets = [...new Set(positions.map(p => p.bucket).filter(Boolean))]
  const tickerKey = ticker.trim().toUpperCase()
  const existingTicker = tickers[tickerKey] ?? null

  function addPosition(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsedQty = parseFloat(quantity)
    if (!tickerKey || !bucket.trim() || isNaN(parsedQty) || parsedQty <= 0) return

    if (!existingTicker) {
      const parsedPrice = parseFloat(price)
      const parsedMult = parseFloat(multiplier)
      if (isNaN(parsedPrice) || parsedPrice <= 0) return
      if (isNaN(parsedMult) || parsedMult <= 0) return
      setTickers(prev => ({ ...prev, [tickerKey]: { price: parsedPrice, multiplier: parsedMult } }))
    }

    setPositions(prev => [...prev, { id: uuid(), ticker: tickerKey, quantity: parsedQty, bucket: bucket.trim() }])
    setTicker('')
    setPrice('')
    setMultiplier('1')
    setQuantity('')
  }

  function removePosition(id: string) {
    setPositions(prev => prev.filter(p => p.id !== id))
  }

  function startEdit(p: Position) {
    setEditing({ id: p.id, ticker: p.ticker, quantity: String(p.quantity), bucket: p.bucket })
  }

  function saveEdit() {
    if (!editing) return
    const parsedQty = parseFloat(editing.quantity)
    if (!editing.ticker.trim() || !editing.bucket.trim() || isNaN(parsedQty) || parsedQty <= 0) return
    setPositions(prev =>
      prev.map(p =>
        p.id === editing.id
          ? { ...p, ticker: editing.ticker.trim().toUpperCase(), quantity: parsedQty, bucket: editing.bucket.trim() }
          : p
      )
    )
    setEditing(null)
  }

  function cancelEdit() { setEditing(null) }

  function startPriceEdit(name: string) {
    const t = tickers[name]
    if (!t) return
    setEditingPrice({ ticker: name, price: String(t.price), multiplier: String(t.multiplier), description: t.description ?? '' })
  }

  function savePriceEdit() {
    if (!editingPrice) return
    const parsedPrice = parseFloat(editingPrice.price)
    const parsedMult = parseFloat(editingPrice.multiplier)
    if (isNaN(parsedPrice) || parsedPrice <= 0 || isNaN(parsedMult) || parsedMult <= 0) return
    setTickers(prev => ({
      ...prev,
      [editingPrice.ticker]: {
        price: parsedPrice,
        multiplier: parsedMult,
        ...(editingPrice.description.trim() ? { description: editingPrice.description.trim() } : {}),
      },
    }))
    setEditingPrice(null)
  }

  function cancelPriceEdit() { setEditingPrice(null) }

  function saveBulkPrices() {
    const lines = bulkPricesText.split('\n').map(l => l.trim()).filter(Boolean)
    const updates: Record<string, Ticker> = {}
    const bad: string[] = []

    for (const line of lines) {
      const [name, rawPrice, rawMult, ...descParts] = line.split(',').map(s => s.trim())
      const price = parseFloat(rawPrice)
      const multiplier = parseFloat(rawMult)
      if (!name || isNaN(price) || price <= 0 || isNaN(multiplier) || multiplier <= 0) {
        bad.push(line); continue
      }
      const t: Ticker = { price, multiplier }
      const desc = descParts.join(',').trim()
      if (desc) t.description = desc
      updates[name.toUpperCase()] = t
    }

    if (bad.length > 0) { setBulkPricesError(`Could not parse: ${bad.join(' · ')}`); return }
    setBulkPricesError('')
    setTickers(updates)
    setBulkPricesSaved(true)
    setTimeout(() => setBulkPricesSaved(false), 2000)
  }

  function saveBulkHoldings() {
    const lines = bulkHoldingsText.split('\n').map(l => l.trim()).filter(Boolean)
    const parsed: Position[] = []
    const bad: string[] = []

    for (const line of lines) {
      const [name, rawQty, ...bucketParts] = line.split(',').map(s => s.trim())
      const quantity = parseFloat(rawQty)
      const bucket = bucketParts.join(',').trim()
      if (!name || !bucket || isNaN(quantity) || quantity <= 0) {
        bad.push(line); continue
      }
      parsed.push({ id: uuid(), ticker: name.toUpperCase(), quantity, bucket })
    }

    if (bad.length > 0) { setBulkHoldingsError(`Could not parse: ${bad.join(' · ')}`); return }
    setBulkHoldingsError('')
    setPositions(parsed)
    setBulkHoldingsSaved(true)
    setTimeout(() => setBulkHoldingsSaved(false), 2000)
  }

  function saveHistory() {
    const lines = historyText.split('\n').map(l => l.trim()).filter(Boolean)
    const parsed: HistoricalEntry[] = []
    const bad: string[] = []

    for (const line of lines) {
      const [date, rawAmount] = line.split(',').map(s => s.trim())
      const amount = parseFloat(rawAmount)
      if (!date || isNaN(amount) || amount < 0) { bad.push(line); continue }
      parsed.push({ date, amount })
    }

    if (bad.length > 0) { setHistoryError(`Could not parse: ${bad.join(' · ')}`); return }
    setHistoryError('')
    parsed.sort((a, b) => a.date.localeCompare(b.date))
    setHistory(parsed)
    setHistorySaved(true)
    setTimeout(() => setHistorySaved(false), 2000)
  }

  const buckets = positions.reduce<Record<string, Position[]>>((acc, p) => {
    if (!acc[p.bucket]) acc[p.bucket] = []
    acc[p.bucket].push(p)
    return acc
  }, {})

  const tickerEntries = Object.entries(tickers)

  function renderPositionRow(p: Position) {
    if (editing?.id === p.id) {
      return (
        <tr key={p.id} className="position-row editing">
          <td>
            <input className="edit-input" value={editing.ticker}
              onChange={e => setEditing(prev => prev && { ...prev, ticker: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
              autoFocus />
          </td>
          <td>
            <input className="edit-input edit-number" type="number" value={editing.quantity} min="0" step="any"
              onChange={e => setEditing(prev => prev && { ...prev, quantity: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }} />
          </td>
          <td className="col-bucket">
            <input className="edit-input" value={editing.bucket} list="bucket-list"
              onChange={e => setEditing(prev => prev && { ...prev, bucket: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }} />
          </td>
          <td className="col-value">—</td>
          <td className="col-actions">
            <button className="action save" onClick={saveEdit} aria-label="Save">✓</button>
            <button className="action cancel" onClick={cancelEdit} aria-label="Cancel">×</button>
          </td>
        </tr>
      )
    }
    return (
      <tr key={p.id} className="position-row">
        <td className="col-ticker">
          {p.ticker}
          {tickers[p.ticker]?.description && (
            <span className="ticker-description">{tickers[p.ticker].description}</span>
          )}
        </td>
        <td className="col-number">{p.quantity}</td>
        <td className="col-bucket">{p.bucket}</td>
        <td className="col-value">{fmt(Math.round(convert(positionValue(p, tickers))))} {currency}</td>
        <td className="col-actions">
          <button className="action edit" onClick={() => startEdit(p)} aria-label="Edit">✎</button>
          <button className="action remove" onClick={() => removePosition(p.id)} aria-label="Remove">×</button>
        </td>
      </tr>
    )
  }

  return (
    <>
      <datalist id="bucket-list">
        {existingBuckets.map(b => <option key={b} value={b} />)}
      </datalist>

      <form className="position-form" onSubmit={addPosition}>
        <input placeholder="Ticker" value={ticker} onChange={e => setTicker(e.target.value)} />
        {existingTicker ? (
          <>
            <input className="input-locked" value={`${fmt(existingTicker.price)} ARS`} readOnly title="Managed via the Prices panel" />
            <input className="input-locked" value={`×${existingTicker.multiplier}`} readOnly title="Managed via the Prices panel" />
          </>
        ) : (
          <>
            <input type="number" placeholder="Price (ARS)" value={price} min="0" step="any" onChange={e => setPrice(e.target.value)} />
            <input type="number" placeholder="Multiplier" value={multiplier} min="0" step="any" onChange={e => setMultiplier(e.target.value)} />
          </>
        )}
        <input type="number" placeholder="Quantity" value={quantity} min="0" step="any" onChange={e => setQuantity(e.target.value)} />
        <input placeholder="Bucket" value={bucket} list="bucket-list" onChange={e => setBucket(e.target.value)} />
        <button type="submit">Add</button>
      </form>

      {tickerEntries.length > 0 && (
        <section className="prices-section">
          <div className="dashboard-heading">
            <h1>Prices</h1>
            <span className="dashboard-rule" aria-hidden="true" />
          </div>
          <table className="positions-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th className="col-number">Price (ARS)</th>
                <th className="col-number">Mult.</th>
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {tickerEntries.map(([name, t]) => {
                if (editingPrice?.ticker === name) {
                  return (
                    <tr key={name} className="position-row editing">
                      <td className="col-ticker">
                        {name}
                        <input
                          className="edit-input description-input"
                          placeholder="Description (optional)"
                          value={editingPrice.description}
                          onChange={e => setEditingPrice(prev => prev && { ...prev, description: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Escape') cancelPriceEdit() }}
                        />
                      </td>
                      <td>
                        <input className="edit-input edit-number" type="number" value={editingPrice.price} min="0" step="any"
                          onChange={e => setEditingPrice(prev => prev && { ...prev, price: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') savePriceEdit(); if (e.key === 'Escape') cancelPriceEdit() }}
                          autoFocus />
                      </td>
                      <td>
                        <input className="edit-input edit-number" type="number" value={editingPrice.multiplier} min="0" step="any"
                          onChange={e => setEditingPrice(prev => prev && { ...prev, multiplier: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') savePriceEdit(); if (e.key === 'Escape') cancelPriceEdit() }} />
                      </td>
                      <td className="col-actions">
                        <button className="action save" onClick={savePriceEdit} aria-label="Save">✓</button>
                        <button className="action cancel" onClick={cancelPriceEdit} aria-label="Cancel">×</button>
                      </td>
                    </tr>
                  )
                }
                return (
                  <tr key={name} className="position-row">
                    <td className="col-ticker">
                      {name}
                      {t.description && <span className="ticker-description">{t.description}</span>}
                    </td>
                    <td className="col-number">{fmt(t.price)}</td>
                    <td className="col-number">{t.multiplier}</td>
                    <td className="col-actions">
                      <button className="action edit" onClick={() => startPriceEdit(name)} aria-label="Edit">✎</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      {Object.keys(buckets).length === 0 ? (
        <p className="empty">No positions yet. Add your first holding above.</p>
      ) : (
        <>
          <div className="dashboard-heading" style={{ marginTop: '2rem' }}>
            <h1>Holdings</h1>
            <span className="dashboard-rule" aria-hidden="true" />
          </div>
          {Object.entries(buckets).map(([bucketName, items]) => {
            const bucketTotal = items.reduce((sum, p) => sum + positionValue(p, tickers), 0)
            return (
              <section key={bucketName} className="bucket-section">
                <div className="bucket-header">
                  <h2>{bucketName}</h2>
                  <span className="bucket-total">{fmt(Math.round(convert(bucketTotal)))} {currency}</span>
                </div>
                <table className="positions-table">
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th className="col-number">Qty</th>
                      <th className="col-bucket">Bucket</th>
                      <th className="col-value">Value</th>
                      <th className="col-actions" />
                    </tr>
                  </thead>
                  <tbody>{items.map(renderPositionRow)}</tbody>
                </table>
              </section>
            )
          })}
        </>
      )}

      <div className="dashboard-heading" style={{ marginTop: '2.5rem' }}>
        <h1>Historical Data</h1>
        <span className="dashboard-rule" aria-hidden="true" />
      </div>

      <div className="history-editor">
        <p className="history-description">
          Paste one snapshot per line in <code>YYYY-MM-DD,amount</code> format (amount in USD).
          The current portfolio value is always appended automatically.
        </p>
        <textarea
          className="history-textarea"
          value={historyText}
          onChange={e => { setHistoryText(e.target.value); setHistorySaved(false); setHistoryError('') }}
          placeholder={'2026-01-01,15000\n2026-02-01,16500\n2026-03-01,17200'}
          spellCheck={false}
        />
        {historyError && <p className="history-error">{historyError}</p>}
        <button className="history-save-btn" onClick={saveHistory}>
          {historySaved ? 'Saved!' : 'Save'}
        </button>
      </div>

      <div className="dashboard-heading" style={{ marginTop: '2.5rem' }}>
        <h1>Advanced</h1>
        <span className="dashboard-rule" aria-hidden="true" />
      </div>

      <div className="history-editor">
        <p className="history-description">
          <strong>Prices</strong> — one per line as <code>TICKER,price,multiplier,description</code>.
          Saving replaces all tickers. Description is optional.
        </p>
        <textarea
          className="history-textarea"
          value={bulkPricesText}
          onChange={e => { setBulkPricesText(e.target.value); setBulkPricesSaved(false); setBulkPricesError('') }}
          placeholder={'BRKB,50000,1,Berkshire Hathaway\nT30J6,1000,0.01,'}
          spellCheck={false}
        />
        {bulkPricesError && <p className="history-error">{bulkPricesError}</p>}
        <button className="history-save-btn" onClick={saveBulkPrices}>
          {bulkPricesSaved ? 'Saved!' : 'Save prices'}
        </button>
      </div>

      <div className="history-editor">
        <p className="history-description">
          <strong>Holdings</strong> — one per line as <code>TICKER,quantity,bucket</code>.
          Saving replaces all current holdings.
        </p>
        <textarea
          className="history-textarea"
          value={bulkHoldingsText}
          onChange={e => { setBulkHoldingsText(e.target.value); setBulkHoldingsSaved(false); setBulkHoldingsError('') }}
          placeholder={'BRKB,10,Long Term\nT30J6,500,Emergency Fund'}
          spellCheck={false}
        />
        {bulkHoldingsError && <p className="history-error">{bulkHoldingsError}</p>}
        <button className="history-save-btn" onClick={saveBulkHoldings}>
          {bulkHoldingsSaved ? 'Saved!' : 'Save holdings'}
        </button>
      </div>
    </>
  )
}

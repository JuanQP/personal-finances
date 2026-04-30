import { useState, useEffect } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useCurrency } from '../context/CurrencyContext'
import { fmt, uuid } from '../utils'
import type { Entry, EntryType } from '../types'

interface EditState {
  id: string
  label: string
  amount: string
}

export default function Entries() {
  const [entries, setEntries] = useLocalStorage<Entry[]>('pf-entries', [])
  const { currency, convert } = useCurrency()
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<EntryType>('expense')
  const [editing, setEditing] = useState<EditState | null>(null)

  function addEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!label.trim() || isNaN(parsed) || parsed <= 0) return
    setEntries(prev => [
      ...prev,
      { id: uuid(), label: label.trim(), amount: parsed, type },
    ])
    setLabel('')
    setAmount('')
  }

  function removeEntry(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  function startEdit(entry: Entry) {
    setEditing({ id: entry.id, label: entry.label, amount: String(entry.amount) })
  }

  function saveEdit() {
    if (!editing) return
    const parsed = parseFloat(editing.amount)
    if (!editing.label.trim() || isNaN(parsed) || parsed <= 0) return
    setEntries(prev =>
      prev.map(e =>
        e.id === editing.id ? { ...e, label: editing.label.trim(), amount: parsed } : e
      )
    )
    setEditing(null)
  }

  function cancelEdit() {
    setEditing(null)
  }

  const [bulkText, setBulkText] = useState('')
  const [bulkSaved, setBulkSaved] = useState(false)
  const [bulkError, setBulkError] = useState('')

  useEffect(() => {
    setBulkText(entries.map(e => `${e.label},${e.type},${e.amount}`).join('\n'))
  }, [entries])

  function saveBulk() {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
    const parsed: Entry[] = []
    const bad: string[] = []

    for (const line of lines) {
      const [label, type, rawAmount] = line.split(',').map(s => s.trim())
      const amount = parseFloat(rawAmount)
      if (!label || !['income', 'expense'].includes(type) || isNaN(amount) || amount <= 0) {
        bad.push(line)
        continue
      }
      parsed.push({ id: uuid(), label, amount, type: type as EntryType })
    }

    if (bad.length > 0) { setBulkError(`Could not parse: ${bad.join(' · ')}`); return }
    setBulkError('')
    setEntries(parsed)
    setBulkSaved(true)
    setTimeout(() => setBulkSaved(false), 2000)
  }

  const incomeEntries = entries.filter(e => e.type === 'income')
  const expenseEntries = entries.filter(e => e.type === 'expense')

  function renderEntry(entry: Entry) {
    if (editing?.id === entry.id) {
      return (
        <div key={entry.id} className={`entry ${entry.type} editing`}>
          <input
            className="edit-label"
            type="text"
            value={editing.label}
            onChange={e => setEditing(prev => prev && { ...prev, label: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
            autoFocus
          />
          <input
            className="edit-amount"
            type="number"
            value={editing.amount}
            min="0"
            step="any"
            onChange={e => setEditing(prev => prev && { ...prev, amount: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
          />
          <button className="action save" onClick={saveEdit} aria-label="Save">✓</button>
          <button className="action cancel" onClick={cancelEdit} aria-label="Cancel">×</button>
        </div>
      )
    }

    return (
      <div key={entry.id} className={`entry ${entry.type}`}>
        <span className="entry-label">{entry.label}</span>
        <span className="entry-amount">{fmt(convert(entry.amount))} {currency}</span>
        <button className="action edit" onClick={() => startEdit(entry)} aria-label="Edit">✎</button>
        <button className="action remove" onClick={() => removeEntry(entry.id)} aria-label="Remove">×</button>
      </div>
    )
  }

  return (
    <>
      <form className="entry-form" onSubmit={addEntry}>
        <input
          type="text"
          placeholder="Label (e.g. Pets)"
          value={label}
          onChange={e => setLabel(e.target.value)}
        />
        <input
          type="number"
          placeholder="Amount (ARS)"
          value={amount}
          min="0"
          step="any"
          onChange={e => setAmount(e.target.value)}
        />
        <select value={type} onChange={e => setType(e.target.value as EntryType)}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <button type="submit">Add</button>
      </form>

      <div className="entries-grid">
        <section className="entries-column">
          <h2>Income</h2>
          {incomeEntries.length === 0 ? (
            <p className="empty">No income entries yet.</p>
          ) : (
            incomeEntries.map(renderEntry)
          )}
        </section>

        <section className="entries-column">
          <h2>Expenses</h2>
          {expenseEntries.length === 0 ? (
            <p className="empty">No expense entries yet.</p>
          ) : (
            expenseEntries.map(renderEntry)
          )}
        </section>
      </div>
      <div className="dashboard-heading" style={{ marginTop: '2.5rem' }}>
        <h1>Advanced</h1>
        <span className="dashboard-rule" aria-hidden="true" />
      </div>

      <div className="history-editor">
        <p className="history-description">
          Paste one entry per line as <code>name,income|expense,amount</code>. Saving replaces all current entries.
        </p>
        <textarea
          className="history-textarea"
          value={bulkText}
          onChange={e => { setBulkText(e.target.value); setBulkSaved(false); setBulkError('') }}
          placeholder={'Salary,income,150000\nRent,expense,50000\nPets,expense,10000'}
          spellCheck={false}
        />
        {bulkError && <p className="history-error">{bulkError}</p>}
        <button className="history-save-btn" onClick={saveBulk}>
          {bulkSaved ? 'Saved!' : 'Save'}
        </button>
      </div>
    </>
  )
}

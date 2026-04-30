export type EntryType = 'income' | 'expense'

export interface Entry {
  id: string
  label: string
  amount: number
  type: EntryType
}

export interface Ticker {
  price: number
  multiplier: number
  description?: string
}

export interface Position {
  id: string
  ticker: string
  quantity: number
  bucket: string
}

export interface HistoricalEntry {
  date: string   // ISO "YYYY-MM-DD"
  amount: number // USD
}

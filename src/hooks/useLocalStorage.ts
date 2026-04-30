import { useState } from 'react'

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? (JSON.parse(stored) as T) : initial
    } catch {
      return initial
    }
  })

  const set = (next: T | ((prev: T) => T)) => {
    setValue(prev => {
      const updated = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      localStorage.setItem(key, JSON.stringify(updated))
      return updated
    })
  }

  return [value, set] as const
}

import { Link } from 'react-router-dom'
import { useRef } from 'react'
import { useCountUp } from 'react-countup'
import { Treemap, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot } from 'recharts'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useCurrency } from '../context/CurrencyContext'
import { fmt } from '../utils'
import type { Entry, Position, HistoricalEntry, Ticker } from '../types'

function AnimatedNumber({ end }: { end: number }) {
  const ref = useRef<HTMLElement>(null)
  useCountUp({ ref, end, formattingFn: fmt, duration: 1.5 })
  return <span ref={ref as React.RefObject<HTMLSpanElement>} />
}

// Warm, muted palette that fits the parchment aesthetic
const PALETTE = [
  '#1a4228', '#7a6000', '#7a2438', '#2c5282', '#744210',
  '#276749', '#9b6b00', '#6b3a2a', '#2d5986', '#4a5568',
]

interface TreemapContentProps {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  pct?: number
}

function TreemapCell({ x = 0, y = 0, width = 0, height = 0, name = '', pct = 0, index = 0 }: TreemapContentProps & { index?: number }) {
  const color = PALETTE[index % PALETTE.length]
  const showLabel = width > 50 && height > 32
  const showPct = width > 70 && height > 52

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} rx={2} stroke="#f5efe0" strokeWidth={2} />
      {showLabel && (
        <>
          <text
            x={x + width / 2} y={y + height / 2 + (showPct ? -8 : 0)}
            textAnchor="middle" dominantBaseline="middle"
            fill="#e8dfc8" fontSize={13} fontFamily="'Playfair Display', Georgia, serif" fontWeight="500"
          >
            {name}
          </text>
          {showPct && (
            <text
              x={x + width / 2} y={y + height / 2 + 12}
              textAnchor="middle" dominantBaseline="middle"
              fill="rgba(232,223,200,0.7)" fontSize={11} fontFamily="'EB Garamond', Georgia, serif"
            >
              {pct.toFixed(1)}%
            </text>
          )}
        </>
      )}
    </g>
  )
}

export default function Dashboard() {

  const [entries] = useLocalStorage<Entry[]>('pf-entries', [])
  const [positions] = useLocalStorage<Position[]>('pf-positions', [])
  const [tickers] = useLocalStorage<Record<string, Ticker>>('pf-tickers', {})
  const [history] = useLocalStorage<HistoricalEntry[]>('pf-portfolio-history', [])
  const { currency, convert, usdRate } = useCurrency()

  const totalIncome = entries
    .filter(e => e.type === 'income')
    .reduce((sum, e) => sum + e.amount, 0)

  const totalExpenses = entries
    .filter(e => e.type === 'expense')
    .reduce((sum, e) => sum + e.amount, 0)

  const savings = totalIncome - totalExpenses
  const portfolioTotal = positions.reduce((sum, p) => {
    const t = tickers[p.ticker]
    return sum + (t ? t.price * t.multiplier * p.quantity : 0)
  }, 0)

  const savingsPct = totalIncome > 0
    ? ((savings / totalIncome) * 100).toFixed(2)
    : null

  // Line chart: historical snapshots + today's current value in USD
  const today = new Date().toISOString().split('T')[0]
  const currentUSD = usdRate > 0 ? portfolioTotal / usdRate : 0
  const lineData = [
    ...history.map(e => ({ date: e.date, ts: new Date(e.date).getTime(), amount: e.amount, current: false })),
    { date: today, ts: new Date(today).getTime(), amount: Math.round(currentUSD), current: true },
  ]
    .sort((a, b) => a.ts - b.ts)
    // if today already exists in history, the current point wins
    .reduce<{ date: string; ts: number; amount: number; current: boolean }[]>((acc, e) => {
      const idx = acc.findIndex(x => x.date === e.date)
      if (idx >= 0) acc[idx] = e
      else acc.push(e)
      return acc
    }, [])

  const fmtTs = (ts: number) =>
    new Date(ts).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })

  // Aggregate positions by ticker
  const byTicker = Object.values(
    positions.reduce<Record<string, { name: string; value: number }>>((acc, p) => {
      const t = tickers[p.ticker]
      const val = t ? t.price * t.multiplier * p.quantity : 0
      if (!acc[p.ticker]) acc[p.ticker] = { name: p.ticker, value: 0 }
      acc[p.ticker].value += val
      return acc
    }, {})
  ).map(item => ({
    ...item,
    pct: portfolioTotal > 0 ? (item.value / portfolioTotal) * 100 : 0,
  }))

  return (
    <>
      <div className="dashboard-heading">
        <h1>Monthly Overview</h1>
        <span className="dashboard-rule" aria-hidden="true" />
      </div>

      <div className="summary">
        <div className="summary-card income">
          <span className="summary-label">Income</span>
          <strong className="summary-amount">
            <CountUp end={convert(totalIncome)} formattingFn={fmt} duration={1.5} /> {currency}
          </strong>
        </div>
        <div className="summary-card expense">
          <span className="summary-label">Expenses</span>
          <strong className="summary-amount">
            <CountUp end={convert(totalExpenses)} formattingFn={fmt} duration={1.5} /> {currency}
          </strong>
        </div>
        <div className={`summary-card savings ${savings >= 0 ? 'positive' : 'negative'}`}>
          <span className="summary-label">Savings</span>
          <strong className="summary-amount">
            <CountUp end={convert(savings)} formattingFn={fmt} duration={1.5} /> {currency}
          </strong>
        </div>
      </div>

      {savingsPct !== null && (
        <p className={`savings-note ${savings >= 0 ? 'positive' : 'negative'}`}>
          {savings >= 0
            ? <>You are saving <strong>{savingsPct}%</strong> of your income.</>
            : <>You are spending <strong>{Math.abs(Number(savingsPct))}%</strong> over your income.</>
          }
        </p>
      )}

      <div className="dashboard-heading">
        <h1>Portfolio</h1>
        <span className="dashboard-rule" aria-hidden="true" />
      </div>

      <div className="portfolio-summary">
        <span className="portfolio-total-label">Total value</span>
        <strong className="portfolio-total-amount">
          <CountUp end={Math.round(convert(portfolioTotal))} formattingFn={fmt} duration={1.5} /> {currency}
        </strong>
      </div>

      {byTicker.length > 0 && (
        <div className="portfolio-chart">
          <ResponsiveContainer width="100%" height={320}>
            <Treemap
              data={byTicker}
              dataKey="value"
              content={({ x, y, width, height, name, pct, index }: any) => (
                <TreemapCell x={x} y={y} width={width} height={height} name={name} pct={pct} index={index} />
              )}
            >
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="chart-tooltip">
                      <strong>{d.name}</strong>
                      <span>{fmt(convert(d.value))} {currency}</span>
                      <span>{d.pct.toFixed(2)}%</span>
                    </div>
                  )
                }}
              />
            </Treemap>
          </ResponsiveContainer>
        </div>
      )}

      {lineData.length > 1 && (
        <div className="portfolio-chart" style={{ marginTop: '1.5rem' }}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={lineData} margin={{ top: 16, right: 24, left: 8, bottom: 4 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={fmtTs}
                tick={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 12, fill: 'var(--text)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={v => `$${fmt(v)}`}
                tick={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 12, fill: 'var(--text)' }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="chart-tooltip">
                      <strong>{fmtTs(d.ts)}{d.current ? ' · now' : ''}</strong>
                      <span>${fmt(d.amount)} USD</span>
                    </div>
                  )
                }}
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={(props: any) => {
                  const { cx, cy, payload } = props
                  return payload.current
                    ? <Dot key={`dot-${payload.date}`} cx={cx} cy={cy} r={6} fill="#c8a84b" stroke="var(--bg)" strokeWidth={2} />
                    : <Dot key={`dot-${payload.date}`} cx={cx} cy={cy} r={3.5} fill="var(--accent)" stroke="var(--bg)" strokeWidth={1.5} />
                }}
                activeDot={{ r: 6, fill: 'var(--accent)', stroke: 'var(--bg)', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {entries.length === 0 && positions.length === 0 && (
        <p className="empty" style={{ marginTop: '1.5rem' }}>
          No data yet. <Link to="/entries">Add income &amp; expenses</Link> or <Link to="/portfolio">add portfolio positions</Link> to get started.
        </p>
      )}
    </>
  )
}

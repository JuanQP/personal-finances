# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (requires nvm use 24 first in a fresh shell)
npm run build     # tsc type-check + vite production build
npm run lint      # eslint
npm run preview   # serve the production build locally
```

Node version is pinned to 24 via `.nvmrc`. The system npm was broken at setup time; always use the nvm-managed Node 24.

`react-is` is a required peer dependency of Recharts that is not auto-installed — it must be present for `npm run build` to succeed. If it goes missing, reinstall it with `npm install react-is --legacy-peer-deps`.

When adding new packages, use `--legacy-peer-deps` because `vite-plugin-pwa` was installed with that flag.

There are no tests.

## Architecture

Single-page React 19 app. No backend — all state lives in `localStorage`. React Router v7 handles navigation. Recharts renders the two dashboard charts.

### Data model (`src/types.ts`)

Five types, all persisted independently in localStorage:

| Type | Key | Description |
|---|---|---|
| `Entry` | `pf-entries` | Monthly income/expense line items |
| `Position` | `pf-positions` | Portfolio holdings (ticker, qty, bucket) |
| `Ticker` | `pf-tickers` | Ticker metadata: price, multiplier, optional description |
| `HistoricalEntry` | `pf-portfolio-history` | Manual USD snapshots for the evolution chart |
| `Currency` | `pf-currency` | Selected display currency (`'ARS'` \| `'USD'`) |
| `number` | `pf-usd-rate` | Exchange rate: how many ARS = 1 USD |

### State persistence (`src/hooks/useLocalStorage.ts`)

`useLocalStorage<T>(key, initial)` — drop-in replacement for `useState` that reads/writes localStorage on every state change. Used directly in page components; there is no global store.

### Currency system (`src/context/CurrencyContext.tsx`)

`CurrencyProvider` wraps the entire app. Exposes `currency`, `usdRate`, `setCurrency`, `setUsdRate`, and `convert(amount)`.

- All monetary values are **stored in ARS**.
- `convert(amount)` returns `amount` when currency is `'ARS'`, or `amount / usdRate` when `'USD'`.
- The portfolio evolution line chart is **always in USD** and bypasses `convert()`, using `portfolioTotal / usdRate` directly.

### Routing (`src/App.tsx`)

Four routes: `/` (Dashboard), `/entries` (Entries), `/portfolio` (Portfolio), `/settings` (Settings). `CurrencyProvider` wraps all routes.

### Animated numbers (`react-countup`)

Dashboard numbers (Income, Expenses, Savings, Portfolio total) animate from 0 on page load using `react-countup`. The package ships CJS with `__esModule: true`, which breaks under Vite 8 / Rolldown's new interop behavior. `vite.config.ts` includes `legacy: { inconsistentCjsInterop: true }` to restore the old behavior until `react-countup` ships an ESM build.

### Key design decisions

**Tickers vs. positions**: `pf-tickers` is an independent store (`Record<string, Ticker>`) that owns `price`, `multiplier`, and `description` for each ticker symbol. `pf-positions` only stores `ticker`, `quantity`, and `bucket`. This separation means the Prices panel works even when there are no holdings. When adding a position for an existing ticker the form locks price/multiplier and reads them from `pf-tickers`. One-time migration code in `Portfolio.tsx` detects old `Position` rows that still carry `price`/`multiplier` and extracts them into `pf-tickers` on first load.

**Portfolio chart data**: the line chart merges `pf-portfolio-history` (manual USD snapshots) with the live current value computed from positions. The X axis uses millisecond timestamps (`scale="time"`) so gaps between irregular snapshots render proportionally.

### Styling

All styles in `src/index.css` (global tokens + reset) and `src/App.css` (component styles). No CSS modules or Tailwind. Dark mode is intentionally disabled (`color-scheme: light`). The design uses two Google Fonts loaded in `index.html`: **Playfair Display** (headings, amounts) and **EB Garamond** (body, labels, nav).

CSS custom properties defined in `:root` cover the full colour palette — semantic tokens like `--income-color`, `--expense-color`, `--savings-pos-color`, etc. — so colour changes are centralised.

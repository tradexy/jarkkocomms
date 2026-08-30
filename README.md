# JarkkoComms

Finland-based oil-and-commodities desk with an international book: live WTI/Brent, the energy complex, metals, and agriculture. EUR is the default display currency; one click switches to USD. Charts never go blank.

## Local

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5176](http://127.0.0.1:5176).

## What it does

- Last prints from the TradingView futures scan (server-side, no browser CORS)
- History via one cached Yahoo request; if that fails, a session sketch from the last quote so the panel is never empty
- Session and 52-week range rails on every contract
- Desk currency: EUR default (Finland), one-click USD, plus GBP/JPY/CHF — ECB rates via Frankfurter
- Helsinki and New York clocks on the masthead
- Watchlist and price alerts in the browser
- FI / EN language toggle (defaults to Finnish when the browser language is `fi*`)
- Installable PWA; voice read-out via the browser Web Speech API (no key)
- Optional DeepSeek briefs if you paste your own key in Settings (`deepseek-v4-flash` or `deepseek-v4-pro`). DeepSeek bills your account.

Quotes are delayed exchange prints — not a trading feed. The core desk is free: no JarkkoComms API keys.

## Deploy

```bash
npm run deploy
```

Cloudflare Pages + Functions serve `/api/quotes`, `/api/chart`, and `/api/fx`.

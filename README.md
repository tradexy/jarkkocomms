# JarkkoComms

Cinematic oil-and-commodities desk: live WTI/Brent, the energy complex, metals, and agriculture — with USD/EUR display and first-party charts that never go blank.

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
- Desk currency: USD / EUR (plus GBP, JPY, CHF) using ECB rates from Frankfurter
- Watchlist and price alerts in the browser

Quotes are delayed exchange prints — not a trading feed.

## Deploy

```bash
npm run deploy
```

Cloudflare Pages + Functions serve `/api/quotes`, `/api/chart`, and `/api/fx`.

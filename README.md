# Assets Rotation — Netlify Edition

Assets Rotation is an interactive Relative Rotation Graph dashboard rebuilt as a browser-first React application. It runs on GitHub and Netlify without a Python server: React renders the interface and Plotly charts in the browser, while a Netlify Function proxies chart data from Yahoo Finance.

## Features

- Sector, industry, and sector-holding universes.
- Seven timeframe choices: 1 minute, 5 minutes, 15 minutes, 30 minutes, 1 hour, daily, and weekly.
- RRG calculation in JavaScript with five-point tails, symmetric quadrant axes, quadrant fills, and clickable ticker markers.
- Eastern Time slider labels and synchronized benchmark/selected-ticker candlestick detail.
- Netlify Function data proxy at `/.netlify/functions/market-data`.
- No API key is required for the current Yahoo Finance chart endpoint. Yahoo Finance is an unofficial source and may rate-limit or change access without notice.

## Deploy directly with GitHub and Netlify

1. Push the contents of this repository to GitHub. `netlify.toml` must be at the repository root.
2. In Netlify, choose **Add new site → Import an existing project**, select the GitHub repository, and leave the base directory blank.
3. Netlify will read `netlify.toml`, which sets the build command to `npm run build`, the publish directory to `dist/public`, and the function directory to `netlify/functions`.
4. Deploy. Every push to the connected GitHub branch will trigger a new Netlify build.

No Python service, Render account, backend host, or Netlify environment variable is required.

## Run locally

```bash
npm install
npm run dev
```

The Vite preview renders the frontend. To exercise the live market-data function locally, use the Netlify CLI so `/.netlify/functions/market-data` is available:

```bash
npx netlify dev
```

The production function accepts:

```text
/.netlify/functions/market-data?tickers=SPY,XLK&range=1y&interval=1d
```

## Build checks

```bash
npm run check
npm run build
```

## Data caveat

The function uses Yahoo Finance's public chart endpoint, which is convenient for a free prototype but is not an official commercial data API. Requests can be rate-limited, delayed, or temporarily unavailable. For a production-grade product, replace `netlify/functions/market-data.mjs` with a licensed market-data provider and keep its API key in Netlify environment variables.

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

function cleanSeries(result) {
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const rows = timestamps.map((timestamp, index) => ({
    timestamp,
    open: Number(quote.open?.[index]),
    high: Number(quote.high?.[index]),
    low: Number(quote.low?.[index]),
    close: Number(quote.close?.[index]),
  })).filter((row) => [row.timestamp, row.open, row.high, row.low, row.close].every(Number.isFinite));

  return {
    timestamps: rows.map((row) => row.timestamp),
    open: rows.map((row) => row.open),
    high: rows.map((row) => row.high),
    low: rows.map((row) => row.low),
    close: rows.map((row) => row.close),
  };
}

function cleanMetadata(result, ticker) {
  const meta = result?.meta || {};
  return {
    name: meta.longName || meta.shortName || ticker,
    exchange: meta.fullExchangeName || meta.exchangeName || "",
    currency: meta.currency || "USD",
    price: Number.isFinite(meta.regularMarketPrice) ? meta.regularMarketPrice : null,
    previousClose: Number.isFinite(meta.previousClose) ? meta.previousClose : null,
  };
}

async function fetchTicker(ticker, range, interval) {
  const url = new URL(`${YAHOO_CHART_URL}/${encodeURIComponent(ticker)}`);
  url.searchParams.set("range", range);
  url.searchParams.set("interval", interval);
  url.searchParams.set("includePrePost", "false");
  url.searchParams.set("events", "div,splits");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 AssetsRotation/1.0",
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`${ticker}: Yahoo Finance returned ${response.status}`);
  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  if (!result) throw new Error(`${ticker}: no chart data returned`);
  return { series: cleanSeries(result), metadata: cleanMetadata(result, ticker) };
}

export default async function handler(request) {
  const url = new URL(request.url);
  const tickers = [...new Set((url.searchParams.get("tickers") || "SPY").split(",").map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))].slice(0, 40);
  const range = url.searchParams.get("range") || "1y";
  const interval = url.searchParams.get("interval") || "1d";

  if (!tickers.length) return Response.json({ error: "At least one ticker is required" }, { status: 400 });

  const entries = await Promise.allSettled(tickers.map((ticker) => fetchTicker(ticker, range, interval)));
  const data = {};
  const metadata = {};
  const failures = [];
  entries.forEach((entry, index) => {
    if (entry.status === "fulfilled" && entry.value.series.timestamps.length) {
      data[tickers[index]] = entry.value.series;
      metadata[tickers[index]] = entry.value.metadata;
    } else failures.push(tickers[index]);
  });

  if (!Object.keys(data).length) return Response.json({ error: "Yahoo Finance returned no usable market data", failures }, { status: 502 });

  return Response.json({ data, metadata, fetchedAt: new Date().toISOString(), failures }, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" },
  });
}

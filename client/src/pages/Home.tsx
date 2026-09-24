import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  Clock3,
  Database,
  Download,
  Gauge,
  Layers3,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wifi,
  X,
} from "lucide-react";

type TimeframeKey = "1m" | "5m" | "15m" | "30m" | "1h" | "1d" | "1wk";
type UniverseKey = "SECTORS" | "INDUSTRIES" | keyof typeof SECTOR_ETFS;

type MarketSeries = {
  timestamps: number[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
};

type InstrumentMetadata = { name: string; exchange?: string; currency?: string; price?: number | null; previousClose?: number | null };
type Dataset = Record<string, MarketSeries>;
type RrgPoint = { x: number; y: number; ts: number };
type RrgAsset = {
  ticker: string;
  label: string;
  points: RrgPoint[];
};
type Snapshot = { ts: number; assets: RrgAsset[] };

declare global {
  interface Window {
    Plotly?: any;
  }
}

const SECTOR_ETFS: Record<string, string> = {
  XLE: "Energy",
  XLF: "Financials",
  XLK: "Technology",
  XLV: "Health Care",
  XLI: "Industrials",
  XLY: "Consumer Discretionary",
  XLP: "Consumer Staples",
  XLU: "Utilities",
  XLRE: "Real Estate",
  XLB: "Materials",
  XLC: "Communication Services",
};

const INDUSTRY_ETFS: Record<string, string> = {
  FDN: "Internet",
  IBB: "Biotechnology",
  JETS: "Airlines",
  SMH: "Semiconductors",
  PBW: "Clean Energy",
  TAN: "Solar",
  OIH: "Oil Services",
  XOP: "Oil & Gas E&P",
  XME: "Metals & Mining",
  VNQ: "Real Estate",
  ITA: "Aerospace & Defense",
  IGV: "Software",
  KIE: "Insurance",
  KRE: "Regional Banks",
  XRT: "Retail",
};

const FALLBACK_HOLDINGS: Record<string, string[]> = {
  XLE: ["XOM", "CVX", "COP", "WMB", "EOG", "KMI", "MPC", "SLB", "PSX", "OKE"],
  XLF: ["BRK-B", "JPM", "V", "MA", "BAC", "WFC", "GS", "SPGI", "MS", "C"],
  XLK: ["NVDA", "MSFT", "AAPL", "AVGO", "ORCL", "PLTR", "AMD", "CSCO", "CRM", "IBM"],
  XLV: ["LLY", "JNJ", "ABBV", "ABT", "UNH", "MRK", "TMO", "ISRG", "AMGN", "BSX"],
  XLI: ["GE", "RTX", "CAT", "UBER", "BA", "ETN", "HON", "UNP", "DE", "ADP"],
  XLY: ["AMZN", "TSLA", "HD", "MCD", "BKNG", "TJX", "LOW", "SBUX", "DASH", "ORLY"],
  XLP: ["WMT", "COST", "PG", "KO", "PM", "PEP", "MO", "MDLZ", "CL", "TGT"],
  XLU: ["NEE", "CEG", "SO", "DUK", "VST", "AEP", "SRE", "D", "EXC", "PEG"],
  XLRE: ["WELL", "PLD", "AMT", "EQIX", "DLR", "O", "SPG", "CCI", "CBRE", "PSA"],
  XLB: ["LIN", "SHW", "NEM", "ECL", "MLM", "VMC", "APD", "NUE", "FCX", "CTVA"],
  XLC: ["META", "GOOGL", "GOOG", "NFLX", "EA", "TMUS", "T", "VZ", "TTWO", "DIS"],
};

const TIMEFRAMES: Record<TimeframeKey, { label: string; range: string; interval: string; maxDays: number }> = {
  "1m": { label: "1 min", range: "2d", interval: "1m", maxDays: 2 },
  "5m": { label: "5 min", range: "5d", interval: "5m", maxDays: 5 },
  "15m": { label: "15 min", range: "15d", interval: "15m", maxDays: 15 },
  "30m": { label: "30 min", range: "30d", interval: "30m", maxDays: 30 },
  "1h": { label: "1 hour", range: "60d", interval: "1h", maxDays: 60 },
  "1d": { label: "Daily", range: "1y", interval: "1d", maxDays: 365 },
  "1wk": { label: "Weekly", range: "2y", interval: "1wk", maxDays: 730 },
};

const PALETTE = ["#35e08a", "#58a6ff", "#ffcf5c", "#ff6b7c", "#a98bff", "#4de1f0", "#ff9f5b", "#e78bdb", "#8bd3dd", "#c8e26a", "#d0a8ff"];
const SECTOR_COLORS: Record<string, string> = {
  XLK: "#35e08a",
  XLC: "#35e08a",
  XLY: "#35e08a",
  XLU: "#ff6b7c",
  XLRE: "#ff6b7c",
  XLP: "#ff6b7c",
  XLI: "#ffcf5c",
  XLB: "#ffcf5c",
  XLF: "#ffcf5c",
  XLV: "#58a6ff",
  XLE: "#58a6ff",
};

const colors = {
  ink: "#edf5ff",
  muted: "#7f9bb8",
  grid: "rgba(124, 163, 200, 0.16)",
  panel: "#0c1b2d",
  bg: "#07111f",
};

function hashColor(ticker: string, universe: UniverseKey) {
  if (universe === "SECTORS" && SECTOR_COLORS[ticker]) return SECTOR_COLORS[ticker];
  let sum = 0;
  for (const char of ticker) sum = (sum * 31 + char.charCodeAt(0)) % PALETTE.length;
  return PALETTE[sum];
}

function universeMap(universe: UniverseKey): Record<string, string> {
  if (universe === "SECTORS") return SECTOR_ETFS;
  if (universe === "INDUSTRIES") return INDUSTRY_ETFS;
  return Object.fromEntries((FALLBACK_HOLDINGS[universe] || []).map((ticker) => [ticker, ticker]));
}

function benchmarkFor(universe: UniverseKey) {
  return universe === "SECTORS" || universe === "INDUSTRIES" ? "SPY" : universe;
}

function formatEastern(ts: number, withDate = true) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ts * 1000));
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return withDate ? `${get("month")} ${get("day")} · ${get("hour")}:${get("minute")} ET` : `${get("hour")}:${get("minute")}`;
}

function formatEasternLong(ts: number) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ts * 1000)) + " ET";
}

function formatCompact(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function rollingMean(values: number[], end: number, size: number) {
  if (end < size - 1) return null;
  let total = 0;
  for (let index = end - size + 1; index <= end; index += 1) total += values[index];
  return total / size;
}

function buildSnapshots(dataset: Dataset, universe: UniverseKey, metadata: Record<string, InstrumentMetadata>): Snapshot[] {
  const map = universeMap(universe);
  const benchmark = benchmarkFor(universe);
  const benchmarkSeries = dataset[benchmark];
  if (!benchmarkSeries?.timestamps?.length) return [];

  const benchmarkClose = new Map(benchmarkSeries.timestamps.map((ts, index) => [ts, benchmarkSeries.close[index]]));
  const snapshotMap = new Map<number, Map<string, RrgAsset>>();

  Object.entries(map).forEach(([ticker, label]) => {
    const series = dataset[ticker];
    if (!series?.timestamps?.length) return;
    const points = series.timestamps
      .map((ts, index) => ({ ts, asset: series.close[index], benchmark: benchmarkClose.get(ts) }))
      .filter((row): row is { ts: number; asset: number; benchmark: number } => Number.isFinite(row.asset) && Number.isFinite(row.benchmark) && row.benchmark !== 0);
    const ratios = points.map((row) => row.asset / row.benchmark);
    const rs: Array<number | null> = ratios.map((_, index) => {
      const fast = rollingMean(ratios, index, 10);
      const slow = rollingMean(ratios, index, 30);
      return fast === null || slow === null || slow === 0 ? null : 100 * (fast / slow);
    });
    const rm: Array<number | null> = rs.map((value, index) => {
      if (value === null) return null;
      const history = rs.slice(0, index + 1);
      const windowValues = history.slice(-9).filter((item): item is number => item !== null);
      const average = windowValues.length === 9
        ? windowValues.reduce((sum, item) => sum + item, 0) / 9
        : null;
      return average && average !== 0 ? 100 * (value / average) : null;
    });

    points.forEach((row, index) => {
      if (rs[index] === null || rm[index] === null) return;
      if (!snapshotMap.has(row.ts)) snapshotMap.set(row.ts, new Map());
      const snapshot = snapshotMap.get(row.ts)!;
      const tailIndexes: number[] = [];
      for (let tail = Math.max(0, index - 4); tail <= index; tail += 1) {
        if (rs[tail] !== null && rm[tail] !== null) tailIndexes.push(tail);
      }
      snapshot.set(ticker, {
        ticker,
        label: metadata[ticker]?.name || label,
        points: tailIndexes.map((tail) => ({ x: rs[tail] as number, y: rm[tail] as number, ts: points[tail].ts })),
      });
    });
  });

  return Array.from(snapshotMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, assetMap]) => ({ ts, assets: Array.from(assetMap.values()) }))
    .filter((snapshot) => snapshot.assets.length > 0)
    .slice(-90);
}

function metricAt(snapshot: Snapshot | undefined, ticker: string, axis: "x" | "y") {
  const asset = snapshot?.assets.find((item) => item.ticker === ticker);
  const value = asset?.points.at(-1)?.[axis];
  return typeof value === "number" ? value : undefined;
}

function usePlotly(ref: React.RefObject<HTMLDivElement | null>, traces: any[], layout: any, dependencies: unknown[]) {
  useEffect(() => {
    let cancelled = false;
    const render = () => {
      if (cancelled || !ref.current || !window.Plotly) return;
      window.Plotly.react(ref.current, traces, layout, {
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ["lasso2d", "select2d"],
      });
    };
    if (window.Plotly) render();
    else window.addEventListener("load", render, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", render);
      if (ref.current && window.Plotly) window.Plotly.purge(ref.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}

async function loadMarketData(universe: UniverseKey, timeframe: TimeframeKey, signal: AbortSignal) {
  const map = universeMap(universe);
  const tickers = Array.from(new Set([...Object.keys(map), benchmarkFor(universe)])).join(",");
  const spec = TIMEFRAMES[timeframe];
  const params = new URLSearchParams({ tickers, range: spec.range, interval: spec.interval });
  const response = await fetch(`/.netlify/functions/market-data?${params.toString()}`, { signal });
  if (!response.ok) throw new Error(`Market data request failed (${response.status})`);
  return (await response.json()) as { data: Dataset; metadata: Record<string, InstrumentMetadata>; fetchedAt: string };
}

function AppSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="control-field">
      <span>{label}</span>
      <span className="select-wrap">
        <select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
        <ChevronDown size={15} aria-hidden="true" />
      </span>
    </label>
  );
}

function Stat({ label, value, tone = "neutral", icon }: { label: string; value: string; tone?: "neutral" | "positive" | "warning"; icon: React.ReactNode }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div><span className="stat-label">{label}</span><strong>{value}</strong></div>
    </div>
  );
}

export default function Home() {
  const [universe, setUniverse] = useState<UniverseKey>("SECTORS");
  const [timeframe, setTimeframe] = useState<TimeframeKey>("1d");
  const [dataset, setDataset] = useState<Dataset>({});
  const [metadata, setMetadata] = useState<Record<string, InstrumentMetadata>>({});
  const [fetchedAt, setFetchedAt] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedTicker, setSelectedTicker] = useState("SPY");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const rrgRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  const snapshots = useMemo(() => buildSnapshots(dataset, universe, metadata), [dataset, universe, metadata]);
  const safeIndex = snapshots.length ? Math.min(Math.max(selectedIndex < 0 ? snapshots.length - 1 : selectedIndex, 0), snapshots.length - 1) : 0;
  const snapshot = snapshots[safeIndex];
  const benchmark = benchmarkFor(universe);
  const map = universeMap(universe);
  const availableTickers = [benchmark, ...Object.keys(map)].filter((ticker, index, all) => all.indexOf(ticker) === index);
  const detailTicker = availableTickers.includes(selectedTicker) ? selectedTicker : benchmark;
  const selectedSeries = dataset[detailTicker];
  const selectedCutoff = snapshot?.ts || selectedSeries?.timestamps.at(-1) || 0;

  const load = async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus("loading");
    setError("");
    try {
      const result = await loadMarketData(universe, timeframe, controller.signal);
      setDataset(result.data);
      setMetadata(result.metadata || {});
      setFetchedAt(result.fetchedAt);
      setSelectedIndex(-1);
      setSelectedTicker(benchmarkFor(universe));
      setStatus("ready");
    } catch (loadError) {
      if ((loadError as Error).name === "AbortError") return;
      setStatus("error");
      setError(loadError instanceof Error ? loadError.message : "Unable to load market data");
    }
  };

  useEffect(() => { void load(); return () => requestRef.current?.abort(); }, [universe, timeframe]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [universe, timeframe]);

  const rrgTraces = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.assets.map((asset) => {
      const color = hashColor(asset.ticker, universe);
      return {
        x: asset.points.map((point) => point.x),
        y: asset.points.map((point) => point.y),
        mode: "lines+markers+text",
        type: "scatter",
        name: asset.ticker,
        text: asset.points.map((_, index) => index === asset.points.length - 1 ? asset.ticker : ""),
        textposition: "top center",
        textfont: { color, size: 11, family: "IBM Plex Mono, monospace" },
        customdata: asset.points.map(() => [asset.ticker]),
        hovertemplate: `<b>${asset.ticker}</b><br>RS-Ratio %{x:.2f}<br>RS-Momentum %{y:.2f}<extra>${asset.label}</extra>`,
        line: { color, width: 1.6 },
        marker: { color, size: asset.points.map((_, index) => index === asset.points.length - 1 ? 8 : 4), line: { color: colors.bg, width: 1 } },
        opacity: 0.98,
      };
    });
  }, [snapshot, universe]);

  const rrgLayout = useMemo(() => {
    const allPoints = snapshot?.assets.flatMap((asset) => asset.points) || [];
    const maxDistance = Math.max(8, ...allPoints.map((point) => Math.max(Math.abs(point.x - 100), Math.abs(point.y - 100)) * 1.18));
    return {
      height: 540,
      margin: { l: 60, r: 25, t: 20, b: 55 },
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: { family: "IBM Plex Mono, monospace", color: colors.muted, size: 11 },
      hoverlabel: { bgcolor: "#10253b", bordercolor: "#31577b", font: { color: colors.ink } },
      showlegend: false,
      xaxis: { title: { text: "RS-Ratio", font: { size: 11 } }, range: [100 - maxDistance, 100 + maxDistance], zeroline: false, gridcolor: colors.grid, tickfont: { color: colors.muted }, fixedrange: false },
      yaxis: { title: { text: "RS-Momentum", font: { size: 11 } }, range: [100 - maxDistance, 100 + maxDistance], zeroline: false, gridcolor: colors.grid, tickfont: { color: colors.muted }, fixedrange: false },
      shapes: [
        { type: "rect", x0: 100, x1: 100 + maxDistance, y0: 100, y1: 100 + maxDistance, fillcolor: "rgba(53,224,138,0.055)", line: { width: 0 }, layer: "below" },
        { type: "rect", x0: 100 - maxDistance, x1: 100, y0: 100, y1: 100 + maxDistance, fillcolor: "rgba(88,166,255,0.055)", line: { width: 0 }, layer: "below" },
        { type: "rect", x0: 100 - maxDistance, x1: 100, y0: 100 - maxDistance, y1: 100, fillcolor: "rgba(255,107,124,0.045)", line: { width: 0 }, layer: "below" },
        { type: "rect", x0: 100, x1: 100 + maxDistance, y0: 100 - maxDistance, y1: 100, fillcolor: "rgba(255,207,92,0.045)", line: { width: 0 }, layer: "below" },
        { type: "line", x0: 100, x1: 100, y0: 100 - maxDistance, y1: 100 + maxDistance, line: { color: "rgba(157,190,220,0.38)", width: 1, dash: "dot" } },
        { type: "line", x0: 100 - maxDistance, x1: 100 + maxDistance, y0: 100, y1: 100, line: { color: "rgba(157,190,220,0.38)", width: 1, dash: "dot" } },
      ],
      annotations: [
        { x: 0.96, y: 0.96, xref: "paper", yref: "paper", text: "LEADING", showarrow: false, font: { color: "rgba(53,224,138,0.7)", size: 10 } },
        { x: 0.04, y: 0.96, xref: "paper", yref: "paper", text: "IMPROVING", showarrow: false, font: { color: "rgba(88,166,255,0.7)", size: 10 } },
        { x: 0.04, y: 0.04, xref: "paper", yref: "paper", text: "LAGGING", showarrow: false, font: { color: "rgba(255,107,124,0.7)", size: 10 } },
        { x: 0.96, y: 0.04, xref: "paper", yref: "paper", text: "WEAKENING", showarrow: false, font: { color: "rgba(255,207,92,0.7)", size: 10 } },
      ],
    };
  }, [snapshot]);

  usePlotly(rrgRef, rrgTraces, rrgLayout, [rrgTraces, rrgLayout]);

  useEffect(() => {
    const plot = rrgRef.current as (HTMLDivElement & { on?: Function; removeListener?: Function }) | null;
    if (!plot?.on) return;
    const handleClick = (event: any) => {
      const point = event?.points?.[0];
      const custom = Array.isArray(point?.customdata) ? point.customdata[0] : point?.customdata;
      if (typeof custom === "string") setSelectedTicker(custom);
    };
    plot.on("plotly_click", handleClick);
    return () => { plot.removeListener?.("plotly_click", handleClick); };
  }, [rrgTraces]);

  const detailRows = selectedSeries?.timestamps
    .map((ts, index) => ({ ts, open: selectedSeries.open[index], high: selectedSeries.high[index], low: selectedSeries.low[index], close: selectedSeries.close[index] }))
    .filter((row) => row.ts <= selectedCutoff)
    .slice(-180) || [];

  const detailTraces = useMemo(() => [{
    x: detailRows.map((row) => new Date(row.ts * 1000)),
    open: detailRows.map((row) => row.open),
    high: detailRows.map((row) => row.high),
    low: detailRows.map((row) => row.low),
    close: detailRows.map((row) => row.close),
    type: "candlestick",
    increasing: { line: { color: "#35e08a" } },
    decreasing: { line: { color: "#ff6b7c" } },
    whiskerwidth: 0.45,
    name: detailTicker,
  }], [detailRows, detailTicker]);

  const detailLayout = useMemo(() => ({
    height: 390,
    margin: { l: 55, r: 20, t: 18, b: 45 },
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    font: { family: "IBM Plex Mono, monospace", color: colors.muted, size: 10 },
    hoverlabel: { bgcolor: "#10253b", bordercolor: "#31577b", font: { color: colors.ink } },
    showlegend: false,
    xaxis: { rangeslider: { visible: false }, gridcolor: colors.grid, tickfont: { color: colors.muted }, rangebreaks: timeframe === "1d" || timeframe === "1wk" ? [{ bounds: ["sat", "mon"] }] : [{ bounds: ["sat", "mon"] }, { pattern: "hour", bounds: [16, 9.5] }] },
    yaxis: { gridcolor: colors.grid, tickfont: { color: colors.muted }, tickprefix: "$" },
  }), [timeframe]);

  usePlotly(detailRef, detailTraces, detailLayout, [detailTraces, detailLayout]);

  const currentX = metricAt(snapshot, detailTicker, "x");
  const currentY = metricAt(snapshot, detailTicker, "y");
  const isOpen = (() => { const now = new Date(); const eastern = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hour12: false, weekday: "short" }).formatToParts(now); const hour = Number(eastern.find((part) => part.type === "hour")?.value || 0); const minute = Number(eastern.find((part) => part.type === "minute")?.value || 0); const weekday = eastern.find((part) => part.type === "weekday")?.value || ""; return !["Sat", "Sun"].includes(weekday) && (hour > 9 || (hour === 9 && minute >= 30)) && hour < 16; })();

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Activity size={21} strokeWidth={2.5} /></div>
          <div><div className="eyebrow">MARKET INTELLIGENCE / 01</div><h1>Assets <span>Rotation</span></h1></div>
        </div>
        <div className="topbar-right">
          <div className="session-pill"><span className={`pulse-dot ${isOpen ? "live" : ""}`} />{isOpen ? "NY SESSION OPEN" : "NY SESSION CLOSED"}<small>{new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date())} ET</small></div>
          <button className="icon-button" title="Refresh data" onClick={() => void load()} disabled={status === "loading"}><RefreshCw size={17} className={status === "loading" ? "spin" : ""} /></button>
        </div>
      </header>

      <section className="hero-row">
        <div><div className="eyebrow accent">RELATIVE ROTATION GRAPH</div><h2>Read the market’s <em>next move.</em></h2><p className="lede">A live view of relative strength and momentum across the market. Every point is a signal; every tail is a story.</p></div>
        <div className="hero-stamp"><Sparkles size={15} /><span>DATA WINDOW</span><strong>{TIMEFRAMES[timeframe].label}</strong></div>
      </section>

      <section className="control-bar">
        <div className="control-group"><SlidersHorizontal size={16} /><span className="control-caption">VIEW</span><AppSelect label="Universe" value={universe} onChange={(value) => setUniverse(value as UniverseKey)}><option value="SECTORS">S&amp;P 500 sectors</option><option value="INDUSTRIES">Industry ETFs</option>{Object.entries(SECTOR_ETFS).map(([ticker, label]) => <option value={ticker} key={ticker}>{ticker} · {label} holdings</option>)}</AppSelect><AppSelect label="Timeframe" value={timeframe} onChange={(value) => setTimeframe(value as TimeframeKey)}>{Object.entries(TIMEFRAMES).map(([key, spec]) => <option value={key} key={key}>{spec.label}</option>)}</AppSelect></div>
        <div className="control-meta"><span className="data-state"><Database size={14} /> {status === "ready" ? "Provider data connected" : status === "loading" ? "Syncing provider data" : "Provider unavailable"}</span><button className="refresh-button" onClick={() => void load()} disabled={status === "loading"}><RefreshCw size={14} /> Refresh</button></div>
      </section>

      <section className="stats-row">
        <Stat label="BENCHMARK" value={`${benchmark} · ${metadata[benchmark]?.name || "S&P 500"}`} icon={<BarChart3 size={17} />} />
        <Stat label="VISIBLE ASSETS" value={`${snapshot?.assets.length || 0} / ${Object.keys(map).length}`} tone="positive" icon={<Layers3 size={17} />} />
        <Stat label="SELECTED CANDLE" value={snapshot ? formatEastern(snapshot.ts) : "Waiting for data"} icon={<Clock3 size={17} />} />
        <Stat label="FEED STATUS" value={status === "ready" ? "Live · cached 5m" : status === "loading" ? "Loading" : "Retry needed"} tone={status === "error" ? "warning" : "positive"} icon={<Wifi size={17} />} />
      </section>

      {status === "error" && <div className="error-banner"><X size={17} /><div><strong>Market data could not be loaded.</strong><span>{error}. The free Yahoo Finance endpoint can rate-limit requests; try Refresh in a moment.</span></div><button onClick={() => void load()}>Retry</button></div>}

      <section className="main-grid">
        <article className="chart-card rrg-card">
          <div className="card-heading"><div><div className="section-kicker"><span className="live-line" />RRG MAP / {universe === "SECTORS" ? "SECTOR LEADERSHIP" : universe === "INDUSTRIES" ? "INDUSTRY LEADERSHIP" : `${universe} HOLDINGS`}</div><h3>Momentum quadrant</h3><p>Click a ticker to inspect its price action below.</p></div><div className="chart-legend"><span><i className="legend-dot leading" />Leading</span><span><i className="legend-dot improving" />Improving</span><span><i className="legend-dot weakening" />Weakening</span><span><i className="legend-dot lagging" />Lagging</span></div></div>
          <div className="plot-wrap">{status === "loading" && <div className="chart-loading"><Loader2 className="spin" size={25} /><span>Fetching synchronized price history…</span></div>}{!snapshot && status !== "loading" && <div className="chart-loading"><Gauge size={24} /><span>No RRG window available for this selection.</span></div>}<div ref={rrgRef} className="plot" /></div>
          <div className="slider-row"><div className="slider-label"><span>HISTORICAL POSITION</span><strong>{snapshot ? formatEasternLong(snapshot.ts) : "—"}</strong></div><input type="range" min="0" max={Math.max(snapshots.length - 1, 0)} value={safeIndex} onChange={(event) => setSelectedIndex(Number(event.target.value))} disabled={!snapshots.length} /><div className="slider-endpoints"><span>{snapshots[0] ? formatEastern(snapshots[0].ts) : "—"}</span><span>{snapshots.at(-1) ? formatEastern(snapshots.at(-1)!.ts) : "—"}</span></div></div>
        </article>

        <aside className="side-column">
          <div className="insight-card"><div className="section-kicker"><Gauge size={14} /> SELECTED SIGNAL</div><div className="signal-ticker"><span className="signal-color" style={{ background: hashColor(detailTicker, universe) }} />{detailTicker}<span className="signal-name">{metadata[detailTicker]?.name || (detailTicker === benchmark ? "Benchmark" : map[detailTicker] || "Market asset")}</span></div><div className="signal-metrics"><div><span>RS-RATIO</span><strong>{formatCompact(currentX)}</strong></div><div><span>RS-MOMENTUM</span><strong>{formatCompact(currentY)}</strong></div></div><div className="signal-foot"><span className={currentX && currentX >= 100 ? "up" : "down"}>{currentX && currentX >= 100 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{currentX && currentX >= 100 ? "Relative strength" : "Relative weakness"}</span><button className="tiny-link" onClick={() => setSelectedTicker(benchmark)}>Reset to {benchmark} <ArrowUpRight size={13} /></button></div></div>
          <div className="watchlist-card"><div className="watchlist-heading"><div><div className="section-kicker">WATCHLIST</div><h3>Rotation leaders</h3></div><Search size={16} /></div><div className="watchlist-list">{(snapshot?.assets || []).slice().sort((a, b) => (b.points.at(-1)?.x || 0) + (b.points.at(-1)?.y || 0) - ((a.points.at(-1)?.x || 0) + (a.points.at(-1)?.y || 0))).slice(0, 6).map((asset) => { const point = asset.points.at(-1); const selected = asset.ticker === detailTicker; return <button className={`watch-item ${selected ? "selected" : ""}`} key={asset.ticker} onClick={() => setSelectedTicker(asset.ticker)}><span className="watch-symbol"><i style={{ background: hashColor(asset.ticker, universe) }} />{asset.ticker}</span><span className="watch-label">{asset.label}</span><span className={`watch-score ${(point?.x || 0) >= 100 ? "positive" : "negative"}`}>{point?.x.toFixed(1) || "—"}</span></button>; })}</div>{!snapshot && <div className="empty-watch">Assets will appear after the first data sync.</div>}</div>
        </aside>
      </section>

      <section className="chart-card detail-card"><div className="card-heading"><div><div className="section-kicker"><span className="live-line" />PRICE ACTION / {detailTicker}</div><h3>{detailTicker} candlestick detail</h3><p>{metadata[detailTicker]?.name || map[detailTicker] || "S&P 500 benchmark"} · filtered through {snapshot ? formatEasternLong(snapshot.ts) : "latest available candle"}</p></div><div className="detail-badge"><Download size={13} />OHLC · {TIMEFRAMES[timeframe].label}</div></div><div className="plot-wrap detail-plot">{status === "loading" && <div className="chart-loading"><Loader2 className="spin" size={23} /><span>Loading price action…</span></div>}<div ref={detailRef} className="plot" /></div></section>

      <footer className="footer"><span>ASSETS ROTATION <i />Built for focused market context</span><span>{fetchedAt ? `Provider sync · ${new Date(fetchedAt).toLocaleTimeString()}` : "Awaiting provider sync"}</span></footer>
    </main>
  );
}

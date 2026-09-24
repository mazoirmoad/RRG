import { useEffect, useRef } from "react";
import * as echarts from "echarts";

type RrgPoint = { x: number; y: number; ts: number };
type RrgAsset = { ticker: string; label: string; points: RrgPoint[] };
type MarketRow = { ts: number; open: number; high: number; low: number; close: number };

type BaseProps = { height?: number; className?: string };

type RrgChartProps = BaseProps & {
  assets: RrgAsset[];
  selectedTicker: string;
  onTickerSelect: (ticker: string) => void;
};

type CandlestickChartProps = BaseProps & {
  ticker: string;
  label: string;
  rows: MarketRow[];
  selectedIndex: number;
  color: string;
};

const chartText = "#edf5ff";
const chartMuted = "#7f9bb8";
const chartGrid = "rgba(124, 163, 200, 0.16)";
const tooltipBackground = "#10253b";
const tooltipBorder = "#31577b";
const upColor = "#35e08a";
const downColor = "#ff6b7c";

function useEChart(
  ref: React.RefObject<HTMLDivElement | null>,
  option: echarts.EChartsOption,
  onClick?: (params: any) => void,
) {
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    const handleClick = (params: any) => clickRef.current?.(params);
    chart.on("click", handleClick);
    chart.setOption(option, true);

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(ref.current);
    return () => {
      resizeObserver.disconnect();
      chart.off("click", handleClick);
      chart.dispose();
    };
  }, [ref, option]);
}

function tooltipStyle() {
  return {
    backgroundColor: tooltipBackground,
    borderColor: tooltipBorder,
    borderWidth: 1,
    textStyle: { color: chartText, fontFamily: "IBM Plex Mono, monospace", fontSize: 11 },
    extraCssText: "box-shadow: 0 12px 30px rgba(0,0,0,.28); border-radius: 6px;",
  };
}

function formatDate(ts: number) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ts * 1000));
}

function RrgChart({ assets, selectedTicker, onTickerSelect, height = 540, className }: RrgChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const allPoints = assets.flatMap((asset) => asset.points);
  const maxDistance = Math.max(
    8,
    ...allPoints.map((point) => Math.max(Math.abs(point.x - 100), Math.abs(point.y - 100))),
  ) * 1.18;
  const min = 100 - maxDistance;
  const max = 100 + maxDistance;

  const option: echarts.EChartsOption = {
    animation: false,
    backgroundColor: "transparent",
    grid: { left: 58, right: 22, top: 34, bottom: 48 },
    textStyle: { color: chartMuted, fontFamily: "IBM Plex Mono, monospace" },
    tooltip: {
      trigger: "item",
      ...tooltipStyle(),
      formatter: (params: any) => {
        const value = params.value as [number, number, number, string, string];
        return `<div style="font-weight:600;color:${params.color}">${value[3]}</div><div style="margin-top:6px;color:${chartMuted}">${value[4]}</div><div style="margin-top:5px">RS-Ratio&nbsp;&nbsp;<b>${Number(value[0]).toFixed(2)}</b><br/>RS-Momentum&nbsp;&nbsp;<b>${Number(value[1]).toFixed(2)}</b></div>`;
      },
    },
    xAxis: {
      type: "value",
      min,
      max,
      name: "RS-Ratio",
      nameLocation: "middle",
      nameGap: 31,
      nameTextStyle: { color: chartMuted, fontSize: 10 },
      axisLabel: { color: chartMuted, fontSize: 10 },
      axisLine: { lineStyle: { color: "rgba(157,190,220,.35)" } },
      splitLine: { lineStyle: { color: chartGrid } },
    },
    yAxis: {
      type: "value",
      min,
      max,
      name: "RS-Momentum",
      nameLocation: "middle",
      nameGap: 42,
      nameTextStyle: { color: chartMuted, fontSize: 10 },
      axisLabel: { color: chartMuted, fontSize: 10 },
      axisLine: { lineStyle: { color: "rgba(157,190,220,.35)" } },
      splitLine: { lineStyle: { color: chartGrid } },
    },
    graphic: [
      { type: "text", right: 28, top: 10, style: { text: "LEADING", fill: "rgba(53,224,138,.72)", font: "10px IBM Plex Mono" } },
      { type: "text", left: 66, top: 10, style: { text: "IMPROVING", fill: "rgba(88,166,255,.72)", font: "10px IBM Plex Mono" } },
      { type: "text", right: 28, bottom: 22, style: { text: "WEAKENING", fill: "rgba(255,207,92,.72)", font: "10px IBM Plex Mono" } },
      { type: "text", left: 66, bottom: 22, style: { text: "LAGGING", fill: "rgba(255,107,124,.72)", font: "10px IBM Plex Mono" } },
    ],
    series: ([
      {
        type: "scatter",
        data: [[100, 100]],
        symbolSize: 0,
        silent: true,
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: "rgba(157,190,220,.42)", type: "dashed", width: 1 },
          data: [{ xAxis: 100 }, { yAxis: 100 }],
        },
      },
      ...assets.map((asset) => {
        const color = asset.ticker === selectedTicker ? chartText : undefined;
        return {
          type: "line",
          name: asset.ticker,
          data: asset.points.map((point, index) => [point.x, point.y, point.ts, asset.ticker, asset.label, index]),
          symbol: "circle",
          symbolSize: (value: any[]) => value[5] === asset.points.length - 1 ? (asset.ticker === selectedTicker ? 10 : 8) : 5,
          smooth: false,
          lineStyle: { color: color || undefined, opacity: asset.ticker === selectedTicker ? 1 : 0.72, width: asset.ticker === selectedTicker ? 2.2 : 1.4 },
          itemStyle: { color: color || undefined, borderColor: "#07111f", borderWidth: 1 },
          label: {
            show: true,
            position: "top",
            color: color || undefined,
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 10,
            formatter: (params: any) => params.dataIndex === asset.points.length - 1 ? asset.ticker : "",
          },
          emphasis: { focus: "series", scale: true, lineStyle: { width: 2.5 } },
        };
      }),
    ] as any),
  };

  useEChart(ref, option, (params) => {
    if (params?.seriesName && params.seriesName !== "") onTickerSelect(params.seriesName);
  });
  return <div ref={ref} className={className} style={{ height, width: "100%" }} />;
}

function CandlestickChart({ ticker, label, rows, selectedIndex, color, height = 360, className }: CandlestickChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const categories = rows.map((_, index) => String(index));
  const safeIndex = rows.length ? Math.max(0, Math.min(selectedIndex, rows.length - 1)) : 0;
  const candleData = rows.map((row, index) => [row.open, row.close, row.low, row.high, row.ts, index, row.close >= row.open ? upColor : downColor]);
  const option: echarts.EChartsOption = {
    animation: false,
    backgroundColor: "transparent",
    grid: { left: 58, right: 22, top: 24, bottom: 45 },
    textStyle: { color: chartMuted, fontFamily: "IBM Plex Mono, monospace" },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross", lineStyle: { color: "rgba(88,166,255,.55)", width: 1 } },
      ...tooltipStyle(),
      formatter: (params: any) => {
        const item = Array.isArray(params) ? params[0] : params;
        const row = rows[Number(item?.dataIndex)];
        if (!row) return "";
        const tone = row.close >= row.open ? upColor : downColor;
        return `<div style="color:${chartMuted};margin-bottom:6px">${formatDate(row.ts)} ET</div><div style="color:${tone};font-weight:600">${ticker} · ${label}</div><div style="margin-top:5px">O&nbsp;&nbsp;<b>$${row.open.toFixed(2)}</b>&nbsp;&nbsp;H&nbsp;&nbsp;<b>$${row.high.toFixed(2)}</b><br/>L&nbsp;&nbsp;<b>$${row.low.toFixed(2)}</b>&nbsp;&nbsp;C&nbsp;&nbsp;<b>$${row.close.toFixed(2)}</b></div>`;
      },
    },
    xAxis: {
      type: "category",
      data: categories,
      boundaryGap: true,
      axisLabel: {
        color: chartMuted,
        fontSize: 9,
        formatter: (value: string) => {
          const row = rows[Number(value)];
          if (!row) return "";
          return formatDate(row.ts).replace(", ", "\n");
        },
        interval: Math.max(0, Math.floor(rows.length / 7) - 1),
      },
      axisLine: { lineStyle: { color: "rgba(157,190,220,.35)" } },
      splitLine: { show: false },
    },
    yAxis: {
      scale: true,
      axisLabel: { color: chartMuted, fontSize: 9, formatter: (value: number) => `$${value}` },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: chartGrid } },
    },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "slider", xAxisIndex: 0, height: 12, bottom: 8, borderColor: "transparent", backgroundColor: "rgba(124,163,200,.08)", fillerColor: "rgba(88,166,255,.18)", handleStyle: { color: "#58a6ff" }, textStyle: { color: chartMuted } },
    ],
    series: [{
      type: "candlestick",
      name: ticker,
      data: candleData.map((candle, index) => ({
        value: candle,
        itemStyle: {
          color: candle[1] >= candle[0] ? upColor : downColor,
          color0: candle[1] >= candle[0] ? upColor : downColor,
          borderColor: candle[1] >= candle[0] ? upColor : downColor,
          borderColor0: candle[1] >= candle[0] ? upColor : downColor,
          opacity: index > safeIndex ? 0.18 : index === safeIndex ? 1 : 0.86,
        },
      })),
      barMaxWidth: 14,
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#58a6ff", width: 1, opacity: 0.9 },
        label: { show: true, formatter: "SELECTED", color: "#58a6ff", fontSize: 9 },
        data: rows.length ? [{ xAxis: String(safeIndex) }] : [],
      },
    }],
  };
  useEChart(ref, option);
  return <div ref={ref} className={className} style={{ height, width: "100%" }} />;
}

export { CandlestickChart, RrgChart };
export type { MarketRow, RrgAsset };

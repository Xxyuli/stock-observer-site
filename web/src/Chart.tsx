import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
  ColorType,
  type Time,
  type IChartApi,
  type SeriesMarker,
} from "lightweight-charts";
import type { Bar, Detail, State, Settings } from "./types";

const colors: Record<string, string> = {
  ma20: "#aa7856",
  ma60: "#7b8c96",
  ma120: "#9a8aaa",
  ma200: "#6f8d7a",
  ema20: "#aa7856",
  ema60: "#7b8c96",
  ema120: "#9a8aaa",
  ema200: "#6f8d7a",
  boll_upper: "#a8a29a",
  boll_lower: "#a8a29a",
};
export default function Chart({
  detail,
  period,
  settings,
  state,
  range,
}: {
  detail: Detail;
  period: "daily" | "weekly" | "monthly";
  settings: Settings;
  state: State;
  range: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const sub = useRef<HTMLDivElement>(null);
  const legend = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current || !sub.current) return;
    const bars = detail[period];
    const clean = bars.filter((b) => b.close !== null && b.open !== null);
    if (!clean.length) return;
    const options = {
      layout: {
        background: { type: ColorType.Solid, color: "#fcfbf8" },
        textColor: "#858178",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 11,
        attributionLogo: true,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: "#ece9e2" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: false, rightOffset: 6 },
      crosshair: {
        vertLine: { color: "#b8b0a3", labelBackgroundColor: "#787267" },
        horzLine: { color: "#b8b0a3", labelBackgroundColor: "#787267" },
      },
      localization: { locale: "zh-CN" },
    };
    const chart = createChart(root.current, {
      ...options,
      width: root.current.clientWidth,
      height: 355,
    });
    const lower = createChart(sub.current, {
      ...options,
      width: sub.current.clientWidth,
      height: 135,
      layout: { ...options.layout, attributionLogo: false },
    });
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: "#6e8c7b",
      downColor: "#bc7469",
      borderVisible: false,
      wickUpColor: "#6e8c7b",
      wickDownColor: "#bc7469",
      priceLineVisible: true,
      priceLineColor: "#999185",
      lastValueVisible: true,
    });
    candle.setData(
      bars.map((b) =>
        b.close !== null && b.open !== null
          ? {
              time: b.time as Time,
              open: b.open!,
              high: b.high!,
              low: b.low!,
              close: b.close!,
            }
          : { time: b.time as Time },
      ),
    );
    for (const name of settings.indicators.flatMap((x) =>
      x === "boll" ? ["boll_upper", "boll_lower"] : x,
    )) {
      const series = chart.addSeries(LineSeries, {
        color: colors[name] || "#aa7856",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      series.setData(
        bars.map((b) =>
          typeof b[name] === "number"
            ? { time: b.time as Time, value: b[name] as number }
            : { time: b.time as Time },
        ),
      );
    }
    if (period === "daily") {
      const times = new Set(clean.map((b) => b.time));
      const recent = detail.signal.events
        .filter((e) => times.has(e.date))
        .slice(-80);
      const markers: SeriesMarker<Time>[] = recent.map((e) => ({
        time: e.date as Time,
        position: e.kind === "day10" ? "aboveBar" : "belowBar",
        color: e.kind === "day10" ? "#a46845" : "#928b7e",
        shape: e.kind === "day10" ? "arrowDown" : "circle",
        text:
          e.kind === "day10"
            ? "第10日"
            : e.kind === "review"
              ? "复核"
              : e.kind === "approaching"
                ? "D8"
                : "D1",
        size: 0.7,
      }));
      createSeriesMarkers(candle, markers);
    }
    const pos = state.position;
    if (pos?.status === "open") {
      const entry = detail.daily.find((b) => b.time === pos.buy_date);
      if (entry?.entry_price_factor) {
        const price = pos.buy_price * entry.entry_price_factor;
        candle.createPriceLine({
          price,
          color: "#a46845",
          lineWidth: 1,
          lineStyle: 2,
          title: "买入参考",
          axisLabelVisible: true,
        });
        candle.createPriceLine({
          price: price * 1.05,
          color: "#6e8c7b",
          lineWidth: 1,
          lineStyle: 3,
          title: "+5%",
          axisLabelVisible: false,
        });
        candle.createPriceLine({
          price: price * 0.95,
          color: "#bc7469",
          lineWidth: 1,
          lineStyle: 3,
          title: "−5%",
          axisLabelVisible: false,
        });
      }
    }
    const addLine = (key: string, color: string) => {
      const s = lower.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s.setData(
        bars.map((b) =>
          typeof b[key] === "number"
            ? { time: b.time as Time, value: b[key] as number }
            : { time: b.time as Time },
        ),
      );
      return s;
    };
    if (settings.oscillator === "volume") {
      const v = lower.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceLineVisible: false,
        lastValueVisible: false,
      });
      v.setData(
        bars.map((b) =>
          b.volume !== null
            ? {
                time: b.time as Time,
                value: b.volume,
                color: b.close! >= b.open! ? "#a7baad" : "#d8b0a7",
              }
            : { time: b.time as Time },
        ),
      );
      addLine("volume_ma20", "#b39173");
    } else if (settings.oscillator === "macd") {
      const v = lower.addSeries(HistogramSeries, {
        priceLineVisible: false,
        lastValueVisible: false,
      });
      v.setData(
        bars.map((b) =>
          typeof b.macd_hist === "number"
            ? {
                time: b.time as Time,
                value: b.macd_hist,
                color: b.macd_hist >= 0 ? "#a7baad" : "#d8b0a7",
              }
            : { time: b.time as Time },
        ),
      );
      addLine("macd", "#aa7856");
      addLine("macd_signal", "#7b8c96");
    } else if (settings.oscillator === "kdj") {
      addLine("k", "#aa7856");
      addLine("d", "#7b8c96");
      addLine("j", "#a495ad");
    } else {
      const s = addLine(settings.oscillator, "#9a7b61");
      if (settings.oscillator === "rsi")
        for (const price of [30, 70])
          s.createPriceLine({
            price,
            color: "#d3cdc1",
            lineStyle: 2,
            lineWidth: 1,
            axisLabelVisible: false,
          });
    }
    let syncing = false;
    const sync =
      (target: IChartApi) =>
      (
        r:
          | Parameters<
              ReturnType<IChartApi["timeScale"]>["setVisibleLogicalRange"]
            >[0]
          | null,
      ) => {
        if (!r || syncing) return;
        syncing = true;
        target.timeScale().setVisibleLogicalRange(r);
        syncing = false;
      };
    chart.timeScale().subscribeVisibleLogicalRangeChange(sync(lower));
    lower.timeScale().subscribeVisibleLogicalRangeChange(sync(chart));
    const visible =
      period === "daily"
        ? range
        : period === "weekly"
          ? Math.ceil(range / 5)
          : Math.ceil(range / 21);
    chart
      .timeScale()
      .setVisibleLogicalRange({
        from: Math.max(0, bars.length - visible),
        to: bars.length + 3,
      });
    const info = (b: Bar) => {
      if (legend.current)
        legend.current.textContent = `${b.time}   开 ${b.open?.toFixed(2) ?? "—"}   高 ${b.high?.toFixed(2) ?? "—"}   低 ${b.low?.toFixed(2) ?? "—"}   收 ${b.close?.toFixed(2) ?? "—"}`;
    };
    info(clean[clean.length - 1]);
    const byTime = new Map(bars.map((b) => [b.time, b]));
    chart.subscribeCrosshairMove((p) => {
      const b = byTime.get(String(p.time));
      info(b || clean[clean.length - 1]);
    });
    const resize = new ResizeObserver(() => {
      if (root.current && sub.current) {
        chart.applyOptions({ width: root.current.clientWidth });
        lower.applyOptions({ width: sub.current.clientWidth });
      }
    });
    resize.observe(root.current);
    return () => {
      resize.disconnect();
      chart.remove();
      lower.remove();
    };
  }, [
    detail,
    period,
    settings.indicators,
    settings.oscillator,
    state.position,
    range,
  ]);
  return (
    <div className="chart-area">
      <div ref={legend} className="chart-legend" aria-live="off" />
      {period !== "daily" && (
        <div className="period-note">
          {detail.period_complete?.[period]
            ? "末根周期已结束"
            : `末根${period === "weekly" ? "周" : "月"} K 尚未结束，仅供观察`}
        </div>
      )}
      <div ref={root} className="price-chart" data-testid="price-chart" />
      <div className="sub-label">
        {settings.oscillator.toUpperCase()}{" "}
        <span>
          {settings.oscillator === "volume"
            ? "成交量 · MA20"
            : settings.oscillator === "macd"
              ? "12 · 26 · 9"
              : settings.oscillator === "kdj"
                ? "9 · 3 · 3"
                : "14"}
        </span>
      </div>
      <div ref={sub} />
      <div className="chart-foot">
        <span>前复权 · 收盘确认后更新</span>
        <a href="./licenses.txt" target="_blank" rel="noreferrer">
          TradingView Lightweight Charts™
        </a>
      </div>
    </div>
  );
}

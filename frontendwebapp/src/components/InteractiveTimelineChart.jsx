import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  Legend,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { compactMoney } from "../utils/format";
import DashboardPeriodFilter from "./DashboardPeriodFilter";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fallbackCompactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function CompactBarLabel({ x, y, width, value, payload, bar, moduleDashboard }) {
  const rawValue = bar?.rawDataKey && payload ? Number(payload[bar.rawDataKey] || 0) : Number(value || 0);
  if (!Number.isFinite(rawValue) || rawValue === 0) return null;
  const label = moduleDashboard ? compactMoney(rawValue) : fallbackCompactFormatter.format(rawValue);
  const color = !bar?.sameColorForSigns && rawValue < 0 && bar?.negativeColor ? bar.negativeColor : bar?.color || "#0f766e";
  return (
    <text x={Number(x) + Number(width) / 2} y={Number(y) - 6} textAnchor="middle" fill={color} fontSize={10} fontWeight={700}>
      {label}
    </text>
  );
}

function CustomTooltip({ active, label, payload, bars }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{label}</div>
      {payload.map((item) => {
        const bar = bars.find((candidate) => candidate.dataKey === item.dataKey);
        const rawValue = bar?.rawDataKey && item.payload && Object.prototype.hasOwnProperty.call(item.payload, bar.rawDataKey)
          ? Number(item.payload[bar.rawDataKey] || 0)
          : Number(item.value || 0);
        return <div key={item.dataKey} className="chart-tooltip-row" style={{ color: item.color }}>{item.name}: {currencyFormatter.format(rawValue)}</div>;
      })}
    </div>
  );
}

function TimelineLegend({ items }) {
  if (!items?.length) return null;
  return (
    <div className="timeline-legend" aria-label="Chart legend">
      {items.map((item) => (
        <span key={item.label} className="timeline-legend-item">
          <i
            style={{
              background: item.negativeColor
                ? `linear-gradient(90deg, ${item.color} 0 50%, ${item.negativeColor} 50% 100%)`
                : item.color,
            }}
            aria-hidden="true"
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function InteractiveTimelineChart({
  title,
  subtitle,
  data,
  bars,
  windowSize = 12,
  moduleDashboard = false,
  visibleBarCountOverride,
  summaryChart = false,
  legendItems = [],
  periodFilter,
}) {
  const chartHostRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [sliderStart, setSliderStart] = useState(0);
  const [isDraggingHistory, setIsDraggingHistory] = useState(false);
  const isMonthly = String(data?.[0]?.key || "").length === 7;
  const minimumVisibleBars = isMonthly ? 5 : 7;
  const pixelsPerBar = isMonthly ? 182 : 154;
  const visibleBarCount = moduleDashboard
    ? Math.min(data.length, visibleBarCountOverride ?? Math.max(minimumVisibleBars, Math.floor((chartWidth || 976) / pixelsPerBar)))
    : data.length;
  const maxStart = Math.max(0, data.length - visibleBarCount);
  const safeStart = Math.min(sliderStart, maxStart);
  const visibleData = useMemo(
    () => moduleDashboard ? data.slice(safeStart, safeStart + visibleBarCount) : data,
    [data, moduleDashboard, safeStart, visibleBarCount],
  );
  const brushEndIndex = Math.max(0, data.length - 1);
  const brushStartIndex = Math.max(0, brushEndIndex - (windowSize - 1));

  useEffect(() => {
    if (!moduleDashboard || !chartHostRef.current) return undefined;
    const host = chartHostRef.current;
    const updateWidth = () => setChartWidth(host.getBoundingClientRect().width);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(host);
    return () => observer.disconnect();
  }, [moduleDashboard]);

  useEffect(() => {
    if (moduleDashboard) setSliderStart(maxStart);
  }, [data.length, moduleDashboard, visibleBarCount, maxStart]);

  const getCellColor = (bar, row) => {
    const rawValue = Number(row?.[bar.rawDataKey || bar.dataKey] || 0);
    if (bar.sameColorForSigns) return bar.color;
    if (bar.signColor) return rawValue < 0 ? bar.negativeColor || "#f2555f" : bar.color;
    if (rawValue < 0 && bar.negativeColor) return bar.negativeColor;
    return bar.color;
  };

  return (
    <section className={`graph-card chart-card${moduleDashboard ? " module-dashboard-chart" : ""}${summaryChart ? " summary-chart-compact" : ""}`}>
      <div className={periodFilter ? "summary-chart-header" : ""}>
        <h4>{title}</h4>
        {periodFilter ? <DashboardPeriodFilter {...periodFilter} ranges={["month", "year", "custom", "all_time"]} /> : null}
      </div>
      {subtitle ? <p className="chart-caption">{subtitle}</p> : null}

      {data.length === 0 ? (
        <div className="chart-empty">Not enough data yet to draw this chart.</div>
      ) : (
        <>
          <div ref={chartHostRef} className="chart-frame">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={visibleData}
                margin={{ top: moduleDashboard ? 34 : 28, right: moduleDashboard ? 20 : 16, left: 8, bottom: moduleDashboard ? 22 : 16 }}
                barCategoryGap={moduleDashboard ? "28%" : "10%"}
                barGap={moduleDashboard ? 8 : 4}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.28)" />
                <XAxis dataKey="label" minTickGap={14} tick={{ fontSize: 12, fill: "#475569" }} />
                <YAxis domain={moduleDashboard ? [0, "auto"] : undefined} tickFormatter={(value) => moduleDashboard ? compactMoney(value) : fallbackCompactFormatter.format(Number(value || 0))} tick={{ fontSize: 12, fill: "#475569" }} />
                <Tooltip content={<CustomTooltip bars={bars} />} />
                {!moduleDashboard ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
                <ReferenceLine y={0} stroke="#334155" strokeOpacity={0.65} />
                {bars.map((bar) => (
                  <Bar
                    key={bar.dataKey}
                    dataKey={bar.dataKey}
                    name={bar.name}
                    fill={bar.color || "#14b8a6"}
                    maxBarSize={moduleDashboard ? 46 : 28}
                    isAnimationActive={moduleDashboard && !isDraggingHistory}
                    animationDuration={220}
                  >
                    <LabelList
                      dataKey={bar.dataKey}
                      position="top"
                      content={(props) => <CompactBarLabel {...props} bar={bar} moduleDashboard={moduleDashboard} />}
                    />
                    {visibleData.map((row, index) => <Cell key={`${bar.dataKey}-${index}`} fill={getCellColor(bar, row)} />)}
                  </Bar>
                ))}
                {!moduleDashboard ? (
                  <Brush
                    dataKey="label"
                    height={28}
                    stroke="#14b8a6"
                    travellerWidth={12}
                    startIndex={brushStartIndex}
                    endIndex={brushEndIndex}
                  />
                ) : null}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {moduleDashboard ? (
            <>
              <div className="chart-slider-wrap">
                <button
                  type="button"
                  className="chart-history-step"
                  aria-label="Show older chart data"
                  disabled={safeStart <= 0}
                  onClick={() => setSliderStart((current) => Math.max(0, current - 1))}
                >‹</button>
                <input
                  className="chart-history-slider"
                  type="range"
                  min="0"
                  max={maxStart}
                  step="1"
                  value={safeStart}
                  disabled={maxStart === 0}
                  aria-label="Slide through chart history"
                  onChange={(event) => setSliderStart(Number(event.target.value))}
                  onPointerDown={() => setIsDraggingHistory(true)}
                  onPointerUp={() => setIsDraggingHistory(false)}
                  onPointerCancel={() => setIsDraggingHistory(false)}
                  onBlur={() => setIsDraggingHistory(false)}
                />
                <button
                  type="button"
                  className="chart-history-step"
                  aria-label="Show newer chart data"
                  disabled={safeStart >= maxStart}
                  onClick={() => setSliderStart((current) => Math.min(maxStart, current + 1))}
                >›</button>
              </div>
              <TimelineLegend items={legendItems} />
            </>
          ) : null}
        </>
      )}
    </section>
  );
}

export default InteractiveTimelineChart;

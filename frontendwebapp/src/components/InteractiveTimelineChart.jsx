import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function CustomTooltip({ active, label, payload, bars }) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.96)",
        border: "1px solid rgba(203, 213, 225, 0.9)",
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
      }}
      >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((item) => {
        const bar = bars.find((candidate) => candidate.dataKey === item.dataKey);
        const rawValue =
          bar?.rawDataKey && item.payload && Object.prototype.hasOwnProperty.call(item.payload, bar.rawDataKey)
            ? Number(item.payload[bar.rawDataKey] || 0)
            : Number(item.value || 0);

        return (
          <div key={item.dataKey} style={{ color: item.color, fontSize: 13, marginBottom: 2 }}>
            {item.name}: {currencyFormatter.format(rawValue)}
          </div>
        );
      })}
    </div>
  );
}

function InteractiveTimelineChart({ title, subtitle, data, bars, windowSize = 12 }) {
  const brushEndIndex = Math.max(0, data.length - 1);
  const brushStartIndex = Math.max(0, brushEndIndex - (windowSize - 1));
  const getCellColor = (bar, row) => {
    const rawValue = Number(row?.[bar.rawDataKey || bar.dataKey] || 0);
    if (rawValue < 0 && bar.negativeColor) {
      return bar.negativeColor;
    }
    return bar.color;
  };

  return (
    <section className="graph-card chart-card">
      <h4>{title}</h4>
      {subtitle ? <p className="chart-caption">{subtitle}</p> : null}

      {data.length === 0 ? (
        <div className="chart-empty">Not enough data yet to draw this chart.</div>
      ) : (
        <div className="chart-frame">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.28)" />
              <XAxis dataKey="label" minTickGap={18} tick={{ fontSize: 12, fill: "#475569" }} />
              <YAxis tickFormatter={(value) => compactFormatter.format(Number(value || 0))} tick={{ fontSize: 12, fill: "#475569" }} />
              <Tooltip content={<CustomTooltip bars={bars} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#334155" strokeOpacity={0.65} />
              {bars.map((bar) => (
                <Bar
                  key={bar.dataKey}
                  dataKey={bar.dataKey}
                  name={bar.name}
                  fill={typeof bar.color === "string" ? bar.color : "#0f766e"}
                  maxBarSize={28}
                  isAnimationActive={false}
                >
                  {data.map((row, index) => (
                    <Cell key={`${bar.dataKey}-${index}`} fill={getCellColor(bar, row)} />
                  ))}
                </Bar>
              ))}
              <Brush
                dataKey="label"
                height={28}
                stroke="#0f766e"
                travellerWidth={12}
                startIndex={brushStartIndex}
                endIndex={brushEndIndex}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

export default InteractiveTimelineChart;

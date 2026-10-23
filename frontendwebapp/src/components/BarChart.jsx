import { compactMoney } from "../utils/format";

const exactFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function BarChart({ title, data, color = "#14b8a6", negativeColor = "#f2555f" }) {
  const maxValue = Math.max(0, ...data.map((item) => Math.abs(item.value)));

  return (
    <section className="card">
      <h3>{title}</h3>
      <div className="bar-chart">
        {data.map((item) => {
          const width = maxValue > 0 ? (Math.abs(item.value) / maxValue) * 100 : 0;
          const barColor = item.color || (Number(item.value) < 0 ? item.negativeColor || negativeColor : color);
          return (
            <div key={item.label} className="bar-row">
              <span className="bar-label">{item.label}</span>
              <div className="bar-track">
                <div className="bar-fill" title={exactFormatter.format(Number(item.value || 0))} style={{ width: `${width}%`, background: barColor }} />
              </div>
              <span className="bar-value" title={exactFormatter.format(Number(item.value || 0))} style={{ color: barColor }}>{compactMoney(item.value)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default BarChart;

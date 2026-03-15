function BarChart({ title, data }) {
  const maxValue = Math.max(0, ...data.map((item) => Math.abs(item.value)));

  return (
    <section className="card">
      <h3>{title}</h3>
      <div className="bar-chart">
        {data.map((item) => {
          const width = maxValue > 0 ? (Math.abs(item.value) / maxValue) * 100 : 0;
          return (
            <div key={item.label} className="bar-row">
              <span className="bar-label">{item.label}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${width}%` }} />
              </div>
              <span className="bar-value">{item.value.toFixed(2)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default BarChart;

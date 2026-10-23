import { useEffect, useState } from "react";

const DEFAULT_RANGES = ["week", "month", "year", "custom", "all_time"];

function DashboardPeriodFilter({ range, onRangeChange, setRange, startDate, endDate, onStartDateChange, setStartDate, onEndDateChange, setEndDate, ranges = DEFAULT_RANGES }) {
  const [customOpen, setCustomOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const changeRange = onRangeChange || setRange;
  const changeStartDate = onStartDateChange || setStartDate;
  const changeEndDate = onEndDateChange || setEndDate;
  useEffect(() => { setDraftStart(startDate); setDraftEnd(endDate); }, [startDate, endDate]);
  const labels = { all_time: "All Time" };
  return (
    <section className="card dashboard-period-filter" aria-label="Dashboard date range">
      <div className="period-range-buttons" role="group" aria-label="Select chart range">
        {ranges.map((option) => (
          <button key={option} type="button" className={range === option ? "active" : "ghost"} aria-pressed={range === option} onClick={() => { if (option === "custom") setCustomOpen(true); else { setCustomOpen(false); changeRange(option); } }}>
            {labels[option] || option[0].toUpperCase() + option.slice(1)}
          </button>
        ))}
        {customOpen ? (
          <div className="period-custom-popover" role="dialog" aria-label="Choose custom date range">
            <strong>Choose date range</strong>
            <div className="period-custom-fields">
              <label className="field"><span>From</span><input type="date" value={draftStart} max={draftEnd} onChange={(event) => setDraftStart(event.target.value)} /></label>
              <label className="field"><span>To</span><input type="date" value={draftEnd} min={draftStart} onChange={(event) => setDraftEnd(event.target.value)} /></label>
            </div>
            <div className="period-custom-actions">
              <button type="button" className="ghost" onClick={() => setCustomOpen(false)}>Cancel</button>
              <button type="button" onClick={() => { changeStartDate(draftStart); changeEndDate(draftEnd); changeRange("custom"); setCustomOpen(false); }}>Apply</button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default DashboardPeriodFilter;

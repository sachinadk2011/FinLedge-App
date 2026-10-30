import { useEffect, useLayoutEffect, useRef, useState } from "react";

const DEFAULT_RANGES = ["week", "month", "year", "custom", "all_time"];

function DashboardPeriodFilter({ range, onRangeChange, setRange, startDate, endDate, onStartDateChange, setStartDate, onEndDateChange, setEndDate, ranges = DEFAULT_RANGES }) {
  const [customOpen, setCustomOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState(null);
  const customButtonRef = useRef(null);
  const popoverRef = useRef(null);
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const changeRange = onRangeChange || setRange;
  const changeStartDate = onStartDateChange || setStartDate;
  const changeEndDate = onEndDateChange || setEndDate;
  useEffect(() => { setDraftStart(startDate); setDraftEnd(endDate); }, [startDate, endDate]);
  useEffect(() => {
    if (!customOpen) return undefined;
    const closeOnOutsidePointer = (event) => {
      if (popoverRef.current?.contains(event.target) || customButtonRef.current?.contains(event.target)) return;
      setCustomOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setCustomOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [customOpen]);
  useLayoutEffect(() => {
    if (!customOpen || !document.body.classList.contains("finledge-desktop")) return undefined;
    const placePopover = () => {
      const buttonBounds = customButtonRef.current?.getBoundingClientRect();
      const popover = popoverRef.current;
      if (!buttonBounds || !popover) return;
      const margin = 20;
      const bounds = popover.getBoundingClientRect();
      const left = Math.min(Math.max(margin, buttonBounds.left), window.innerWidth - bounds.width - margin);
      const below = buttonBounds.bottom + 8;
      const top = below + bounds.height <= window.innerHeight - margin
        ? below
        : Math.max(margin, buttonBounds.top - bounds.height - 8);
      setPopoverPosition({ left, top });
    };
    placePopover();
    window.addEventListener("resize", placePopover);
    window.addEventListener("scroll", placePopover, true);
    return () => {
      window.removeEventListener("resize", placePopover);
      window.removeEventListener("scroll", placePopover, true);
    };
  }, [customOpen]);
  const labels = { all_time: "All Time" };
  return (
    <section className="card dashboard-period-filter" aria-label="Dashboard date range">
      <div className="period-range-buttons" role="group" aria-label="Select chart range">
        {ranges.map((option) => (
          <button ref={option === "custom" ? customButtonRef : undefined} key={option} type="button" className={range === option ? "active" : "ghost"} aria-pressed={range === option} aria-expanded={option === "custom" ? customOpen : undefined} onClick={() => { if (option === "custom") setCustomOpen((open) => !open); else { setCustomOpen(false); changeRange(option); } }}>
            {labels[option] || option[0].toUpperCase() + option.slice(1)}
          </button>
        ))}
        {customOpen ? (
          <div ref={popoverRef} className="period-custom-popover" style={document.body.classList.contains("finledge-desktop") ? (popoverPosition || { left: 12, top: 12 }) : undefined} role="dialog" aria-label="Choose custom date range">
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

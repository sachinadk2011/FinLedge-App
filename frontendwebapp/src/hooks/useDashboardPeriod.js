import { useMemo, useState } from "react";

import { filterRecordsByPeriod, getDashboardPeriodBounds, getDefaultCustomRange, getRecordDateBounds } from "../utils/dashboardPeriod";

function useDashboardPeriod(defaultRange, options = {}) {
  const initialDates = useMemo(() => getDefaultCustomRange(), []);
  const [range, setRange] = useState(() => {
    const importTypes = options.importTypes || [];
    if (!importTypes.length || typeof window === "undefined") return defaultRange;
    try {
      const pendingImport = window.sessionStorage.getItem("finledge:pending-dashboard-import");
      if (importTypes.includes(pendingImport)) {
        window.sessionStorage.removeItem("finledge:pending-dashboard-import");
        return "all_time";
      }
    } catch {
      // Keep the normal default when session storage is unavailable.
    }
    return defaultRange;
  });
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);
  const bounds = useMemo(
    () => getDashboardPeriodBounds(range, startDate, endDate, options),
    [range, startDate, endDate, options.bankMode],
  );
  const filterRecords = (records) => range === "all_time" ? records : filterRecordsByPeriod(records, bounds);
  const boundsForRecords = (records) => range === "all_time" ? getRecordDateBounds(records) : bounds;

  return { range, setRange, startDate, setStartDate, endDate, setEndDate, bounds, filterRecords, boundsForRecords };
}

export default useDashboardPeriod;

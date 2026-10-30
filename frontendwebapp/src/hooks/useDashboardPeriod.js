import { useMemo, useState } from "react";

import { filterRecordsByPeriod, getDashboardPeriodBounds, getDefaultCustomRange, getRecordDateBounds } from "../utils/dashboardPeriod";

function useDashboardPeriod(defaultRange, options = {}) {
  const initialDates = useMemo(() => getDefaultCustomRange(), []);
  const [range, setRange] = useState(defaultRange);
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);
  const bounds = useMemo(
    () => getDashboardPeriodBounds(range, startDate, endDate, options),
    [range, startDate, endDate, options.bankMode],
  );
  const filterRecords = (records) => range === "all_time" ? records : filterRecordsByPeriod(records, bounds);
  const boundsForRecords = (records) => range === "all_time" ? getRecordDateBounds(records) : bounds;

  return { range, setRange, startDate, setStartDate, endDate, setEndDate, bounds, filterRecords, boundsForRecords, importNotice: "" };
}

export default useDashboardPeriod;

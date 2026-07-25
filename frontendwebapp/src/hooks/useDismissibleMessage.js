/**
 * hooks/useDismissibleMessage.js
 *
 * Custom React hook that manages a message string and auto-dismisses it
 * after `delay` ms (default 5000 ms).
 *
 * Replaces identical useEffect + setTimeout blocks that were copy-pasted into:
 *   - BankPage.jsx          (lines 60–67)
 *   - BankDashboard.jsx     (lines 151–157)
 *   - SharePage.jsx         (lines 115–122)
 *   - ShareDashboard.jsx    (lines 168–182)
 *   - PersonalFinancePage.jsx (lines 118–125)
 *
 * Usage:
 *   const [error, setError]     = useDismissibleMessage();
 *   const [success, setSuccess] = useDismissibleMessage();
 *
 * Or with a custom delay:
 *   const [msg, setMsg] = useDismissibleMessage(8000);
 */
import { useState, useEffect } from "react";

export function useDismissibleMessage(delay = 5000) {
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), delay);
    return () => clearTimeout(timer);
  }, [message, delay]);

  return [message, setMessage];
}

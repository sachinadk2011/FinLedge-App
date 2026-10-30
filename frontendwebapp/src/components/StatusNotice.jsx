import { useCallback, useEffect, useState } from "react";
import { useDismissibleMessage } from "../hooks/useDismissibleMessage";

function StatusNotice({ message, onDismiss, kind = "error", duration = 5000 }) {
  const [dismissed, setDismissed] = useState(false);
  const desktopRuntime = typeof window !== "undefined" && Boolean(window.financialTracker);
  useEffect(() => {
    if (desktopRuntime) setDismissed(false);
  }, [message, desktopRuntime]);
  const dismiss = useCallback(() => {
    if (onDismiss) onDismiss();
    else setDismissed(true);
  }, [onDismiss]);
  useDismissibleMessage(
    desktopRuntime ? (message && !dismissed ? message : "") : message,
    desktopRuntime ? dismiss : onDismiss,
    duration,
  );

  if (!message || (desktopRuntime && dismissed)) return null;

  const role = kind === "error" || kind === "warning" ? "alert" : "status";

  return (
    <div className={`status-notice status-notice-${kind}`} role={role} aria-live={kind === "error" ? "assertive" : "polite"}>
      <span>{message}</span>
      {onDismiss || desktopRuntime ? (
        <button type="button" className="status-notice-close" aria-label="Dismiss message" onClick={dismiss}>
          ×
        </button>
      ) : null}
      <div key={`${kind}-${message}`} className="status-notice-progress" style={{ animationDuration: `${duration}ms` }} aria-hidden="true" />
    </div>
  );
}

export default StatusNotice;

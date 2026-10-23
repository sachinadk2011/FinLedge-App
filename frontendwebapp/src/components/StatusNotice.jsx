import { useDismissibleMessage } from "../hooks/useDismissibleMessage";

function StatusNotice({ message, onDismiss, kind = "error", duration = 5000 }) {
  useDismissibleMessage(message, onDismiss, duration);

  if (!message) return null;

  const role = kind === "error" || kind === "warning" ? "alert" : "status";

  return (
    <div className={`status-notice status-notice-${kind}`} role={role} aria-live={kind === "error" ? "assertive" : "polite"}>
      <span>{message}</span>
      {onDismiss ? (
        <button type="button" className="status-notice-close" aria-label="Dismiss message" onClick={onDismiss}>
          ×
        </button>
      ) : null}
      <div key={`${kind}-${message}`} className="status-notice-progress" style={{ animationDuration: `${duration}ms` }} aria-hidden="true" />
    </div>
  );
}

export default StatusNotice;

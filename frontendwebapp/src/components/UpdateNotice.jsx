import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Dev-mode simulation
// When running `npm run dev` (Vite) without the Electron shell, the real
// window.financialTracker bridge does not exist.  We inject a lightweight
// mock so you can see exactly how the update notice will look in production.
// This code is tree-shaken away in production builds (import.meta.env.DEV).
// ---------------------------------------------------------------------------
function buildDevMockBridge() {
  // Read ?mock=required or #mock-update=required from URL, fallback to "available".
  // Examples:
  //   http://localhost:5173/#mock-update=required  → shows the blocking required-update dialog
  //   http://localhost:5173/#mock-update=available  → shows the normal available banner (default)
  const hashParam = new URLSearchParams(
    window.location.hash.replace(/^#/, "")
  ).get("mock-update");
  const MOCK_STATE = hashParam === "required" ? "required" : "available";

  const mockStatus = {
    state: MOCK_STATE,
    title: "Finledge 1.3.0 is available",
    detail:
      MOCK_STATE === "required"
        ? "This version is no longer supported. Please install the latest release."
        : "A new version of Finledge is ready. Download it from GitHub Releases.",
    version: "1.3.0",
    releaseUrl: "https://github.com/sachinadk2011/FinLedge-App/releases/latest",
    releaseNotes: [
      "Improved update notification banner with dev-mode preview.",
      "Reload button removed from header for a cleaner look.",
      "Tour guide code kept ready — will be enabled in a future release.",
    ],
    isSimulation: true,
    updatedAt: new Date().toISOString(),
  };

  return {
    /** Immediately resolves with the mock status */
    getUpdateStatus: () => Promise.resolve(mockStatus),
    /** Calls callback once on next tick, returns an unsubscribe fn */
    onUpdateStatus: (callback) => {
      const id = setTimeout(() => callback(mockStatus), 400);
      return () => clearTimeout(id);
    },
    /** Just open the GitHub releases page */
    openUpdateRelease: (url) => {
      window.open(url || mockStatus.releaseUrl, "_blank", "noopener");
      return Promise.resolve({ ok: true });
    },
  };
}

function getUpdaterBridge() {
  if (typeof window === "undefined") return null;
  if (window.financialTracker) return window.financialTracker;
  // In Vite dev mode show a simulated banner so you can style/test without Electron.
  if (import.meta.env.DEV) return buildDevMockBridge();
  return null;
}

function getStateIcon(state) {
  if (state === "required") return "🚨";
  if (state === "error") return "⚠️";
  if (state === "checking") return "🔄";
  if (state === "not-available") return "✅";
  return "🆕";
}

function getAccentColor(state) {
  if (state === "required") return "#dc2626";
  if (state === "error") return "#d97706";
  if (state === "not-available") return "#16a34a";
  if (state === "checking") return "#6366f1";
  return "#2563eb"; // available
}

export default function UpdateNotice() {
  const [status, setStatus] = useState(null);
  const [dismissedAt, setDismissedAt] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const updater = getUpdaterBridge();

  useEffect(() => {
    if (!updater?.onUpdateStatus) return undefined;

    let isMounted = true;

    updater
      .getUpdateStatus?.()
      .then((currentStatus) => {
        if (isMounted && currentStatus?.state && currentStatus.state !== "idle") {
          setStatus(currentStatus);
          // Auto-expand for required or if it has release notes
          if (currentStatus.state === "required" || currentStatus.releaseNotes?.length > 0) {
            setExpanded(true);
          }
        }
      })
      .catch(() => {});

    const unsubscribe = updater.onUpdateStatus((nextStatus) => {
      setStatus(nextStatus);
      setDismissedAt("");
      setIsBusy(false);
      // Auto-expand new updates with notes
      if (nextStatus.state === "required" || nextStatus?.releaseNotes?.length > 0) {
        setExpanded(true);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [updater]);

  const isVisible =
    updater &&
    status?.state &&
    status.state !== "idle" &&
    dismissedAt !== status.updatedAt;

  if (!isVisible) return null;

  const accentColor = getAccentColor(status.state);
  const icon = getStateIcon(status.state);
  const isRequired = status.state === "required";
  const hasNotes = Array.isArray(status.releaseNotes) && status.releaseNotes.length > 0;

  const openRelease = async () => {
    const fn = updater?.openUpdateRelease || updater?.downloadUpdate;
    if (!fn) return;
    setIsBusy(true);
    // Auto-reset after 2.5 s so the button doesn't stay stuck on "Opening…"
    // when the user returns from the browser tab.
    const resetTimer = setTimeout(() => setIsBusy(false), 2500);
    try {
      const result = await fn(status?.releaseUrl);
      if (result?.ok === false) {
        clearTimeout(resetTimer);
        setIsBusy(false);
      }
    } catch {
      clearTimeout(resetTimer);
      setIsBusy(false);
    }
  };

  return (
    <>
      {/* Modal backdrop for required updates */}
      {isRequired && <div className="update-backdrop" aria-hidden="true" />}

      <aside
        className={`update-notice2${isRequired ? " update-notice2--required" : ""}`}
        style={{ "--accent": accentColor }}
        role={isRequired ? "alertdialog" : "status"}
        aria-live="polite"
        aria-modal={isRequired ? "true" : undefined}
        aria-labelledby="update-title"
      >
        {/* Top bar */}
        <div className="update-notice2__topbar" style={{ background: accentColor }}>
          <span className="update-notice2__topbar-label">
            {isRequired ? "⛔ Update Required" : status.isSimulation ? "🧪 Simulated Update" : "Finledge Update"}
          </span>
          {!isRequired && (
            <button
              type="button"
              className="update-notice2__close"
              onClick={() => setDismissedAt(status.updatedAt)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          )}
        </div>

        {/* Body */}
        <div className="update-notice2__body">
          <div className="update-notice2__icon-row">
            <span className="update-notice2__icon" aria-hidden="true">{icon}</span>
            <div>
              <div id="update-title" className="update-notice2__title">
                {status.title || "Finledge Update"}
                {status.isSimulation && (
                  <span className="update-notice2__badge">DEV TEST</span>
                )}
              </div>
              {status.version && (
                <div className="update-notice2__version">Version {status.version}</div>
              )}
            </div>
          </div>

          <p className="update-notice2__detail">{status.detail}</p>

          {/* "What's new" collapsible */}
          {hasNotes && (
            <div className="update-notice2__notes-section">
              <button
                type="button"
                className="update-notice2__notes-toggle"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
              >
                <span>✨ What's new</span>
                <span>{expanded ? "▲" : "▼"}</span>
              </button>
              {expanded && (
                <ul className="update-notice2__notes-list">
                  {status.releaseNotes.map((note, i) => (
                    <li key={i} className="update-notice2__note-item">
                      <span className="update-notice2__note-bullet">•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {isRequired && (
            <p className="update-notice2__required-warning">
              Your current version is no longer supported. Please install the latest release to continue using Finledge safely.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="update-notice2__actions">
          {(status.state === "available" || status.state === "required") && (
            <button
              type="button"
              className="update-notice2__primary"
              style={{ background: accentColor }}
              disabled={isBusy}
              onClick={openRelease}
            >
              {isBusy ? "Opening…" : "⬇ View & Download Release"}
            </button>
          )}
          {!isRequired && status.state !== "checking" && (
            <button
              type="button"
              className="update-notice2__secondary"
              onClick={() => setDismissedAt(status.updatedAt)}
            >
              Remind me later
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

import { useEffect, useState } from "react";

function getUpdaterBridge() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.financialTracker || null;
}

function getTone(state) {
  if (state === "required") return "error";
  if (state === "error") return "error";
  if (state === "not-available") return "quiet";
  return "active";
}

export default function UpdateNotice() {
  const [status, setStatus] = useState(null);
  const [dismissedAt, setDismissedAt] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const updater = getUpdaterBridge();

  useEffect(() => {
    if (!updater?.onUpdateStatus) {
      return undefined;
    }

    let isMounted = true;

    updater
      .getUpdateStatus?.()
      .then((currentStatus) => {
        if (isMounted && currentStatus?.state && currentStatus.state !== "idle") {
          setStatus(currentStatus);
        }
      })
      .catch(() => {
        // Ignore initial status lookup failures; live update events can still populate status.
      });

    const unsubscribe = updater.onUpdateStatus((nextStatus) => {
      setStatus(nextStatus);
      setDismissedAt("");
      setIsBusy(false);
    });

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [updater]);

  const tone = getTone(status?.state);
  const isVisible =
    updater &&
    status?.state &&
    status.state !== "idle" &&
    dismissedAt !== status.updatedAt;

  if (!isVisible) {
    return null;
  }

  const openRelease = async () => {
    const openReleasePage = updater?.openUpdateRelease || updater?.downloadUpdate;
    if (!openReleasePage) {
      return;
    }

    setIsBusy(true);

    try {
      const result = await openReleasePage(status?.releaseUrl);
      if (result?.ok === false) {
        setIsBusy(false);
      }
    } catch {
      setIsBusy(false);
    }
  };

  return (
    <aside
      className={`update-notice update-notice--${tone}${status.state === "required" ? " update-notice--required" : ""}`}
      role={status.state === "required" ? "alertdialog" : "status"}
      aria-live="polite"
      aria-modal={status.state === "required" ? "true" : undefined}
    >
      {status.state === "required" ? <div className="update-notice__blocker-title">Important update required</div> : null}
      <div className="update-notice__panel">
        <div className="update-notice__content">
          <div className="update-notice__icon" aria-hidden="true">
            {status.state === "not-available" ? "OK" : "UP"}
          </div>
          <div className="update-notice__text">
            <div className="update-notice__title">
              {status.title || "Finledge update"}
              {status.isSimulation ? <span className="update-notice__badge">Test</span> : null}
            </div>
            <div className="update-notice__detail">{status.detail}</div>
            {Array.isArray(status.releaseNotes) && status.releaseNotes.length > 0 ? (
              <ul className="update-notice__notes">
                {status.releaseNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
            {status.state === "required" ? (
              <p className="update-notice__required-copy">
                This version is below the minimum supported version. Install the latest GitHub release to continue using Finledge safely.
              </p>
            ) : null}
          </div>
        </div>

        <div className="update-notice__actions">
          {status.state === "available" || status.state === "required" ? (
            <button type="button" className="update-notice__primary" disabled={isBusy} onClick={openRelease}>
              {isBusy ? "Opening..." : "View release"}
            </button>
          ) : null}
          {status.state !== "checking" && status.state !== "required" ? (
            <button
              type="button"
              className="update-notice__secondary"
              onClick={() => setDismissedAt(status.updatedAt)}
            >
              Later
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

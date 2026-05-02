import { useEffect, useMemo, useState } from "react";

function getUpdaterBridge() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.financialTracker || null;
}

function formatPercent(value) {
  const percent = Number(value);
  if (!Number.isFinite(percent)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(percent)));
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getProgressLabel(status, percent) {
  if (status?.state !== "downloading") {
    return "";
  }

  const transferred = formatBytes(status.transferred);
  const total = formatBytes(status.total);

  if (transferred && total) {
    return `${percent}% (${transferred} of ${total})`;
  }

  return `${percent}%`;
}

function getTone(state) {
  if (state === "downloaded") return "ready";
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

  const percent = formatPercent(status?.percent);
  const tone = getTone(status?.state);
  const progressLabel = useMemo(() => getProgressLabel(status, percent), [status, percent]);
  const isVisible =
    updater &&
    status?.state &&
    status.state !== "idle" &&
    dismissedAt !== status.updatedAt;

  if (!isVisible) {
    return null;
  }

  const download = async () => {
    if (!updater?.downloadUpdate) {
      return;
    }

    setIsBusy(true);

    try {
      const result = await updater.downloadUpdate();
      if (result?.ok === false) {
        setIsBusy(false);
      }
    } catch {
      setIsBusy(false);
    }
  };

  const install = async () => {
    if (!updater?.installUpdate) {
      return;
    }

    setIsBusy(true);

    try {
      const result = await updater.installUpdate();
      if (result?.ok === false) {
        setIsBusy(false);
      }
    } catch {
      setIsBusy(false);
    }
  };

  return (
    <aside className={`update-notice update-notice--${tone}`} role="status" aria-live="polite">
      <div className="update-notice__content">
        <div className="update-notice__icon" aria-hidden="true">
          {status.state === "downloaded" ? "OK" : "UP"}
        </div>
        <div className="update-notice__text">
          <div className="update-notice__title">
            {status.title || "Finledge update"}
            {status.isSimulation ? <span className="update-notice__badge">Test</span> : null}
          </div>
          <div className="update-notice__detail">{status.detail}</div>
          {status.state === "downloading" ? (
            <div className="update-notice__progress" aria-label={progressLabel}>
              <span style={{ width: `${percent}%` }} />
            </div>
          ) : null}
          {progressLabel ? <div className="update-notice__meta">{progressLabel}</div> : null}
        </div>
      </div>

      <div className="update-notice__actions">
        {status.state === "available" ? (
          <button type="button" className="update-notice__primary" disabled={isBusy} onClick={download}>
            {isBusy ? "Starting..." : "Download"}
          </button>
        ) : null}
        {status.state === "downloaded" ? (
          <button type="button" className="update-notice__primary" disabled={isBusy} onClick={install}>
            {isBusy ? "Restarting..." : "Restart to update"}
          </button>
        ) : null}
        {status.state !== "downloading" && status.state !== "checking" ? (
          <button
            type="button"
            className="update-notice__secondary"
            onClick={() => setDismissedAt(status.updatedAt)}
          >
            Later
          </button>
        ) : null}
      </div>
    </aside>
  );
}

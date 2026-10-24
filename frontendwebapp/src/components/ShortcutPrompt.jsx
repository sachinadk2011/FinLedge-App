import { useEffect, useState } from "react";

function getDesktopBridge() {
  return typeof window === "undefined" ? null : window.financialTracker || null;
}

export default function ShortcutPrompt() {
  const [prompt, setPrompt] = useState(null);
  const [responding, setResponding] = useState(false);
  const bridge = getDesktopBridge();

  useEffect(() => {
    if (!bridge?.onShortcutPrompt) return undefined;
    return bridge.onShortcutPrompt((payload) => {
      setResponding(false);
      setPrompt(payload || null);
    });
  }, [bridge]);

  if (!prompt) return null;

  async function respond(createShortcut) {
    if (responding) return;
    setResponding(true);
    try {
      await bridge?.respondToShortcutPrompt?.({
        requestId: prompt.requestId,
        createShortcut,
      });
      setPrompt(null);
    } finally {
      setResponding(false);
    }
  }

  return (
    <div className="dialog-backdrop shortcut-prompt-backdrop" role="presentation">
      <section className="dialog-card shortcut-prompt-card" role="dialog" aria-modal="true" aria-labelledby="shortcut-prompt-title">
        <img className="shortcut-prompt-logo" src="./finledge-icon.png" alt="" />
        <h3 id="shortcut-prompt-title">Add a desktop shortcut?</h3>
        <p className="subtitle">
          Create a shortcut for {prompt.displayName || "FinLedge"} on your desktop? You can also open it from the Start menu.
        </p>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={() => respond(false)} disabled={responding}>
            Not now
          </button>
          <button type="button" className="shortcut-prompt-primary" onClick={() => respond(true)} disabled={responding} autoFocus>
            Create shortcut
          </button>
        </div>
      </section>
    </div>
  );
}

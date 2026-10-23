/**
 * hooks/useDismissibleMessage.js
 *
 * Owns the timeout for a visible notice so pages don't implement their own
 * timers. The notice component uses the same duration for its progress bar.
 */
import { useEffect, useRef } from "react";

export function useDismissibleMessage(message, onDismiss, delay = 5000) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!message || !dismissRef.current) return undefined;
    const timer = window.setTimeout(() => dismissRef.current?.(), delay);
    return () => window.clearTimeout(timer);
  }, [message, delay]);
}

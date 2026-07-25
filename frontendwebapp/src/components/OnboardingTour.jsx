import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export const TOUR_SEEN_KEY = "finledge.tour.seen";
export const TOUR_DISABLED_KEY = "finledge.tour.disabled";
const TOUR_PROGRESS_KEY = "finledge.tour.progress";
export const OPEN_TOUR_EVENT = "finledge:open-tour";

// Each step can have:
//  target      – CSS selector to spotlight
//  route       – navigate here before showing card
//  routeAfterClick – navigate here after user clicks target
//  requireClick – true means user must click highlighted element to advance
//  emoji       – decorative icon shown on card
//  action      – label for the primary button (non-click steps)
const steps = [
  {
    title: "Welcome to Finledge 👋",
    body: "Your personal financial tracker for bank entries, share investments, and overall portfolio insights. Let's take a 60-second interactive tour.",
    action: "Let's go!",
    emoji: "🚀",
  },
  {
    title: "Bank Services",
    body: "Click **Bank Services** in the top nav. Record interest earned, charges, and renewals — the app keeps a running net balance for you.",
    target: "[data-tour='nav-bank']",
    routeAfterClick: "/bank",
    requireClick: true,
    emoji: "🏦",
  },
  {
    title: "Enter an Amount",
    body: "Click the **Amount** field. Type any positive number — Interest Earned stays positive, charges are saved with the correct sign automatically based on category.",
    target: "[data-tour='bank-amount']",
    route: "/bank",
    requireClick: true,
    emoji: "💵",
  },
  {
    title: "Share Portfolio",
    body: "Click **Share Portfolio** to track IPO allotments, SIP, secondary market buys/sells, and dividends. The app calculates profit/loss per trade.",
    target: "[data-tour='nav-share']",
    routeAfterClick: "/share",
    requireClick: true,
    emoji: "📈",
  },
  {
    title: "Entry Type Selector",
    body: "Click **Entry type** to choose IPO, Buy, Sell, or Dividend. Each type shows only the relevant fields — no clutter.",
    target: "[data-tour='share-entry-type']",
    route: "/share",
    requireClick: true,
    emoji: "🎛️",
  },
  {
    title: "Financial Summary",
    body: "Click **Financial Summary** to see bank services totals, share portfolio investment, dividends, and your overall net financial position — all in one place.",
    target: "[data-tour='nav-summary']",
    routeAfterClick: "/summary",
    requireClick: true,
    emoji: "📊",
  },
  {
    title: "Settings",
    body: "Click **Settings** to reopen this guide anytime, see where your Excel data files are stored, and manage app preferences.",
    target: "[data-tour='nav-settings']",
    routeAfterClick: "/settings",
    requireClick: true,
    emoji: "⚙️",
  },
  {
    title: "You're all set! 🎉",
    body: "Finledge is ready to use. Add your first entry and watch your financial picture come alive. You can restart this guide from Settings.",
    action: "Start tracking",
    emoji: "✅",
  },
];

function shouldOpenAutomatically() {
  if (typeof window === "undefined") return false;
  return (
    !window.localStorage.getItem(TOUR_SEEN_KEY) &&
    !window.localStorage.getItem(TOUR_DISABLED_KEY)
  );
}

function readSavedProgress() {
  if (typeof window === "undefined") return 0;
  const parsed = Number.parseInt(
    window.localStorage.getItem(TOUR_PROGRESS_KEY) || "0",
    10
  );
  return Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, 0), steps.length - 1)
    : 0;
}

function getTargetRect(selector) {
  const element = selector ? document.querySelector(selector) : null;
  if (!element) return { element: null, rect: null };
  return { element, rect: element.getBoundingClientRect() };
}

// ─── Markdown-lite: bold **text** → <strong>
function renderBody(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function OnboardingTour() {
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [missingTarget, setMissingTarget] = useState(false);
  const [animating, setAnimating] = useState(false);
  const prevStep = useRef(0);

  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const progress = ((stepIndex + 1) / steps.length) * 100;

  // ── Position the floating card next to the spotlight ──────────────────────
  const cardStyle = useMemo(() => {
    if (!targetRect) return undefined;
    const cardWidth = Math.min(400, window.innerWidth - 32);
    const margin = 18;
    let left = targetRect.left;
    let top;

    // Prefer below the target; fall back above
    const spaceBelow = window.innerHeight - targetRect.bottom;
    const cardHeight = 300; // approximate
    if (spaceBelow >= cardHeight + margin) {
      top = targetRect.bottom + margin;
    } else {
      top = Math.max(margin, targetRect.top - cardHeight - margin);
    }

    // Keep card in viewport horizontally
    left = Math.min(
      Math.max(margin, left),
      window.innerWidth - cardWidth - margin
    );

    return { left, top, width: cardWidth, position: "fixed" };
  }, [targetRect]);

  // ── Open automatically once ────────────────────────────────────────────────
  useEffect(() => {
    if (shouldOpenAutomatically()) {
      setStepIndex(readSavedProgress());
      setOpen(true);
    }

    const openTour = () => {
      window.localStorage.setItem(TOUR_PROGRESS_KEY, "0");
      setStepIndex(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_TOUR_EVENT, openTour);
    return () => window.removeEventListener(OPEN_TOUR_EVENT, openTour);
  }, []);

  // ── Track target element whenever step / route changes ────────────────────
  useEffect(() => {
    if (!open) return undefined;
    window.localStorage.setItem(TOUR_PROGRESS_KEY, String(stepIndex));

    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
      return undefined;
    }

    let targetElement = null;
    let rafId = 0;

    const updateTarget = () => {
      const { element, rect } = getTargetRect(step.target);
      targetElement = element;
      setMissingTarget(Boolean(step.target && !element));
      setTargetRect(rect || null);
      if (element) {
        element.classList.add("tour-target-active");
        element.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      }
    };

    rafId = window.requestAnimationFrame(updateTarget);
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
      targetElement?.classList.remove("tour-target-active");
    };
  }, [location.pathname, navigate, open, step, stepIndex]);

  // ── Listen for user clicking the highlighted element ─────────────────────
  useEffect(() => {
    if (!open || !step.requireClick || !step.target) return undefined;

    const handleClick = (event) => {
      const target = event.target?.closest?.(step.target);
      if (!target) return;
      window.setTimeout(() => {
        if (step.routeAfterClick) navigate(step.routeAfterClick);
        advanceTo(stepIndex + 1);
      }, 80);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [navigate, open, step, stepIndex]); // eslint-disable-line

  if (!open) return null;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const closeTour = () => {
    window.localStorage.setItem(TOUR_SEEN_KEY, "1");
    window.localStorage.removeItem(TOUR_PROGRESS_KEY);
    setOpen(false);
  };

  const disableStartupTour = () => {
    window.localStorage.setItem(TOUR_DISABLED_KEY, "1");
    window.localStorage.setItem(TOUR_SEEN_KEY, "1");
    window.localStorage.removeItem(TOUR_PROGRESS_KEY);
    setOpen(false);
  };

  const advanceTo = (nextIndex) => {
    if (nextIndex >= steps.length) { closeTour(); return; }
    prevStep.current = stepIndex;
    setAnimating(true);
    setTimeout(() => {
      setStepIndex(nextIndex);
      setAnimating(false);
    }, 180);
  };

  const goNext = () => advanceTo(stepIndex + 1);
  const goBack = () => advanceTo(Math.max(0, stepIndex - 1));

  return (
    <div
      className={`tour-layer${targetRect ? " tour-layer--targeted" : ""}`}
      role="presentation"
    >
      {/* Semi-transparent overlay */}
      <div className="tour-dim" />

      {/* Animated spotlight around target */}
      {targetRect ? (
        <div
          className="tour-spotlight"
          style={{
            left: targetRect.left - 10,
            top: targetRect.top - 10,
            width: targetRect.width + 20,
            height: targetRect.height + 20,
          }}
        />
      ) : null}

      {/* Tour card */}
      <section
        className={`tour-card${targetRect ? " tour-card--floating" : ""} ${animating ? "tour-card--exit" : "tour-card--enter"}`}
        style={cardStyle}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
      >
        {/* Header row: emoji + step counter */}
        <div className="tour-card-header">
          <span className="tour-emoji" aria-hidden="true">{step.emoji}</span>
          <span className="tour-step-count">{stepIndex + 1} / {steps.length}</span>
        </div>

        <h2 id="tour-title" className="tour-card-title">{step.title}</h2>
        <p className="tour-card-body">{renderBody(step.body)}</p>

        {/* Instruction hint when user must click a target */}
        {step.requireClick ? (
          <div className="tour-instruction-box">
            <span className="tour-instruction-icon" aria-hidden="true">
              {missingTarget ? "🔍" : "👆"}
            </span>
            <span className="tour-instruction-text">
              {missingTarget
                ? "Navigate to the correct screen, then click the highlighted element."
                : "Click the highlighted element to continue."}
            </span>
          </div>
        ) : null}

        {/* Progress bar */}
        <div className="tour-progress-bar" aria-hidden="true">
          <div
            className="tour-progress-bar__fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Dot indicators */}
        <div className="tour-dots" aria-hidden="true">
          {steps.map((s, i) => (
            <button
              key={s.title}
              type="button"
              className={`tour-dot${i === stepIndex ? " active" : i < stepIndex ? " done" : ""}`}
              onClick={() => advanceTo(i)}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Action buttons */}
        <div className="tour-actions">
          <button type="button" className="tour-btn-quiet" onClick={disableStartupTour}>
            Don't show again
          </button>
          <div className="tour-actions__right">
            {!isFirst && (
              <button type="button" className="tour-btn-secondary" onClick={goBack}>
                ← Back
              </button>
            )}
            {step.requireClick ? (
              <button type="button" className="tour-btn-secondary" onClick={goNext}>
                Skip →
              </button>
            ) : (
              <button type="button" className="tour-btn-primary" onClick={goNext}>
                {isLast ? "🎉 " : ""}{step.action || "Next →"}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

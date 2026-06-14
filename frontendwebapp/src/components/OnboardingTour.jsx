import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const TOUR_SEEN_KEY = "finledge.tour.seen";
const TOUR_DISABLED_KEY = "finledge.tour.disabled";
const TOUR_PROGRESS_KEY = "finledge.tour.progress";
const OPEN_TOUR_EVENT = "finledge:open-tour";

const steps = [
  {
    title: "Welcome to Finledge",
    body: "This short guide walks you through the real places you will use most. You will click the highlighted controls to continue.",
    action: "Start tour",
  },
  {
    title: "Open Bank",
    body: "Click Bank in the top navigation. This is where income and cost entries begin.",
    target: "[data-tour='nav-bank']",
    routeAfterClick: "/bank",
    requireClick: true,
  },
  {
    title: "Bank amount",
    body: "Click the Amount field. Income stays positive; costs are entered as amounts and saved with the right sign for the category.",
    target: "[data-tour='bank-amount']",
    route: "/bank",
    requireClick: true,
  },
  {
    title: "Open Share",
    body: "Click Share. This area handles IPO, buy, sell, SIP, and dividend entries with different fields for each type.",
    target: "[data-tour='nav-share']",
    routeAfterClick: "/share",
    requireClick: true,
  },
  {
    title: "Choose share entry type",
    body: "Click Entry type. SIP uses installment or redeem amounts, and dividends use either cash amount or bonus share quantity.",
    target: "[data-tour='share-entry-type']",
    route: "/share",
    requireClick: true,
  },
  {
    title: "Review summaries",
    body: "Click Summary to see bank totals, share investment, SIP redemption profit or loss, and overall position together.",
    target: "[data-tour='nav-summary']",
    routeAfterClick: "/summary",
    requireClick: true,
  },
  {
    title: "Settings",
    body: "Click Settings. You can reopen this guide there later and find your local Excel file locations.",
    target: "[data-tour='nav-settings']",
    routeAfterClick: "/settings",
    requireClick: true,
  },
  {
    title: "You are ready",
    body: "The guide is complete. You can restart it from Settings whenever you want a refresher.",
    action: "Finish",
  },
];

function shouldOpenAutomatically() {
  if (typeof window === "undefined") return false;
  return !window.localStorage.getItem(TOUR_SEEN_KEY) && !window.localStorage.getItem(TOUR_DISABLED_KEY);
}

function readSavedProgress() {
  if (typeof window === "undefined") return 0;
  const parsed = Number.parseInt(window.localStorage.getItem(TOUR_PROGRESS_KEY) || "0", 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), steps.length - 1) : 0;
}

function getTargetRect(selector) {
  const element = selector ? document.querySelector(selector) : null;
  if (!element) return { element: null, rect: null };
  return { element, rect: element.getBoundingClientRect() };
}

function OnboardingTour() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [missingTarget, setMissingTarget] = useState(false);

  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  const cardStyle = useMemo(() => {
    if (!targetRect) return undefined;
    const cardWidth = Math.min(420, window.innerWidth - 32);
    const left = Math.min(Math.max(16, targetRect.left), window.innerWidth - cardWidth - 16);
    const preferBelow = targetRect.bottom + 240 < window.innerHeight;
    const top = preferBelow ? targetRect.bottom + 16 : Math.max(16, targetRect.top - 252);
    return { left, top, width: cardWidth };
  }, [targetRect]);

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
      setTargetRect(rect);
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

  useEffect(() => {
    if (!open || !step.requireClick || !step.target) return undefined;

    const handleClick = (event) => {
      const target = event.target?.closest?.(step.target);
      if (!target) return;
      window.setTimeout(() => {
        if (step.routeAfterClick) {
          navigate(step.routeAfterClick);
        }
        setStepIndex((value) => Math.min(value + 1, steps.length - 1));
      }, 80);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [navigate, open, step]);

  if (!open) {
    return null;
  }

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

  const goNext = () => {
    if (isLast) {
      closeTour();
      return;
    }
    setStepIndex((value) => Math.min(value + 1, steps.length - 1));
  };

  return (
    <div className={`tour-layer${targetRect ? " tour-layer--targeted" : ""}`} role="presentation">
      <div className="tour-dim" />
      {targetRect ? (
        <div
          className="tour-spotlight"
          style={{
            left: targetRect.left - 8,
            top: targetRect.top - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      ) : null}

      <section
        className={`tour-card${targetRect ? " tour-card--floating" : ""}`}
        style={cardStyle}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
      >
        <div className="tour-step-count">
          {stepIndex + 1} of {steps.length}
        </div>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.body}</p>
        {step.requireClick ? (
          <p className="tour-instruction">
            {missingTarget ? "Move to the requested screen, then click the highlighted control." : "Click the highlighted control to continue."}
          </p>
        ) : null}

        <div className="tour-progress" aria-hidden="true">
          {steps.map((item, index) => (
            <span key={item.title} className={index <= stepIndex ? "active" : ""} />
          ))}
        </div>

        <div className="tour-actions">
          <button type="button" className="ghost" onClick={disableStartupTour}>
            Do not show automatically
          </button>
          <div className="tour-actions__right">
            <button type="button" className="ghost" disabled={isFirst} onClick={() => setStepIndex((value) => value - 1)}>
              Back
            </button>
            {step.requireClick ? (
              <button type="button" className="ghost" onClick={goNext}>
                Skip step
              </button>
            ) : (
              <button type="button" onClick={goNext}>
                {step.action || "Next"}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export { OPEN_TOUR_EVENT, TOUR_DISABLED_KEY, TOUR_SEEN_KEY };
export default OnboardingTour;

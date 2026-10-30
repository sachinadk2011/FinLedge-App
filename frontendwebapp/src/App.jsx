import { lazy, Suspense, useEffect, useState } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { loadCategoryOptions } from "./constants/options";
import { getApiBase } from "./api/client";

import BankPage from "./pages/BankPage";
// import OnboardingTour from "./components/OnboardingTour"; // disabled for now
import UpdateNotice from "./components/UpdateNotice";
import ShortcutPrompt from "./components/ShortcutPrompt";
import Home from "./pages/Home";
import PersonalFinanceHome from "./pages/PersonalFinanceHome";
import PersonalFinancePage from "./pages/PersonalFinancePage";
import PersonalFinanceTransferPage from "./pages/PersonalFinanceTransferPage";
import SharePage from "./pages/SharePage";

const BankDashboard = lazy(() => import("./pages/BankDashboard"));
const ShareDashboard = lazy(() => import("./pages/ShareDashboard"));
const PersonalFinanceDashboard = lazy(() => import("./pages/PersonalFinanceDashboard"));
const Summary = lazy(() => import("./pages/Summary"));
const Settings = lazy(() => import("./pages/Settings"));

function StartupConnecting() {
  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 px-6">
      <div className="text-center">
        {window.financialTracker ? (
          <img
            src="./finledge-icon.png"
            alt="FinLedge logo"
            className="mx-auto mb-4 h-20 w-20 rounded-2xl object-cover shadow-lg"
          />
        ) : null}
        <h1 className="text-xl font-bold text-slate-900">FinLedge</h1>
        <p className="mt-2 text-sm text-slate-600">Connecting to FinLedge…</p>
      </div>
    </main>
  );
}

function RouteLoading() {
  return <main className="page"><p className="subtitle">Loading…</p></main>;
}

function getRouteLabel(pathname) {
  if (pathname.startsWith("/bank-dashboard")) return "Bank Services Dashboard";
  if (pathname.startsWith("/bank")) return "Bank Services";
  if (pathname.startsWith("/personal-finance-dashboard")) return "Personal Expenses Dashboard";
  if (pathname.startsWith("/personal-finance-transfer")) return "Transfer";
  if (pathname.startsWith("/personal-finance-entry")) return "Personal Expenses Entry";
  if (pathname.startsWith("/personal-finance")) return "Personal Expenses";
  if (pathname.startsWith("/share-dashboard")) return "Share Portfolio Dashboard";
  if (pathname.startsWith("/share")) return "Share Portfolio";
  if (pathname.startsWith("/summary")) return "Financial Summary";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Home";
}

function Layout() {
  const location = useLocation();
  const label = getRouteLabel(location.pathname);

  return (
    <div className="app-shell">
      <UpdateNotice />
      <ShortcutPrompt />
      {/* <OnboardingTour /> */}{/* Tour guide disabled for now — code is ready, will be enabled later */}
      <header className="sticky top-0 z-20 bg-white/70 supports-[backdrop-filter]:bg-white/40 supports-[backdrop-filter]:backdrop-blur-xl border-b border-slate-200/60">
        <div className="app-topbar-inner flex items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-4 xl:px-10 2xl:px-16">
          <div className="brand-cluster">
            <Link className="app-brand-link group flex items-center gap-3 no-underline" to="/">
              <img
                src="./finledge-icon.png"
                alt="FinLedge logo"
                className="h-11 w-11 rounded-[13px] object-cover shadow-soft transition-transform duration-200 group-hover:scale-[1.03]"
              />
              <span className="app-brand-copy grid leading-tight">
                <span className="text-base font-extrabold tracking-tight text-slate-900">FinLedge</span>
                <span className="app-route-label text-sm font-semibold text-slate-500">{label}</span>
              </span>
            </Link>
          </div>

          <nav className="app-main-nav flex items-center justify-end gap-1" aria-label="Main navigation">
            <Link
              className="no-underline rounded-full px-3 py-2 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-white/70 hover:text-slate-900 hover:shadow-soft"
              to="/bank"
              data-tour="nav-bank"
            >
              Bank Services
            </Link>
            <Link
              className="no-underline rounded-full px-3 py-2 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-white/70 hover:text-slate-900 hover:shadow-soft"
              to="/share"
              data-tour="nav-share"
            >
              Share Portfolio
            </Link>
            <Link
              className="no-underline rounded-full px-3 py-2 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-white/70 hover:text-slate-900 hover:shadow-soft"
              to="/personal-finance"
              data-tour="nav-personal-finance"
            >
              Personal Expenses
            </Link>
            <Link
              className="no-underline rounded-full px-3 py-2 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-white/70 hover:text-slate-900 hover:shadow-soft"
              to="/summary"
              data-tour="nav-summary"
            >
              Financial Summary
            </Link>
            <Link
              className="no-underline rounded-full px-3 py-2 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-white/70 hover:text-slate-900 hover:shadow-soft"
              to="/settings"
              data-tour="nav-settings"
            >
              Settings
            </Link>
          </nav>
        </div>
      </header>

      <Outlet />
    </div>
  );
}

function App() {
  const [backendConnected, setBackendConnected] = useState(false);
  const [dataUnavailable, setDataUnavailable] = useState(false);

  useEffect(() => {
    if (window.financialTracker) document.body.classList.add("finledge-desktop");
    else document.body.classList.remove("finledge-desktop");
    return () => document.body.classList.remove("finledge-desktop");
  }, []);

  useEffect(() => {
    let active = true;
    let retryTimer = null;
    let paintFrame = 0;
    const reportFirstPaint = () => {
      if (typeof window.financialTracker?.reportStartupFirstPaint === "function") {
        window.financialTracker.reportStartupFirstPaint();
      }
    };
    paintFrame = requestAnimationFrame(() => {
      paintFrame = requestAnimationFrame(reportFirstPaint);
    });

    const connect = async () => {
      if (typeof window.financialTracker?.getDataLocations === "function") {
        try {
          const locations = await window.financialTracker.getDataLocations();
          if (active && locations?.dataDirError) {
            setDataUnavailable(true);
            return;
          }
        } catch { /* Health polling below remains the source of connection state. */ }
      }

      try {
        const baseUrl = await getApiBase();
        const response = await fetch(`${baseUrl}/health`, { cache: "no-store" });
        if (response.ok) {
          await loadCategoryOptions().catch(() => {});
          if (active) setBackendConnected(true);
          return;
        }
      } catch { /* The backend is still starting. */ }

      if (active) retryTimer = setTimeout(connect, 100);
    };

    connect();
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      cancelAnimationFrame(paintFrame);
    };
  }, []);

  if (!backendConnected && !dataUnavailable) return <StartupConnecting />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/bank" element={<BankPage />} />
        <Route path="/bank-dashboard" element={<Suspense fallback={<RouteLoading />}><BankDashboard /></Suspense>} />
        <Route path="/share" element={<SharePage />} />
        <Route path="/share-dashboard" element={<Suspense fallback={<RouteLoading />}><ShareDashboard /></Suspense>} />
        <Route path="/personal-finance" element={<PersonalFinanceHome />} />
        <Route path="/personal-finance-entry" element={<PersonalFinancePage />} />
        <Route path="/personal-finance-transfer" element={<PersonalFinanceTransferPage />} />
        <Route path="/personal-finance-dashboard" element={<Suspense fallback={<RouteLoading />}><PersonalFinanceDashboard /></Suspense>} />
        <Route path="/summary" element={<Suspense fallback={<RouteLoading />}><Summary /></Suspense>} />
        <Route path="/settings" element={<Suspense fallback={<RouteLoading />}><Settings /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;

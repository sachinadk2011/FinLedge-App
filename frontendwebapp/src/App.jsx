import { Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import BankDashboard from "./pages/BankDashboard";
import BankPage from "./pages/BankPage";
import Home from "./pages/Home";
import ShareDashboard from "./pages/ShareDashboard";
import SharePage from "./pages/SharePage";
import Summary from "./pages/Summary";

function getRouteLabel(pathname) {
  if (pathname.startsWith("/bank-dashboard")) return "Bank Dashboard";
  if (pathname.startsWith("/bank")) return "Bank Module";
  if (pathname.startsWith("/share-dashboard")) return "Share Dashboard";
  if (pathname.startsWith("/share")) return "Share Module";
  if (pathname.startsWith("/summary")) return "Overall Summary";
  return "Home";
}

function Layout() {
  const location = useLocation();
  const label = getRouteLabel(location.pathname);
  const isDesktopShell = typeof window !== "undefined" && window.location.protocol === "file:";

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-20 bg-white/70 supports-[backdrop-filter]:bg-white/40 supports-[backdrop-filter]:backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
          <div className="brand-cluster">
            <Link className="group flex items-center gap-3 no-underline" to="/">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-400 text-sm font-extrabold tracking-tight text-white shadow-soft transition-transform duration-200 group-hover:scale-[1.03]">
                FT
              </span>
              <span className="grid leading-tight">
                <span className="text-base font-extrabold tracking-tight text-slate-900">Financial Tracker</span>
                <span className="text-sm font-semibold text-slate-500">{label}</span>
              </span>
            </Link>

            {isDesktopShell ? (
              <button
                className="refresh-icon-btn"
                type="button"
                title="Refresh app"
                aria-label="Refresh app"
                onClick={() => window.location.reload()}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
              </button>
            ) : null}
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-2 sm:justify-end sm:gap-3">
            <Link
              className="no-underline rounded-full px-4 py-2 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-white/70 hover:text-slate-900 hover:shadow-soft"
              to="/bank"
            >
              Bank
            </Link>
            <Link
              className="no-underline rounded-full px-4 py-2 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-white/70 hover:text-slate-900 hover:shadow-soft"
              to="/share"
            >
              Share
            </Link>
            <Link
              className="no-underline rounded-full px-4 py-2 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-white/70 hover:text-slate-900 hover:shadow-soft"
              to="/summary"
            >
              Summary
            </Link>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/bank" element={<BankPage />} />
        <Route path="/bank-dashboard" element={<BankDashboard />} />
        <Route path="/share" element={<SharePage />} />
        <Route path="/share-dashboard" element={<ShareDashboard />} />
        <Route path="/summary" element={<Summary />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;

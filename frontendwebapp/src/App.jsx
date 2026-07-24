import { Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import BankDashboard from "./pages/BankDashboard";
import BankPage from "./pages/BankPage";
// import OnboardingTour from "./components/OnboardingTour"; // disabled for now
import UpdateNotice from "./components/UpdateNotice";
import Home from "./pages/Home";
import PersonalFinanceDashboard from "./pages/PersonalFinanceDashboard";
import PersonalFinanceHome from "./pages/PersonalFinanceHome";
import PersonalFinancePage from "./pages/PersonalFinancePage";
import Settings from "./pages/Settings";
import ShareDashboard from "./pages/ShareDashboard";
import SharePage from "./pages/SharePage";
import Summary from "./pages/Summary";

function getRouteLabel(pathname) {
  if (pathname.startsWith("/bank-dashboard")) return "Bank Services Dashboard";
  if (pathname.startsWith("/bank")) return "Bank Services";
  if (pathname.startsWith("/personal-finance-dashboard")) return "Personal Finance Dashboard";
  if (pathname.startsWith("/personal-finance-entry")) return "Personal Finance Entry";
  if (pathname.startsWith("/personal-finance")) return "Personal Finance";
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
      {/* <OnboardingTour /> */}{/* Tour guide disabled for now — code is ready, will be enabled later */}
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
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-2 sm:justify-end sm:gap-3">
            <Link
              className="no-underline rounded-full px-4 py-2 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-white/70 hover:text-slate-900 hover:shadow-soft"
              to="/bank"
              data-tour="nav-bank"
            >
              Bank Services
            </Link>
            <Link
              className="no-underline rounded-full px-4 py-2 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-white/70 hover:text-slate-900 hover:shadow-soft"
              to="/share"
              data-tour="nav-share"
            >
              Share Portfolio
            </Link>
            <Link
              className="no-underline rounded-full px-4 py-2 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-white/70 hover:text-slate-900 hover:shadow-soft"
              to="/personal-finance"
              data-tour="nav-personal-finance"
            >
              Personal Finance
            </Link>
            <Link
              className="no-underline rounded-full px-4 py-2 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-white/70 hover:text-slate-900 hover:shadow-soft"
              to="/summary"
              data-tour="nav-summary"
            >
              Financial Summary
            </Link>
            <Link
              className="no-underline rounded-full px-4 py-2 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-white/70 hover:text-slate-900 hover:shadow-soft"
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
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/bank" element={<BankPage />} />
        <Route path="/bank-dashboard" element={<BankDashboard />} />
        <Route path="/share" element={<SharePage />} />
        <Route path="/share-dashboard" element={<ShareDashboard />} />
        <Route path="/personal-finance" element={<PersonalFinanceHome />} />
        <Route path="/personal-finance-entry" element={<PersonalFinancePage />} />
        <Route path="/personal-finance-dashboard" element={<PersonalFinanceDashboard />} />
        <Route path="/summary" element={<Summary />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;

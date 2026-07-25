import { Link } from "react-router-dom";

function IconBank() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2 2 7v2h20V7L12 2Zm-8 9v9h3v-9H4Zm5 0v9h3v-9H9Zm5 0v9h3v-9h-3Zm5 0v9h3v-9h-3ZM2 22v-2h20v2H2Z"
      />
    </svg>
  );
}

function IconShare() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17 2a3 3 0 1 1-2.83 4H9.83a3 3 0 0 1 0 2h4.34a3 3 0 1 1 0 2H9.83a3 3 0 0 1 0 2h4.34A3 3 0 1 1 17 22a3 3 0 0 1-2.83-4H9.83a3 3 0 1 1 0-4h4.34a3 3 0 1 1 0-2H9.83a3 3 0 1 1 0-4h4.34A3 3 0 0 1 17 2Z"
      />
    </svg>
  );
}

function IconSummary() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 3h16a1 1 0 0 1 1 1v16h-2V5H5v16H3V4a1 1 0 0 1 1-1Zm4 6h10v2H8V9Zm0 4h10v2H8v-2Zm0 4h7v2H8v-2Z"
      />
    </svg>
  );
}

function IconPersonalFinance() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 4v3h10V7H7Zm0 5v2h4v-2H7Zm6 0v2h4v-2h-4Zm-6 4v2h4v-2H7Zm6 0v2h4v-2h-4Z"
      />
    </svg>
  );
}

function Home() {
  return (
    <main className="min-h-[calc(100vh-84px)] px-4 py-14 sm:px-6">
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center gap-10">
        <header className="w-full max-w-3xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-600">Financial Tracker</p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl">
            Keep your money story tidy
          </h1>
          <p className="mt-4 text-base font-medium leading-relaxed text-slate-700 md:text-lg">
            Track bank services, share portfolio activity, everyday personal expenses, and your financial summary with clean dashboards.
          </p>
        </header>

        <div className="grid w-full gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/bank"
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 to-teal-500 p-[1px] shadow-soft transition duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 no-underline"
          >
            <div className="flex h-full flex-col items-center rounded-3xl bg-white/80 p-6 text-center sm:p-7 md:supports-[backdrop-filter]:bg-white/65 md:supports-[backdrop-filter]:backdrop-blur">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-800 transition group-hover:scale-[1.06]">
                <IconBank />
              </span>
              <div className="mt-5 text-xl font-extrabold tracking-tight text-slate-900">Bank Services</div>
              <div className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                Track interest earned, charges, and renewals
              </div>
            </div>
          </Link>

          <Link
            to="/share"
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 to-sky-500 p-[1px] shadow-soft transition duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 no-underline"
          >
            <div className="flex h-full flex-col items-center rounded-3xl bg-white/80 p-6 text-center sm:p-7 md:supports-[backdrop-filter]:bg-white/65 md:supports-[backdrop-filter]:backdrop-blur">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-100 text-sky-800 transition group-hover:scale-[1.06]">
                <IconShare />
              </span>
              <div className="mt-5 text-xl font-extrabold tracking-tight text-slate-900">Share Portfolio</div>
              <div className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">Track IPO, SIP, trades, and dividends</div>
            </div>
          </Link>

          <Link
            to="/personal-finance"
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-700 to-amber-500 p-[1px] shadow-soft transition duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 no-underline"
          >
            <div className="flex h-full flex-col items-center rounded-3xl bg-white/80 p-6 text-center sm:p-7 md:supports-[backdrop-filter]:bg-white/65 md:supports-[backdrop-filter]:backdrop-blur">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-800 transition group-hover:scale-[1.06]">
                <IconPersonalFinance />
              </span>
              <div className="mt-5 text-xl font-extrabold tracking-tight text-slate-900">Personal Expenses</div>
              <div className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                Track everyday bank and cash flow
              </div>
            </div>
          </Link>

          <Link
            to="/summary"
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-700 to-teal-500 p-[1px] shadow-soft transition duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 no-underline"
          >
            <div className="flex h-full flex-col items-center rounded-3xl bg-white/80 p-6 text-center sm:p-7 md:supports-[backdrop-filter]:bg-white/65 md:supports-[backdrop-filter]:backdrop-blur">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-200/70 text-slate-800 transition group-hover:scale-[1.06]">
                <IconSummary />
              </span>
              <div className="mt-5 text-xl font-extrabold tracking-tight text-slate-900">Financial Summary</div>
              <div className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">View your overall financial position</div>
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}

export default Home;

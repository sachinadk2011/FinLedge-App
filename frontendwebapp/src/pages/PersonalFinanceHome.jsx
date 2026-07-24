import { Link } from "react-router-dom";

function IconBankFlow() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2 3 6.5V9h18V6.5L12 2ZM5 11v8h3v-8H5Zm5.5 0v8h3v-8h-3ZM16 11v8h3v-8h-3ZM3 22v-2h18v2H3Z"
      />
    </svg>
  );
}

function IconCashFlow() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm3 2v8h12V8H6Zm6 1.5A2.5 2.5 0 1 0 12 14a2.5 2.5 0 0 0 0-4.5ZM7 10h2v2H7v-2Zm8 2h2v2h-2v-2Z"
      />
    </svg>
  );
}

function IconCombined() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 19V5h2v14H4Zm4 0v-8h2v8H8Zm4 0V7h2v12h-2Zm4 0v-5h2v5h-2Zm4 2H2v-2h18v2Z"
      />
    </svg>
  );
}

function PersonalFinanceHome() {
  return (
    <main className="min-h-[calc(100vh-84px)] px-4 py-14 sm:px-6">
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center gap-10">
        <header className="w-full max-w-3xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-600">Personal Finance</p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl">
            Track everyday money flow
          </h1>
          <p className="mt-4 text-base font-medium leading-relaxed text-slate-700 md:text-lg">
            Keep bank spending, cash spending, and your combined savings picture separate from Bank Services and Share Portfolio.
          </p>
        </header>

        <div className="grid w-full gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/personal-finance-entry?flow=bank"
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 to-teal-500 p-[1px] shadow-soft transition duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 no-underline"
          >
            <div className="flex h-full flex-col items-center rounded-3xl bg-white/80 p-6 text-center sm:p-7 md:supports-[backdrop-filter]:bg-white/65 md:supports-[backdrop-filter]:backdrop-blur">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-800 transition group-hover:scale-[1.06]">
                <IconBankFlow />
              </span>
              <div className="mt-5 text-xl font-extrabold tracking-tight text-slate-900">Bank Flow</div>
              <div className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                Add everyday bank income and expenses
              </div>
            </div>
          </Link>

          <Link
            to="/personal-finance-entry?flow=cash"
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-700 to-rose-500 p-[1px] shadow-soft transition duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 no-underline"
          >
            <div className="flex h-full flex-col items-center rounded-3xl bg-white/80 p-6 text-center sm:p-7 md:supports-[backdrop-filter]:bg-white/65 md:supports-[backdrop-filter]:backdrop-blur">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-800 transition group-hover:scale-[1.06]">
                <IconCashFlow />
              </span>
              <div className="mt-5 text-xl font-extrabold tracking-tight text-slate-900">Cash Flow</div>
              <div className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                Add everyday cash income and expenses
              </div>
            </div>
          </Link>

          <Link
            to="/personal-finance-dashboard?view=combined"
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 to-sky-500 p-[1px] shadow-soft transition duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 no-underline"
          >
            <div className="flex h-full flex-col items-center rounded-3xl bg-white/80 p-6 text-center sm:p-7 md:supports-[backdrop-filter]:bg-white/65 md:supports-[backdrop-filter]:backdrop-blur">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-100 text-sky-800 transition group-hover:scale-[1.06]">
                <IconCombined />
              </span>
              <div className="mt-5 text-xl font-extrabold tracking-tight text-slate-900">Combined Overview</div>
              <div className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                View bank and cash totals together
              </div>
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}

export default PersonalFinanceHome;

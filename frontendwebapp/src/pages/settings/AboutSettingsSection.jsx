export default function AboutSettingsSection({
  appVersion,
  bridge
}) {
  return <section className="card settings-panel settings-panel--scrollable">
          <h3>About FinLedge</h3>
          <div className="settings-panel-scroll-content">

          <p className="subtitle">
            FinLedge is an offline-first personal financial operating system. It keeps all of
            your financial data on your own device in plain Excel files — no cloud account, no
            internet connection, and no data sent anywhere.
          </p>

          <h4>Modules</h4>

          <p className="subtitle">
            <strong>Bank Services</strong> — Answers one question: is my bank account itself
            worth it? Track interest earned against charges like mobile banking fees, debit
            card charges, locker costs, and renewal fees. If your bank is quietly draining
            money, Bank Services will show you.
          </p>
          <p className="subtitle">
            <strong>Share Portfolio</strong> — Track every stage of your market investments:
            IPO applications, secondary market buys and sells, dividend income (cash and
            bonus), and SIP installments and redemptions. Profit and loss is calculated
            automatically using FIFO lot matching.
          </p>
          <p className="subtitle">
            <strong>Personal Expenses</strong> — Your everyday income and expenses, split into
            two flows. <em>Bank Flow</em> tracks money moving through your bank accounts.
            <em> Cash Flow</em> tracks cash-in-hand spending that never touches a bank
            statement. The <em>Combined Overview</em> merges both into a single view so you
            can see your full financial picture.
          </p>
          <p className="subtitle">
            <strong>Financial Summary</strong> — A read-only analytics page that pulls data
            from Bank Services, Share Portfolio, and Personal Expenses together. View your
            overall financial position without entering any data here.
          </p>

          <h4>How Bank Flow's live sync works</h4>

          <p className="subtitle">
            When you record a transaction in Share Portfolio, a read-only entry automatically
            appears in Personal Expenses &gt; Bank Flow — you never need to enter the same
            thing twice. Here is what shows up:
          </p>
          <p className="subtitle">
            <strong>Investment Expense:</strong> IPO applications, secondary market buys, and
            SIP installment payments.<br />
            <strong>Investment Income:</strong> Share sells, cash dividend payments, and SIP
            redemptions.<br />
            <strong>Bonus dividends</strong> do not create a Bank Flow entry because no money
            changes hands.
          </p>
          <p className="subtitle">
            Bank Services rows also appear in Bank Flow automatically: Interest Earned shows
            as income, and every other Bank Services category shows as a service cost. These
            synced entries are read-only in Personal Expenses — edit or delete them in their
            original module and the change is reflected immediately.
          </p>

          <h4>Where your data lives</h4>

          <p className="subtitle">
            Every FinLedge module stores its data in a separate Excel workbook on your own
            device. Bank Services uses <code>bank_transactions.xlsx</code>, Share Portfolio
            uses <code>share_transactions.xlsx</code>, and Personal Expenses uses
            <code> personal_finance_bank_flow.xlsx</code> and
            <code> personal_finance_cash_flow.xlsx</code>. Nothing is sent to a server,
            synced to the cloud, or shared with any third party.
          </p>

          <h4>Version</h4>
          <div className="settings-version-row">
            <span>Current version</span>
            <strong>{appVersion || (bridge ? "Loading..." : "Web preview")}</strong>
          </div>
          </div>
        </section>;
}

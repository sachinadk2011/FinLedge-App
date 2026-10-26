export default function HowToUseSettingsSection({}) {
  return <section className="card settings-panel">
          <h3>How to use FinLedge</h3>

          <p className="subtitle">
            Every module follows the same four-step pattern:
          </p>
          <ol className="subtitle" style={{
      paddingLeft: "1.2em",
      margin: "0 0 1em"
    }}>
            <li>Open a module from the top navigation bar.</li>
            <li>Fill in the entry form and click <strong>Add Bank Service Entry</strong>, <strong>Add Share Entry</strong>, or <strong>Add Personal Expenses Entry</strong> — the button label changes depending on the module.</li>
            <li>Review the new row in the <strong>Recent transactions</strong> table below the form. Use the edit or delete icons on any row to correct a mistake.</li>
            <li>Click <strong>View dashboard</strong> (top-right of the page) to see charts and totals for the module.</li>
          </ol>

          <h4>Adding a Bank Services entry</h4>
          <ol className="subtitle" style={{
      paddingLeft: "1.2em",
      margin: "0 0 1em"
    }}>
            <li>Go to <strong>Bank Services</strong> in the top nav.</li>
            <li>Pick a <strong>Category</strong> from the dropdown (e.g. Interest Earned, Mobile Banking Charge, Locker).</li>
            <li>Enter the <strong>Amount</strong> as a plain positive number — the app determines whether it is a credit or debit from the category.</li>
            <li>Add an optional <strong>Description</strong>, then click <strong>Add Bank Service Entry</strong>.</li>
          </ol>

          <h4>Adding a Share Portfolio entry</h4>
          <ol className="subtitle" style={{
      paddingLeft: "1.2em",
      margin: "0 0 1em"
    }}>
            <li>Go to <strong>Share Portfolio</strong> in the top nav.</li>
            <li>Choose a transaction type: IPO, Buy, Sell, Dividend, Bonus, or SIP.</li>
            <li>Fill in Share Name, Per Unit Price, quantity (Allotted / Units), and the ASBA or exchange charge where applicable.</li>
            <li>Click <strong>Add Share Entry</strong>. Profit/loss and cumulative profit are calculated automatically.</li>
          </ol>

          <h4>Adding a Personal Expenses entry (Bank Flow or Cash Flow)</h4>
          <ol className="subtitle" style={{
      paddingLeft: "1.2em",
      margin: "0 0 1em"
    }}>
            <li>Go to <strong>Personal Expenses</strong> in the top nav. You will see three cards: <strong>Bank Flow</strong>, <strong>Cash Flow</strong>, and <strong>Combined Overview</strong>.</li>
            <li>Click <strong>Bank Flow</strong> to record money that moved through a bank account, or <strong>Cash Flow</strong> to record cash-in-hand spending.</li>
            <li>Choose a <strong>Direction</strong> (Income or Expense) and select the matching <strong>Category</strong>.</li>
            <li>Enter the <strong>Amount</strong> and an optional <strong>Description</strong>, then click <strong>Add Personal Expenses Entry</strong>.</li>
          </ol>
          <p className="subtitle">
            <strong>Note:</strong> Bank Flow also shows read-only rows synced from Share Portfolio and Bank Services. You cannot add, edit, or delete those rows here — see the FAQ below.
          </p>

          <h4>Reading the dashboards</h4>

          <p className="subtitle">
            <strong>Bank Services dashboard</strong> — three stat cards:<br />
            <strong>Interest earned</strong> = total interest credited to your account.<br />
            <strong>Total charges</strong> = sum of all fees and service costs.<br />
            <strong>Net balance</strong> = Interest earned minus Total charges. Positive means the bank is paying you more than it is charging you.
          </p>
          <p className="subtitle">
            <strong>Share Portfolio dashboard</strong> — key stat cards:<br />
            <strong>Total IPO investment</strong> and <strong>Secondary buy amount</strong> = money put in.<br />
            <strong>Total sell amount</strong> = proceeds from selling shares.<br />
            <strong>Realized trading profit</strong> = profit/loss on closed trades (sell minus FIFO cost).<br />
            <strong>Total dividend</strong> = all cash dividends received.<br />
            <strong>SIP investment / SIP redeemed / SIP profit/loss</strong> = SIP-specific tracking.<br />
            <strong>Grand total investment</strong> and <strong>Grand total profit/loss</strong> = across IPO, secondary, and SIP combined.
          </p>
          <p className="subtitle">
            <strong>Bank Flow dashboard</strong> — key stat cards:<br />
            <strong>Income</strong> = manual bank income entries.<br />
            <strong>Expense</strong> = manual bank expense entries.<br />
            <strong>Investment expense</strong> = IPO / Buy / SIP installments synced from Share Portfolio.<br />
            <strong>Investment income</strong> = Sell / Cash dividend / SIP redemption synced from Share Portfolio.<br />
            <strong>Interest earned</strong> and <strong>Service cost</strong> = synced from Bank Services.<br />
            <strong>Total income</strong>, <strong>Total expense</strong>, and <strong>Net profit/loss</strong> = the full picture across manual and synced entries.
          </p>
          <p className="subtitle">
            <strong>Cash Flow dashboard</strong> — three stat cards: <strong>Income</strong>, <strong>Expense</strong>, and <strong>Net profit/loss</strong> for cash-only entries.
          </p>
          <p className="subtitle">
            <strong>Combined Overview dashboard</strong> — five stat cards: <strong>Overall income</strong>, <strong>Overall expenses</strong>, <strong>Overall net/savings</strong>, <strong>Bank net</strong>, and <strong>Cash net</strong>.
          </p>

          <h4>Using Import and Export</h4>

          <p className="subtitle">
            Open <em>Settings → Import/Export</em>.
          </p>
          <p className="subtitle">
            <strong>To export one file:</strong> click <strong>Export Bank Services</strong>, <strong>Export Share Portfolio</strong>, <strong>Export Personal Expenses — Bank Flow</strong>, or <strong>Export Personal Expenses — Cash Flow</strong>. A save-dialog opens so you can choose where to save it.
          </p>
          <p className="subtitle">
            <strong>To export all files at once:</strong> click <strong>Export all data files (.zip)</strong>. You get a single zip containing all four workbooks.
          </p>
          <p className="subtitle">
            <strong>To import a file:</strong> choose a <strong>Data type</strong>, pick an <strong>Excel file</strong>, and click <strong>Import file</strong>. The Required columns listed below the dropdown show the minimum columns your file must contain. Existing timestamps are preserved; missing timestamps are filled in automatically. Older <strong>Timestamp</strong> columns are accepted. For Bank/Cash Transfers, use <strong>Date</strong>, <strong>Transfer Direction</strong> (or <strong>Direction</strong>), and <strong>Amount</strong>. If you already have data, you will be asked whether to <strong>Replace</strong> (discard existing) or <strong>Merge</strong> (keep existing and append imported rows). The existing workbook is always backed up before any change is made.
          </p>

          <h4>Frequently asked questions</h4>

          <p className="subtitle">
            <strong>Why does a Bank Flow entry appear that I did not add?</strong><br />
            Bank Flow includes read-only rows synced live from Share Portfolio and Bank Services — you never need to enter the same transaction twice. To edit or delete one of those rows, go to the module where it was originally recorded and make the change there. The Bank Flow view updates immediately.
          </p>
          <p className="subtitle">
            <strong>What happens to my data when I upgrade FinLedge?</strong><br />
            A one-time migration runs automatically on startup when the app detects an older data format. Your original files are backed up first. If anything looks wrong, open <em>Settings → General</em> to find the data folder and check the backup inside it.
          </p>
          <p className="subtitle">
            <strong>Does FinLedge send my data anywhere?</strong><br />
            No. All data stays in Excel files on your device. The only network request FinLedge makes is a version check when you open Settings.
          </p>
        </section>;
}

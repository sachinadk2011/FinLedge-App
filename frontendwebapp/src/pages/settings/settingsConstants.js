export const SETTINGS_SECTIONS = [
  { id: "general", label: "General" },
  { id: "investment", label: "Investment" },
  { id: "import-export", label: "Import/Export" },
  { id: "backup", label: "Backup" },
  { id: "about", label: "About" },
  { id: "how-to-use", label: "How To Use" },
  { id: "privacy", label: "Privacy" },
  { id: "version", label: "Version" },
];

export const GENERAL_FILE_ROWS = [
  {
    label: "Data folder",
    pathKey: "dataDir",
    target: "folder",
    actionLabel: "Open folder",
    fallback: "Desktop app only",
  },
  {
    label: "Bank Services",
    pathKey: "bankFile",
    target: "bank",
    actionLabel: "Open",
    fallback: "bank_transactions.xlsx",
  },
  {
    label: "Share Portfolio",
    pathKey: "shareFile",
    target: "share",
    actionLabel: "Open",
    fallback: "share_transactions.xlsx",
  },
  {
    label: "Personal Expenses — Bank Flow",
    pathKey: "personalFinanceBankFile",
    target: "pf-bank",
    actionLabel: "Open",
    fallback: "personal_finance_bank_flow.xlsx",
  },
  {
    label: "Personal Expenses — Cash Flow",
    pathKey: "personalFinanceCashFile",
    target: "pf-cash",
    actionLabel: "Open",
    fallback: "personal_finance_cash_flow.xlsx",
  },
  {
    label: "Personal Expenses - Bank/Cash Transfers",
    pathKey: "personalFinanceTransferFile",
    target: "pf-transfer",
    actionLabel: "Open",
    fallback: "personal_finance_transfer.xlsx",
  },
];

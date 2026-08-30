import { recomputeShareRecords, type ShareRecord } from "../../services/share-fifo-lot-matching.js";
import type { PersonalFinanceRecord } from "../../services/personal-finance-sync-row-computation.js";

export const bankRecords = [
  { id: 1, date: "2026-08-01", category: "Interest Earned", amount: 820, description: "Savings", timestamp: "2026-08-01T09:00:00" },
  { id: 2, date: "2026-08-04", category: "Mobile Banking Charge", amount: -25, description: "Monthly", timestamp: "2026-08-04T09:00:00" },
  { id: 3, date: "2026-08-10", category: "Demat Renewal", amount: -150, description: "Renewal", timestamp: "2026-08-10T09:00:00" },
];

export const shareRecords: ShareRecord[] = recomputeShareRecords([
  { id: 1, date: "2026-08-03", share_name: "NABIL", category: "ipo", per_unit_price: 100, allotted: 10, buy_sell: "ipo", timestamp: "2026-08-03T10:00:00" },
  { id: 2, date: "2026-08-06", share_name: "NABIL", category: "sell", per_unit_price: 160, allotted: 4, buy_sell: "sell", timestamp: "2026-08-06T10:00:00" },
  { id: 3, date: "2026-08-07", share_name: "NIBL", category: "sip", per_unit_price: 1000, total_amount: 1000, allotted: 20, buy_sell: "installment", timestamp: "2026-08-07T10:00:00" },
]);

export const manualExpenseRows: PersonalFinanceRecord[] = [
  { id: 1, display_id: "C-1", date: "2026-08-20", flow_type: "cash", direction: "expense", category: "Food", amount: 560, signed_amount: -560, description: "Grocery top-up", source: "manual", timestamp: "2026-08-20T18:00:00" },
  { id: 2, display_id: "B-2", date: "2026-08-01", flow_type: "bank", direction: "income", category: "Salary", amount: 45000, signed_amount: 45000, description: "Salary", source: "manual", timestamp: "2026-08-01T08:00:00" },
  { id: 3, display_id: "C-3", date: "2026-08-18", flow_type: "cash", direction: "expense", category: "Entertainment", amount: 900, signed_amount: -900, description: "Movie night", source: "manual", timestamp: "2026-08-18T20:00:00" },
];

export const transferRows = [
  { id: 1, date: "2026-08-22", from_flow: "cash", to_flow: "bank", amount: 2000, description: "Deposit" },
];


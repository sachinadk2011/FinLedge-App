export type ScreenId =
  | "home"
  | "bank-add"
  | "bank-dash"
  | "shares-add"
  | "shares-dash"
  | "expenses-add"
  | "expenses-dash"
  | "transfer"
  | "summary"
  | "settings"
  | "settings-profile"
  | "settings-import-export"
  | "settings-investment"
  | "settings-backup-sync"
  | "settings-privacy"
  | "settings-about"
  | "settings-how-to-use"
  | "settings-version";

export type ChartRange = "week" | "month" | "year" | "custom";

export type Totals = {
  income: number;
  expense: number;
  net: number;
};

export type ChartBucket = {
  label: string;
  key: string;
  income: number;
  expense: number;
  net: number;
};

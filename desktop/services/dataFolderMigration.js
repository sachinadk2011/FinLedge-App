"use strict";

const fs = require("fs");
const path = require("path");

const DATA_FOLDER_NAME = "FinLedge Data";
const WORKBOOKS = {
  "bank_transactions.xlsx": ["bank_transactions.xlsx", "bank.xlsx"],
  "share_transactions.xlsx": ["share_transactions.xlsx", "share.xlsx"],
  "personal_finance_bank_flow.xlsx": ["personal_finance_bank_flow.xlsx"],
  "personal_finance_cash_flow.xlsx": ["personal_finance_cash_flow.xlsx"],
  "personal_finance_transfer.xlsx": ["personal_finance_transfer.xlsx"],
};
const WORKBOOK_NAMES = Object.keys(WORKBOOKS);

function getSharedDataDirectory(rootDirectory) {
  return path.join(path.resolve(rootDirectory), DATA_FOLDER_NAME);
}

function getBackupDirectoryForDataFolder(dataDirectory) {
  const resolved = path.resolve(dataDirectory);
  return path.basename(resolved).toLowerCase() === DATA_FOLDER_NAME.toLowerCase()
    ? path.join(path.dirname(resolved), "backups")
    : path.join(resolved, "backups");
}

function migrationTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const hour24 = date.getHours();
  const hour12 = hour24 % 12 || 12;
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} - ${pad(hour12)}-${pad(date.getMinutes())}-${pad(date.getSeconds())} ${meridiem} - Data Folder Migration`;
}

function hasKnownWorkbooks(directory, fileSystem = fs) {
  const root = path.resolve(directory);
  return Object.values(WORKBOOKS).flat().some((name) => fileSystem.existsSync(path.join(root, name)));
}

module.exports = {
  DATA_FOLDER_NAME,
  WORKBOOK_NAMES,
  getBackupDirectoryForDataFolder,
  getSharedDataDirectory,
  hasKnownWorkbooks,
  migrationTimestamp,
};

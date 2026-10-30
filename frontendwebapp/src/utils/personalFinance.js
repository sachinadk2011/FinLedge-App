import { destinationFlow, normalizeTransferDirection, transferFlowLabel } from "../constants/transferDirections";

export function getSourceLabel(source) {
  return source === "transfer" ? "Transfer" : "Manual";
}

export function getDirectionLabel(record) {
  if (record.source === "transfer") return "Transfer";
  return record.direction === "income" ? "Income" : "Expense";
}

export function addTransferReceivers(records) {
  const receiverRecords = records.flatMap((record) => {
    if (record.source !== "transfer") return [];
    const direction = normalizeTransferDirection(record.transfer_direction);
    if (!direction) return [];
    const receiverFlow = destinationFlow(direction);
    return [{
      ...record,
      flow_type: receiverFlow,
      signed_amount: Math.abs(Number(record.amount || 0)),
      description: transferFlowLabel(direction, receiverFlow),
    }];
  });
  return [...records, ...receiverRecords];
}

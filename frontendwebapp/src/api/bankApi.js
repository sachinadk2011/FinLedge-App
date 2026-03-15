import { deleteJson, getJson, postJson, putJson } from "./client";

function buildBankPayload(form) {
  const amountValue = Number(form.amount);
  const normalizedAmount = form.category === "income" ? Math.abs(amountValue) : -Math.abs(amountValue);

  return {
    category: form.category,
    amount: normalizedAmount,
    description: form.description?.trim() || undefined,
  };
}

export function addBankEntry(form) {
  const payload = buildBankPayload(form);
  if (form.dates) payload.dates = form.dates;
  return postJson("/bank/add", payload);
}

export function updateBankEntry(recordId, form) {
  const payload = buildBankPayload(form);
  if (form.dates) payload.dates = form.dates;
  return putJson(`/bank/update/${recordId}`, payload);
}

export function getBankData() {
  return getJson("/bank/data");
}

export function deleteBankRecord(recordId) {
  return deleteJson(`/bank/delete/${recordId}`);
}

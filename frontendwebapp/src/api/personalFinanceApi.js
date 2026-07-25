import { deleteJson, getJson, postJson, putJson } from "./client";

function buildPersonalFinancePayload(form) {
  return {
    flow_type: form.flow_type,
    direction: form.direction,
    category: form.category,
    amount: Math.abs(Number(form.amount)),
    description: form.description?.trim() || undefined,
    source: form.source || "manual",
  };
}

export function addPersonalFinanceEntry(form) {
  const payload = buildPersonalFinancePayload(form);
  if (form.dates) payload.dates = form.dates;
  return postJson("/personal-finance/add", payload);
}

export function updatePersonalFinanceEntry(recordId, recordFlowType, form) {
  const payload = buildPersonalFinancePayload(form);
  if (form.dates) payload.dates = form.dates;
  return putJson(`/personal-finance/update/${recordFlowType}/${recordId}`, payload);
}

export function getPersonalFinanceData(flowType) {
  const query = flowType ? `?flow_type=${encodeURIComponent(flowType)}` : "";
  return getJson(`/personal-finance/data${query}`);
}

export function deletePersonalFinanceRecord(recordId, flowType) {
  return deleteJson(`/personal-finance/delete/${flowType}/${recordId}`);
}

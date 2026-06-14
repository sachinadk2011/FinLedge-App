import { deleteJson, getJson, postJson, putJson } from "./client";

function firstFilledValue(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) {
      return text;
    }
  }
  return "";
}

export function addShareEntry(form) {
  const category = String(form.category || "").trim().toLowerCase();
  const perUnitPriceRaw = String(form.per_unit_price ?? "").trim();
  const amountRaw = firstFilledValue(form.amount, form.total_amount, form.per_unit_price);
  const perUnitPrice = Number.parseFloat(perUnitPriceRaw);
  const amount = Number.parseFloat(amountRaw);
  const allotted = Number.parseInt(form.allotted, 10);
  const bonusShares = Number.parseInt(form.bonus_shares ?? form.allotted, 10);
  const dividendType = String(form.buy_sell || form._dividendType || "").trim().toLowerCase();
  const sipType = String(form.buy_sell || form._sipType || "installment").trim().toLowerCase();

  if (category === "dividend") {
    if (!["cash", "bonus"].includes(dividendType)) {
      throw new Error("Dividend type must be cash or bonus.");
    }
    if (dividendType === "cash" && (!Number.isFinite(amount) || amount < 0)) {
      throw new Error("Cash dividend amount must be a valid number.");
    }
    if (dividendType === "bonus" && (!Number.isFinite(bonusShares) || bonusShares <= 0)) {
      throw new Error("Bonus dividend must have a positive share quantity.");
    }
  } else if (category === "sip") {
    if (!["installment", "redeem"].includes(sipType)) {
      throw new Error("SIP type must be installment or redeem.");
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("SIP amount must be positive.");
    }
  } else {
    if (!Number.isFinite(perUnitPrice)) {
      throw new Error("Per unit price must be a valid number.");
    }
    if (!Number.isFinite(allotted) || allotted < 0) {
      throw new Error("Allotted must be 0 or greater.");
    }
    if (category !== "ipo" && allotted <= 0) {
      throw new Error("Allotted must be a positive integer for buy/sell entries.");
    }
  }

  const payload = {
    share_name: String(form.share_name || "").trim(),
    category,
  };

  if (category === "sip") {
    payload.total_amount = amountRaw;
    payload.buy_sell = sipType;
  } else if (category === "dividend") {
    payload.buy_sell = dividendType;
    if (dividendType === "cash") {
      payload.amount = amountRaw;
    } else {
      payload.bonus_shares = bonusShares;
    }
  } else {
    payload.per_unit_price = perUnitPriceRaw;
    payload.allotted = allotted;
    payload.buy_sell = String(form.buy_sell || form.category || "").trim().toLowerCase();
  }

  if (form.dates) {
    payload.dates = form.dates;
  }

  console.log("[shareApi] POST /share/add payload", payload);
  return postJson("/share/add", payload);
}

export function getShareData() {
  return getJson("/share/data");
}

export function updateShareAllotment(payload) {
  console.log("[shareApi] PUT /share/update-allotment payload", payload);
  return putJson("/share/update-allotment", payload);
}

export function updateSipAllotment(payload) {
  console.log("[shareApi] PUT /share/update-sip-allotment payload", payload);
  return putJson("/share/update-sip-allotment", payload);
}

export function updateShareEntry(recordId, form) {
  const category = String(form.category || "").trim().toLowerCase();
  const perUnitPriceRaw = String(form.per_unit_price ?? "").trim();
  const amountRaw = firstFilledValue(form.amount, form.total_amount, form.per_unit_price);
  const perUnitPrice = Number.parseFloat(perUnitPriceRaw);
  const amount = Number.parseFloat(amountRaw);
  const allotted = Number.parseInt(form.allotted, 10);
  const bonusShares = Number.parseInt(form.bonus_shares ?? form.allotted, 10);
  const dividendType = String(form.buy_sell || form._dividendType || "").trim().toLowerCase();
  const sipType = String(form.buy_sell || form._sipType || "installment").trim().toLowerCase();

  if (category === "dividend") {
    if (!["cash", "bonus"].includes(dividendType)) {
      throw new Error("Dividend type must be cash or bonus.");
    }
    if (dividendType === "cash" && (!Number.isFinite(amount) || amount < 0)) {
      throw new Error("Cash dividend amount must be a valid number.");
    }
    if (dividendType === "bonus" && (!Number.isFinite(bonusShares) || bonusShares <= 0)) {
      throw new Error("Bonus dividend must have a positive share quantity.");
    }
  } else if (category === "sip") {
    if (!["installment", "redeem"].includes(sipType)) {
      throw new Error("SIP type must be installment or redeem.");
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("SIP amount must be positive.");
    }
  } else {
    if (!Number.isFinite(perUnitPrice)) {
      throw new Error("Per unit price must be a valid number.");
    }
    if (!Number.isFinite(allotted) || allotted < 0) {
      throw new Error("Allotted must be 0 or greater.");
    }
    if (category !== "ipo" && allotted <= 0) {
      throw new Error("Allotted must be a positive integer for buy/sell entries.");
    }
  }

  const payload = {
    share_name: String(form.share_name || "").trim(),
    category,
  };

  if (category === "sip") {
    payload.total_amount = amountRaw;
    payload.buy_sell = sipType;
  } else if (category === "dividend") {
    payload.buy_sell = dividendType;
    if (dividendType === "cash") {
      payload.amount = amountRaw;
    } else {
      payload.bonus_shares = bonusShares;
    }
  } else {
    payload.per_unit_price = perUnitPriceRaw;
    payload.allotted = allotted;
    payload.buy_sell = String(form.buy_sell || form.category || "").trim().toLowerCase();
  }

  if (form.dates) {
    payload.dates = form.dates;
  }

  console.log("[shareApi] PUT /share/update payload", { recordId, payload });
  return putJson(`/share/update/${recordId}`, payload);
}

export function deleteShareRecord(recordId) {
  return deleteJson(`/share/delete/${recordId}`);
}

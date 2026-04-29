import { deleteJson, getJson, postJson, putJson } from "./client";

export function addShareEntry(form) {
  const perUnitPriceRaw = String(form.per_unit_price ?? "").trim();
  const perUnitPrice = Number.parseFloat(perUnitPriceRaw);
  const allotted = Number.parseInt(form.allotted, 10);
  const category = String(form.category || "").trim().toLowerCase();
  const dividendType = String(form.buy_sell || form._dividendType || "").trim().toLowerCase();

  if (!Number.isFinite(perUnitPrice)) {
    throw new Error("Per unit price must be a valid number.");
  }

  if (!Number.isFinite(allotted) || allotted < 0) {
    throw new Error("Allotted must be 0 or greater.");
  }

  if (category === "dividend") {
    if (!["cash", "bonus"].includes(dividendType)) {
      throw new Error("Dividend type must be cash or bonus.");
    }
    if (dividendType === "cash" && allotted !== 0) {
      throw new Error("Cash dividend must have 0 allotted shares.");
    }
    if (dividendType === "bonus" && allotted <= 0) {
      throw new Error("Bonus dividend must have a positive share quantity.");
    }
  } else if (category !== "ipo" && allotted <= 0) {
    // IPO stage-1 can have allotted = 0 (ASBA only). Buy/sell must have allotted > 0.
    throw new Error("Allotted must be a positive integer for buy/sell entries.");
  }

  const payload = {
    share_name: String(form.share_name || "").trim(),
    category,
    // Send as string so the backend can parse with Decimal and preserve exact input.
    per_unit_price: perUnitPriceRaw,
    allotted,
    buy_sell: category === "dividend" ? dividendType : String(form.buy_sell || form.category || "").trim().toLowerCase(),
  };

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

export function updateShareEntry(recordId, form) {
  const perUnitPriceRaw = String(form.per_unit_price ?? "").trim();
  const perUnitPrice = Number.parseFloat(perUnitPriceRaw);
  const allotted = Number.parseInt(form.allotted, 10);
  const category = String(form.category || "").trim().toLowerCase();
  const dividendType = String(form.buy_sell || form._dividendType || "").trim().toLowerCase();

  if (!Number.isFinite(perUnitPrice)) {
    throw new Error("Per unit price must be a valid number.");
  }

  if (!Number.isFinite(allotted) || allotted < 0) {
    throw new Error("Allotted must be 0 or greater.");
  }

  if (category === "dividend") {
    if (!["cash", "bonus"].includes(dividendType)) {
      throw new Error("Dividend type must be cash or bonus.");
    }
    if (dividendType === "cash" && allotted !== 0) {
      throw new Error("Cash dividend must have 0 allotted shares.");
    }
    if (dividendType === "bonus" && allotted <= 0) {
      throw new Error("Bonus dividend must have a positive share quantity.");
    }
  } else if (category !== "ipo" && allotted <= 0) {
    throw new Error("Allotted must be a positive integer for buy/sell entries.");
  }

  const payload = {
    share_name: String(form.share_name || "").trim(),
    category,
    per_unit_price: perUnitPriceRaw,
    allotted,
    buy_sell: category === "dividend" ? dividendType : String(form.buy_sell || form.category || "").trim().toLowerCase(),
  };

  if (form.dates) {
    payload.dates = form.dates;
  }

  console.log("[shareApi] PUT /share/update payload", { recordId, payload });
  return putJson(`/share/update/${recordId}`, payload);
}

export function deleteShareRecord(recordId) {
  return deleteJson(`/share/delete/${recordId}`);
}

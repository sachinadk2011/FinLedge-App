import { toNumber } from "./bank-category-totals.js";

export type ShareRecord = {
  id?: number | string;
  date?: string | null;
  share_name?: string | null;
  category?: string | null;
  per_unit_price?: number | string | null;
  asba_charge?: number | string | null;
  allotted?: number | string | null;
  buy_sell?: string | null;
  total_amount?: number | string | null;
  profit_loss?: number | string | null;
  cumulative_profit?: number | string | null;
  timestamp?: string | null;
  sync_ref?: string | null;
};

export type ShareComputedRecord = Omit<
  Required<Pick<ShareRecord, "date" | "share_name" | "category" | "buy_sell">>,
  never
> & {
  id?: number | string;
  per_unit_price: number;
  asba_charge: number;
  allotted: number;
  total_amount: number;
  profit_loss: number;
  cumulative_profit: number;
  timestamp?: string | null;
  sync_ref?: string | null;
};

export type ShareSummary = {
  total_ipo_investment: number;
  total_sip_investment: number;
  total_sip_redeemed: number;
  sip_profit_loss: number;
  total_buy_amount: number;
  overall_investment: number;
  total_sell_amount: number;
  total_dividend: number;
  total_profit: number;
  overall_profit_loss: number;
  grand_total_investment: number;
  grand_profit_loss: number;
};

type Lot = {
  qty: number;
  price: number;
  asba: number;
};

function toInt(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

function consumeLots(lots: Lot[], sellQty: number): number {
  let remaining = sellQty;
  let costBasis = 0;

  for (const lot of lots) {
    if (remaining <= 0) {
      break;
    }

    const qtyBefore = lot.qty;
    const consumed = Math.min(qtyBefore, remaining);
    costBasis += consumed * lot.price;

    if (qtyBefore > 0 && lot.asba !== 0) {
      const consumedAsba = lot.asba * (consumed / qtyBefore);
      costBasis += consumedAsba;
      lot.asba -= consumedAsba;
    }

    lot.qty = qtyBefore - consumed;
    remaining -= consumed;
  }

  if (remaining > 0) {
    throw new Error("Not enough available quantity to sell for this share.");
  }

  return costBasis;
}

export function recomputeShareRecords(records: ShareRecord[]): ShareComputedRecord[] {
  let cumulativeProfit = 0;
  const lotsByShare = new Map<string, Lot[]>();
  const sipInvestmentByShare = new Map<string, number>();

  return records.map((record) => {
    const shareName = String(record.share_name ?? "").trim();
    const shareKey = shareName.toLowerCase();
    const category = String(record.category ?? "").trim().toLowerCase();
    let perUnitPrice = toNumber(record.per_unit_price);
    const allotted = toInt(record.allotted);
    let buySell = String(record.buy_sell ?? "").trim().toLowerCase();
    const asbaCharge = category === "ipo" ? 5 : 0;
    let totalAmount = 0;
    let profitLoss = 0;

    if (category === "dividend") {
      if (buySell === "cash") {
        totalAmount = perUnitPrice;
        profitLoss = totalAmount;
      }
    } else if (category === "sip") {
      const normalizedBuySell = buySell === "sip" ? "installment" : buySell;
      const storedTotal = toNumber(record.total_amount);
      totalAmount = storedTotal > 0 ? storedTotal : allotted > 0 ? perUnitPrice * allotted : perUnitPrice;

      if (normalizedBuySell === "redeem") {
        const outstanding = sipInvestmentByShare.get(shareKey) ?? 0;
        profitLoss = totalAmount - outstanding;
        sipInvestmentByShare.set(shareKey, 0);
        perUnitPrice = totalAmount;
        buySell = "redeem";
      } else {
        sipInvestmentByShare.set(shareKey, (sipInvestmentByShare.get(shareKey) ?? 0) + totalAmount);
        buySell = "installment";
        perUnitPrice = allotted > 0 ? totalAmount / allotted : totalAmount;
      }
    } else {
      totalAmount = perUnitPrice * allotted + asbaCharge;
    }

    if (category === "ipo" || category === "buy" || (category === "dividend" && buySell === "bonus")) {
      if (shareKey) {
        const lots = lotsByShare.get(shareKey) ?? [];
        lots.push({
          qty: allotted,
          price: category === "dividend" ? 0 : perUnitPrice,
          asba: category === "ipo" ? asbaCharge : 0,
        });
        lotsByShare.set(shareKey, lots);
      }
    } else if (category === "sell" && allotted > 0) {
      const lots = lotsByShare.get(shareKey) ?? [];
      const costBasis = consumeLots(lots, allotted);
      profitLoss = totalAmount - costBasis;
    }

    cumulativeProfit += profitLoss;

    return {
      id: record.id,
      date: String(record.date ?? ""),
      share_name: shareName,
      category,
      per_unit_price: perUnitPrice,
      asba_charge: asbaCharge,
      allotted,
      buy_sell: buySell,
      total_amount: totalAmount,
      profit_loss: profitLoss,
      cumulative_profit: cumulativeProfit,
      timestamp: record.timestamp,
      sync_ref: record.sync_ref,
    };
  });
}

export function summarizeShareRecords(records: ShareRecord[]): ShareSummary {
  let totalIpoInvestment = 0;
  let totalSipInvestment = 0;
  let totalSipRedeemed = 0;
  let sipProfitLoss = 0;
  let totalBuyAmount = 0;
  let totalSellAmount = 0;
  let totalProfit = 0;
  let totalDividend = 0;

  for (const record of records) {
    const category = String(record.category ?? "").trim().toLowerCase();
    const buySell = String(record.buy_sell ?? "").trim().toLowerCase();
    const totalAmount = toNumber(record.total_amount);
    const profitLoss = toNumber(record.profit_loss);

    if (category === "ipo") {
      totalIpoInvestment += totalAmount;
    } else if (category === "sip" && (buySell === "redeem" || buySell === "redeemed")) {
      totalSipRedeemed += totalAmount;
      sipProfitLoss += profitLoss;
    } else if (category === "sip") {
      totalSipInvestment += totalAmount;
    } else if (category === "buy") {
      totalBuyAmount += totalAmount;
    } else if (category === "sell") {
      totalSellAmount += totalAmount;
      totalProfit += profitLoss;
    } else if (category === "dividend" && buySell === "cash") {
      totalDividend += totalAmount;
    }
  }

  const overallInvestment = totalIpoInvestment + totalBuyAmount;
  const overallProfitLoss = totalProfit + totalDividend - overallInvestment;
  const grandTotalInvestment = overallInvestment + totalSipInvestment;

  return {
    total_ipo_investment: totalIpoInvestment,
    total_sip_investment: totalSipInvestment,
    total_sip_redeemed: totalSipRedeemed,
    sip_profit_loss: sipProfitLoss,
    total_buy_amount: totalBuyAmount,
    overall_investment: overallInvestment,
    total_sell_amount: totalSellAmount,
    total_dividend: totalDividend,
    total_profit: totalProfit,
    overall_profit_loss: overallProfitLoss,
    grand_total_investment: grandTotalInvestment,
    grand_profit_loss: overallProfitLoss + sipProfitLoss,
  };
}

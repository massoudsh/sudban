export interface ProfitSale {
  price: number; quantity: number; unitCostSnapshot: number | null;
  commissionAmount: number; shippingSubsidy: number; discountAmount: number;
  returnCost: number; settlementDeduction: number;
}

export function netProfit(sale: ProfitSale) {
  const revenue = sale.price * sale.quantity;
  const deductions = sale.commissionAmount + sale.shippingSubsidy + sale.discountAmount + sale.returnCost + sale.settlementDeduction;
  const cost = sale.unitCostSnapshot === null ? null : sale.unitCostSnapshot * sale.quantity;
  return { revenue, deductions, cost, netProfit: cost === null ? null : revenue - deductions - cost,
    marginPct: cost === null || revenue === 0 ? null : (revenue - deductions - cost) / revenue };
}

export function replacementProtection(currentCost: number, originalRate: number, latestRate: number, price: number) {
  const replacementCost = currentCost * latestRate / originalRate;
  return { replacementCost, replacementProfit: price - replacementCost, atRisk: price < replacementCost, changePct: latestRate / originalRate - 1 };
}

export function priceSafety(price: number, costFloor: number, floor: number | null, ceiling: number | null) {
  if (!Number.isFinite(price) || price < Math.max(costFloor, floor ?? 0)) return "قیمت کمتر از کف سود مجاز است";
  if (ceiling !== null && price > ceiling) return "قیمت بیشتر از سقف مجاز است";
  return null;
}

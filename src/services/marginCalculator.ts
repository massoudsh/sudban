import { CostBreakdown, MarginResult } from "../types";

/**
 * محاسبه بهای تمام‌شده واقعی هر واحد کالا با احتساب:
 * - جبران هزینه کالای مرجوعی (تقسیم بر نرخ عدم‌مرجوعی)
 * - کمیسیون کانال فروش که وابسته به قیمت فروش است
 */
export function calculateTrueCost(costs: CostBreakdown, price: number): number {
  const { unitCost, packagingCost, shippingCost, otherFixedCost, commissionRate, returnRate } = costs;

  if (returnRate >= 1) {
    throw new Error("returnRate باید کمتر از ۱ باشد");
  }

  const effectiveUnitCost = unitCost / (1 - returnRate);
  const commissionCost = price * commissionRate;

  return effectiveUnitCost + packagingCost + shippingCost + otherFixedCost + commissionCost;
}

export function calculateMargin(costs: CostBreakdown, price: number): MarginResult {
  const trueCost = calculateTrueCost(costs, price);
  const profit = price - trueCost;
  const marginPct = price > 0 ? profit / price : -Infinity;

  return { price, trueCost, profit, marginPct };
}

/**
 * کف قیمتی که در آن حاشیه سود دقیقاً برابر minMarginPct می‌شود.
 * حل معادله: (price - trueCost(price)) / price = minMarginPct
 * با جایگذاری trueCost(price) = fixedCosts + price * commissionRate:
 *   price * (1 - commissionRate - minMarginPct) = fixedCosts
 */
export function calculatePriceFloor(costs: CostBreakdown, minMarginPct: number): number {
  const { unitCost, packagingCost, shippingCost, otherFixedCost, commissionRate, returnRate } = costs;

  const effectiveUnitCost = unitCost / (1 - returnRate);
  const fixedCosts = effectiveUnitCost + packagingCost + shippingCost + otherFixedCost;

  const denominator = 1 - commissionRate - minMarginPct;
  if (denominator <= 0) {
    throw new Error(
      "ترکیب نرخ کمیسیون و حداقل حاشیه سود امکان‌پذیر نیست (مجموع آن‌ها باید کمتر از ۱ باشد)"
    );
  }

  return fixedCosts / denominator;
}

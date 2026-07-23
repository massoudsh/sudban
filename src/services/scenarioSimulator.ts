import { CostBreakdown, ScenarioResult, DEFAULTS } from "../types";
import { calculateMargin } from "./marginCalculator";

export interface ScenarioInput {
  costs: CostBreakdown;
  hypotheticalPrice: number;
  baselinePrice: number;
  baselineAvgQuantity: number; // میانگین فروش دوره‌ای در قیمت پایه (مثلاً واحد در ماه)
  elasticity?: number; // اگر ندهی از DEFAULTS.PRICE_ELASTICITY استفاده می‌شود
}

/**
 * شبیه‌سازی اثر تغییر قیمت با مدل کشش قیمتی ثابت:
 * %ΔQuantity = elasticity * %ΔPrice
 */
export function simulateScenario(input: ScenarioInput): ScenarioResult {
  const { costs, hypotheticalPrice, baselinePrice, baselineAvgQuantity, elasticity } = input;

  if (baselinePrice <= 0) {
    throw new Error("baselinePrice باید بزرگ‌تر از صفر باشد");
  }

  const e = elasticity ?? DEFAULTS.PRICE_ELASTICITY;
  const priceChangePct = (hypotheticalPrice - baselinePrice) / baselinePrice;
  const quantityChangePct = e * priceChangePct;

  const expectedQuantity = Math.max(0, baselineAvgQuantity * (1 + quantityChangePct));
  const expectedRevenue = expectedQuantity * hypotheticalPrice;

  const { marginPct, profit: unitProfit } = calculateMargin(costs, hypotheticalPrice);
  const expectedProfit = expectedQuantity * unitProfit;

  const { profit: baselineUnitProfit } = calculateMargin(costs, baselinePrice);
  const baselineRevenue = baselineAvgQuantity * baselinePrice;
  const baselineProfit = baselineAvgQuantity * baselineUnitProfit;

  const revenueChangePct = baselineRevenue > 0 ? (expectedRevenue - baselineRevenue) / baselineRevenue : 0;
  const profitChangePct = baselineProfit !== 0 ? (expectedProfit - baselineProfit) / Math.abs(baselineProfit) : 0;

  return {
    hypotheticalPrice,
    baselinePrice,
    baselineAvgQuantity,
    expectedQuantity: Math.round(expectedQuantity * 100) / 100,
    expectedRevenue: Math.round(expectedRevenue),
    expectedProfit: Math.round(expectedProfit),
    expectedMarginPct: marginPct,
    quantityChangePct,
    revenueChangePct,
    profitChangePct,
  };
}

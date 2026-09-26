import { SalesRecord } from "@prisma/client";
import { CostBreakdown, DEFAULTS, PriceSuggestionResult, Strategy } from "../types";
import { calculateMargin } from "./marginCalculator";
import { suggestPrice } from "./priceSuggestionEngine";
import { CompetitivePosition } from "../types";

export interface MlPriceInput {
  salesRecords: Pick<SalesRecord, "price" | "quantity" | "soldAt">[];
  costs: CostBreakdown;
  minMarginPct: number;
  floorPrice?: number | null;
  ceilingPrice?: number | null;
  strategy: Strategy;
  competitivePosition: CompetitivePosition;
}

export interface MlPriceResult extends PriceSuggestionResult {
  model: "ELASTICITY_V2" | "RULE_BASED_FALLBACK";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  estimatedElasticity: number;
  trainingSampleSize: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function estimateElasticity(records: Pick<SalesRecord, "price" | "quantity" | "soldAt">[]): number | null {
  const sorted = [...records]
    .filter((r) => r.price > 0 && r.quantity > 0)
    .sort((a, b) => a.soldAt.getTime() - b.soldAt.getTime());

  const pairs: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const priceChange = (curr.price - prev.price) / prev.price;
    const quantityChange = (curr.quantity - prev.quantity) / prev.quantity;
    if (Math.abs(priceChange) >= 0.01) pairs.push(quantityChange / priceChange);
  }

  if (pairs.length < 3) return null;
  const average = pairs.reduce((sum, value) => sum + value, 0) / pairs.length;
  return clamp(average, -5, -0.2);
}

export function suggestMlPrice(input: MlPriceInput): MlPriceResult {
  const estimatedElasticity = estimateElasticity(input.salesRecords);
  const fallback = suggestPrice(input);

  if (estimatedElasticity === null) {
    return {
      ...fallback,
      model: "RULE_BASED_FALLBACK",
      confidence: "LOW",
      estimatedElasticity: DEFAULTS.PRICE_ELASTICITY,
      trainingSampleSize: input.salesRecords.length,
      rationale: [...fallback.rationale, "داده فروش کافی برای مدل کشش قیمت وجود ندارد؛ پیشنهاد rule-based استفاده شد"],
    };
  }

  const recent = [...input.salesRecords]
    .filter((r) => r.price > 0 && r.quantity > 0)
    .sort((a, b) => b.soldAt.getTime() - a.soldAt.getTime())
    .slice(0, 5);
  const baselinePrice = recent.reduce((sum, r) => sum + r.price, 0) / recent.length;
  const baselineQty = recent.reduce((sum, r) => sum + r.quantity, 0) / recent.length;
  const costFloor = fallback.costFloor;
  const min = Math.max(input.floorPrice ?? 0, costFloor);
  const max = input.ceilingPrice ?? baselinePrice * 1.5;

  let bestPrice = fallback.suggestedPrice;
  let bestProfit = Number.NEGATIVE_INFINITY;
  for (let step = 0; step <= 40; step++) {
    const price = min + ((max - min) * step) / 40;
    const demand = Math.max(0, baselineQty * (1 + estimatedElasticity * ((price - baselinePrice) / baselinePrice)));
    const margin = calculateMargin(input.costs, price);
    const expectedProfit = margin.profit * demand;
    if (expectedProfit > bestProfit) {
      bestProfit = expectedProfit;
      bestPrice = price;
    }
  }

  const margin = calculateMargin(input.costs, bestPrice);
  const boundedPrice = clamp(bestPrice, min, max);
  return {
    ...fallback,
    suggestedPrice: Math.round(boundedPrice),
    expectedMarginPct: margin.marginPct,
    model: "ELASTICITY_V2",
    confidence: input.salesRecords.length >= 12 ? "HIGH" : "MEDIUM",
    estimatedElasticity,
    trainingSampleSize: input.salesRecords.length,
    rationale: [...fallback.rationale, `مدل v2 کشش قیمت را ${estimatedElasticity.toFixed(2)} برآورد کرد و سود مورد انتظار را بیشینه کرد`],
  };
}

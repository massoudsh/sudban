import { describe, expect, it } from "vitest";
import { mapCompliance, pricePosition, promotionPlan, stockoutForecast, summarizePriceHistory } from "./merchantInsights";

describe("mapCompliance", () => {
  it("treats an unconfigured MAP as not applicable", () => {
    expect(mapCompliance(1000, null).status).toBe("NOT_CONFIGURED");
    expect(mapCompliance(1000, undefined).status).toBe("NOT_CONFIGURED");
  });
  it("accepts a price equal to the MAP", () => {
    expect(mapCompliance(1000, 1000)).toEqual({ status: "COMPLIANT", deviationAmount: 0, deviationPct: 0 });
  });
  it("flags a price below the MAP with the exact gap", () => {
    expect(mapCompliance(900, 1000)).toMatchObject({ status: "VIOLATION", deviationAmount: 100, deviationPct: 0.1 });
  });
  it("does not flag selling above the MAP", () => {
    expect(mapCompliance(1200, 1000).status).toBe("COMPLIANT");
  });
  it("rejects a non-positive selling price", () => {
    expect(() => mapCompliance(0, 1000)).toThrow();
  });
});

describe("stockoutForecast", () => {
  const base = { stockQuantity: 60, reorderPoint: 20, unitsSold: 30, windowDays: 30, leadTimeDays: 10 };

  it("computes days of cover from sales velocity", () => {
    const result = stockoutForecast(base);
    expect(result.dailyVelocity).toBe(1);
    expect(result.daysOfCover).toBe(60);
    expect(result.willStockOutBeforeRestock).toBe(false);
  });
  it("flags a stock-out that arrives before the lead time", () => {
    const result = stockoutForecast({ ...base, stockQuantity: 5 });
    expect(result.willStockOutBeforeRestock).toBe(true);
  });
  it("returns an unknown cover when nothing sold", () => {
    const result = stockoutForecast({ ...base, unitsSold: 0 });
    expect(result.daysOfCover).toBeNull();
    expect(result.willStockOutBeforeRestock).toBe(false);
    expect(result.confidence).toBe("LOW");
    expect(result.suggestedReorderQuantity).toBe(0);
  });
  it("suggests a reorder quantity that covers lead time plus safety stock", () => {
    const result = stockoutForecast({ ...base, stockQuantity: 5, leadTimeDays: 10, safetyDays: 7 });
    // velocity 1 × (10 + 7) + reorder 20 = 37 target, minus 5 on hand
    expect(result.suggestedReorderQuantity).toBe(32);
  });
  it("rates confidence by sample size", () => {
    expect(stockoutForecast({ ...base, unitsSold: 2, windowDays: 10 }).confidence).toBe("LOW");
    expect(stockoutForecast({ ...base, unitsSold: 5, windowDays: 10 }).confidence).toBe("MEDIUM");
    expect(stockoutForecast(base).confidence).toBe("HIGH");
  });
  it("rejects a non-positive window", () => {
    expect(() => stockoutForecast({ ...base, windowDays: 0 })).toThrow();
  });
  it("keeps days until reorder point at zero once the point is breached", () => {
    expect(stockoutForecast({ ...base, stockQuantity: 10 }).daysUntilReorderPoint).toBe(0);
  });
});

describe("pricePosition", () => {
  it("reports no data without competitors", () => {
    expect(pricePosition(1000, []).standing).toBe("NO_DATA");
  });
  it("marks the cheapest offer and shows the undercut", () => {
    expect(pricePosition(900, [1000, 1100])).toMatchObject({ standing: "CHEAPEST", cheapest: 1000, gapToCheapest: -100 });
  });
  it("marks a price above the whole band as most expensive", () => {
    expect(pricePosition(1500, [1000, 1100]).standing).toBe("MOST_EXPENSIVE");
  });
  it("classifies below and above the median", () => {
    expect(pricePosition(1050, [1000, 1100, 1200]).standing).toBe("BELOW_MEDIAN");
    expect(pricePosition(1150, [1000, 1100, 1200]).standing).toBe("ABOVE_MEDIAN");
  });
  it("computes the median for an even sample", () => {
    expect(pricePosition(1050, [1000, 1100]).median).toBe(1050);
  });
  it("ignores invalid competitor prices", () => {
    expect(pricePosition(1000, [0, -5, Number.NaN, 1200]).sampleSize).toBe(1);
  });
  it("returns no data when the current price is unset", () => {
    expect(pricePosition(null, [1000]).standing).toBe("NO_DATA");
  });
});

describe("summarizePriceHistory", () => {
  const at = (day: number) => new Date(Date.UTC(2026, 0, day));

  it("returns empty summary for no points", () => {
    expect(summarizePriceHistory([])).toMatchObject({ low: null, current: null, points: 0 });
  });
  it("summarises low, high and the current value by time order", () => {
    const summary = summarizePriceHistory([
      { at: at(3), price: 1200 },
      { at: at(1), price: 1000 },
      { at: at(2), price: 900 },
    ]);
    expect(summary).toMatchObject({ low: 900, high: 1200, current: 1200, points: 3 });
    expect(summary.changePct).toBeCloseTo(0.2);
  });
  it("drops invalid entries", () => {
    expect(summarizePriceHistory([{ at: new Date("bad"), price: 100 }, { at: at(1), price: -1 }]).points).toBe(0);
  });
});

describe("promotionPlan", () => {
  it("allows discounting down to the floor", () => {
    const plan = promotionPlan(1000, 800);
    expect(plan.maxSafePrice).toBe(800);
    expect(plan.maxSafeDiscountPct).toBeCloseTo(0.2);
    expect(plan.withinSafety).toBe(true);
  });
  it("refuses any discount when already at the floor", () => {
    expect(promotionPlan(800, 800).maxSafeDiscountAmount).toBe(0);
  });
  it("reports an unsafe starting price", () => {
    const plan = promotionPlan(700, 800);
    expect(plan.withinSafety).toBe(false);
    expect(plan.maxSafeDiscountAmount).toBe(0);
  });
  it("rejects a non-positive price", () => {
    expect(() => promotionPlan(0, 800)).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { estimateElasticity, suggestMlPrice } from "./mlPriceEngine";
import { CompetitivePosition } from "../types";

const competitivePosition: CompetitivePosition = {
  min: 100,
  max: 160,
  median: 130,
  avg: 130,
  sampleSize: 3,
  currentPricePercentile: 50,
};

const costs = {
  unitCost: 70,
  packagingCost: 5,
  shippingCost: 5,
  otherFixedCost: 0,
  commissionRate: 0.1,
  returnRate: 0,
};

describe("mlPriceEngine", () => {
  it("falls back to rule-based suggestions when sales samples are insufficient", () => {
    const result = suggestMlPrice({
      salesRecords: [{ price: 120, quantity: 10, soldAt: new Date("2026-01-01") }],
      costs,
      minMarginPct: 0.2,
      strategy: "MATCH",
      competitivePosition,
    });

    expect(result.model).toBe("RULE_BASED_FALLBACK");
    expect(result.confidence).toBe("LOW");
  });

  it("estimates negative elasticity from historical price and demand changes", () => {
    const elasticity = estimateElasticity([
      { price: 100, quantity: 20, soldAt: new Date("2026-01-01") },
      { price: 110, quantity: 18, soldAt: new Date("2026-01-02") },
      { price: 120, quantity: 15, soldAt: new Date("2026-01-03") },
      { price: 130, quantity: 13, soldAt: new Date("2026-01-04") },
    ]);

    expect(elasticity).toBeLessThan(0);
  });

  it("returns an elasticity model result with enough sales history", () => {
    const salesRecords = Array.from({ length: 12 }, (_, index) => ({
      price: 100 + index * 3,
      quantity: 30 - index,
      soldAt: new Date(`2026-01-${String(index + 1).padStart(2, "0")}`),
    }));

    const result = suggestMlPrice({
      salesRecords,
      costs,
      minMarginPct: 0.2,
      floorPrice: 100,
      ceilingPrice: 180,
      strategy: "MATCH",
      competitivePosition,
    });

    expect(result.model).toBe("ELASTICITY_V2");
    expect(result.trainingSampleSize).toBe(12);
    expect(result.suggestedPrice).toBeGreaterThanOrEqual(100);
    expect(result.suggestedPrice).toBeLessThanOrEqual(180);
  });
});

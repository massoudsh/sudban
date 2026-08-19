import { describe, it, expect } from "vitest";
import { calculateTrueCost, calculateMargin, calculatePriceFloor } from "./marginCalculator";
import { CostBreakdown } from "../types";

const baseCosts: CostBreakdown = {
  unitCost: 100_000,
  packagingCost: 5_000,
  shippingCost: 10_000,
  otherFixedCost: 0,
  commissionRate: 0.1,
  returnRate: 0,
};

describe("calculateTrueCost", () => {
  it("جمع هزینه‌های ثابت + کمیسیون وابسته به قیمت را درست محاسبه می‌کند", () => {
    const price = 200_000;
    const trueCost = calculateTrueCost(baseCosts, price);
    // 100000 + 5000 + 10000 + (200000*0.1) = 135000
    expect(trueCost).toBe(135_000);
  });

  it("با افزایش returnRate، effectiveUnitCost را بزرگ‌تر می‌کند", () => {
    const withReturns = calculateTrueCost({ ...baseCosts, returnRate: 0.2 }, 200_000);
    const without = calculateTrueCost(baseCosts, 200_000);
    expect(withReturns).toBeGreaterThan(without);
  });

  it("وقتی returnRate برابر یا بزرگ‌تر از ۱ باشد خطا می‌دهد", () => {
    expect(() => calculateTrueCost({ ...baseCosts, returnRate: 1 }, 200_000)).toThrow();
    expect(() => calculateTrueCost({ ...baseCosts, returnRate: 1.5 }, 200_000)).toThrow();
  });
});

describe("calculateMargin", () => {
  it("profit و marginPct را بر اساس price و trueCost محاسبه می‌کند", () => {
    const result = calculateMargin(baseCosts, 200_000);
    expect(result.trueCost).toBe(135_000);
    expect(result.profit).toBe(65_000);
    expect(result.marginPct).toBeCloseTo(0.325, 5);
  });

  it("وقتی price صفر باشد marginPct منفی بی‌نهایت می‌شود", () => {
    const result = calculateMargin(baseCosts, 0);
    expect(result.marginPct).toBe(-Infinity);
  });

  it("وقتی price کمتر از trueCost باشد profit منفی است (فروش زیان‌ده)", () => {
    const result = calculateMargin(baseCosts, 100_000);
    expect(result.profit).toBeLessThan(0);
  });
});

describe("calculatePriceFloor", () => {
  it("کف قیمتی محاسبه می‌کند که در آن marginPct دقیقاً برابر minMarginPct شود", () => {
    const minMarginPct = 0.2;
    const floor = calculatePriceFloor(baseCosts, minMarginPct);
    const { marginPct } = calculateMargin(baseCosts, floor);
    expect(marginPct).toBeCloseTo(minMarginPct, 5);
  });

  it("با returnRate بالاتر، کف قیمت بالاتر می‌رود", () => {
    const floorNormal = calculatePriceFloor(baseCosts, 0.2);
    const floorWithReturns = calculatePriceFloor({ ...baseCosts, returnRate: 0.3 }, 0.2);
    expect(floorWithReturns).toBeGreaterThan(floorNormal);
  });

  it("وقتی commissionRate + minMarginPct بزرگ‌تر یا مساوی ۱ باشد خطا می‌دهد", () => {
    expect(() => calculatePriceFloor(baseCosts, 0.9)).toThrow();
    expect(() => calculatePriceFloor({ ...baseCosts, commissionRate: 0.5 }, 0.5)).toThrow();
  });

  it("با commissionRate صفر، کف قیمت برابر fixedCosts/(1-minMarginPct) است", () => {
    const costsNoCommission = { ...baseCosts, commissionRate: 0 };
    const floor = calculatePriceFloor(costsNoCommission, 0.25);
    const fixedCosts = 100_000 + 5_000 + 10_000;
    expect(floor).toBeCloseTo(fixedCosts / 0.75, 5);
  });
});

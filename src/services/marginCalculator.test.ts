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

// ---- مقادیر مرزی: صفر، سربه‌سر، نزدیک به مرز مجاز، و دقت اعشار ----

const zeroCosts: CostBreakdown = {
  unitCost: 0,
  packagingCost: 0,
  shippingCost: 0,
  otherFixedCost: 0,
  commissionRate: 0,
  returnRate: 0,
};

describe("calculateTrueCost / calculateMargin — مقادیر مرزی و گردکردن", () => {
  it("با هزینه‌های کاملاً صفر، trueCost صفر و marginPct برابر ۱ می‌شود", () => {
    expect(calculateTrueCost(zeroCosts, 250_000)).toBe(0);
    const { profit, marginPct } = calculateMargin(zeroCosts, 250_000);
    expect(profit).toBe(250_000);
    expect(marginPct).toBe(1);
  });

  it("با price منفی، marginPct منفی‌بی‌نهایت می‌شود (بدون تقسیم بر صفر یا NaN)", () => {
    const { profit, marginPct } = calculateMargin(baseCosts, -50_000);
    expect(profit).toBeLessThan(0);
    expect(marginPct).toBe(-Infinity);
  });

  it("روی مرز سربه‌سر (price === trueCost) سود و marginPct هر دو صفر می‌شوند", () => {
    // با commissionRate صفر، trueCost مستقل از قیمت است و می‌توان نقطه سربه‌سر دقیق ساخت
    const costsNoCommission: CostBreakdown = { ...baseCosts, commissionRate: 0 };
    const breakEvenPrice = calculateTrueCost(costsNoCommission, 200_000);
    const { profit, marginPct } = calculateMargin(costsNoCommission, breakEvenPrice);
    expect(profit).toBe(0);
    expect(marginPct).toBe(0);
  });

  it("returnRate نزدیک به ۱ (۰.۹۹۹) هرچند مجاز است، هزینه را به‌شدت بزرگ می‌کند", () => {
    const { trueCost } = calculateMargin({ ...baseCosts, returnRate: 0.999, commissionRate: 0 }, 200_000);
    // 100000 / 0.001 + 5000 + 10000
    expect(trueCost).toBeCloseTo(100_000 / 0.001 + 15_000, 3);
  });

  it("مقدار برگشتی رُند نمی‌شود تا خطای گردکردن در محاسبات بعدی تجمع نکند", () => {
    const { trueCost } = calculateMargin({ ...baseCosts, returnRate: 0.3, commissionRate: 0 }, 200_000);
    expect(trueCost).toBeCloseTo(100_000 / 0.7 + 15_000, 9);
    expect(Number.isInteger(trueCost)).toBe(false);
  });
});

describe("calculatePriceFloor — مقادیر مرزی", () => {
  it("با بهای تمام‌شده صفر، کف قیمت هم صفر است", () => {
    expect(calculatePriceFloor(zeroCosts, 0.2)).toBe(0);
  });

  it("با minMarginPct صفر، کف قیمت برابر هزینه‌های ثابت تقسیم بر (۱ - commissionRate) است", () => {
    // با commissionRate صفر و minMarginPct صفر، کف دقیقاً همان سربه‌سر است
    const costsNoCommission: CostBreakdown = { ...baseCosts, commissionRate: 0 };
    expect(calculatePriceFloor(costsNoCommission, 0)).toBeCloseTo(115_000, 6);
  });

  it("ترکیب دقیقاً روی مرز (commissionRate + minMarginPct === 1) هم خطا می‌دهد", () => {
    expect(() => calculatePriceFloor({ ...baseCosts, commissionRate: 0.25 }, 0.75)).toThrow();
    expect(() => calculatePriceFloor({ ...baseCosts, commissionRate: 0.5 }, 0.5)).toThrow();
  });

  it("کف قیمت همیشه حداقل به اندازه minMarginPct حاشیه سود می‌دهد", () => {
    for (const minMarginPct of [0, 0.05, 0.25, 0.6]) {
      const floor = calculatePriceFloor(baseCosts, minMarginPct);
      const { marginPct } = calculateMargin(baseCosts, floor);
      expect(marginPct).toBeGreaterThanOrEqual(minMarginPct - 1e-9);
    }
  });
});

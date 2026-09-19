import { describe, it, expect } from "vitest";
import { simulateScenario } from "./scenarioSimulator";
import { CostBreakdown } from "../types";

const costs: CostBreakdown = {
  unitCost: 100_000,
  packagingCost: 5_000,
  shippingCost: 10_000,
  otherFixedCost: 0,
  commissionRate: 0.1,
  returnRate: 0,
};

describe("simulateScenario", () => {
  it("وقتی baselinePrice صفر یا منفی باشد خطا می‌دهد", () => {
    expect(() =>
      simulateScenario({ costs, hypotheticalPrice: 200_000, baselinePrice: 0, baselineAvgQuantity: 10 })
    ).toThrow();
  });

  it("بدون elasticity سفارشی، از DEFAULTS.PRICE_ELASTICITY استفاده می‌کند (افزایش قیمت -> کاهش تقاضا)", () => {
    const result = simulateScenario({
      costs,
      hypotheticalPrice: 220_000, // +10%
      baselinePrice: 200_000,
      baselineAvgQuantity: 100,
    });
    // elasticity پیش‌فرض منفی است، پس با افزایش قیمت مقدار مورد انتظار کاهش می‌یابد
    expect(result.expectedQuantity).toBeLessThan(100);
    expect(result.quantityChangePct).toBeLessThan(0);
  });

  it("با elasticity سفارشی صفر، تغییر قیمت هیچ اثری روی مقدار ندارد", () => {
    const result = simulateScenario({
      costs,
      hypotheticalPrice: 300_000,
      baselinePrice: 200_000,
      baselineAvgQuantity: 50,
      elasticity: 0,
    });
    expect(result.expectedQuantity).toBe(50);
    expect(result.quantityChangePct).toBe(0);
  });

  it("مقدار مورد انتظار هرگز منفی نمی‌شود حتی با کاهش شدید قیمت و کشش زیاد", () => {
    const result = simulateScenario({
      costs,
      hypotheticalPrice: 500_000, // +150%
      baselinePrice: 200_000,
      baselineAvgQuantity: 10,
      elasticity: -10, // کشش خیلی زیاد و منفی برای تست کف صفر
    });
    expect(result.expectedQuantity).toBeGreaterThanOrEqual(0);
  });

  it("کاهش قیمت (با کشش منفی معمولی) باعث افزایش مقدار مورد انتظار می‌شود", () => {
    const result = simulateScenario({
      costs,
      hypotheticalPrice: 180_000, // -10%
      baselinePrice: 200_000,
      baselineAvgQuantity: 100,
      elasticity: -1.5,
    });
    expect(result.expectedQuantity).toBeGreaterThan(100);
  });

  it("expectedProfit و profitChangePct را بر اساس margin واقعی محاسبه می‌کند", () => {
    const result = simulateScenario({
      costs,
      hypotheticalPrice: 250_000,
      baselinePrice: 200_000,
      baselineAvgQuantity: 20,
      elasticity: 0,
    });
    expect(result.expectedMarginPct).toBeGreaterThan(0);
    expect(result.expectedProfit).toBeGreaterThan(0);
  });
});

// ---- مقادیر مرزی: baseline صفر، تقسیم بر صفر، و گردکردن ----

describe("simulateScenario — مرزها و گردکردن", () => {
  it("با baselineAvgQuantity صفر، مقدار/درآمد/درصد تغییر صفر می‌شود (بدون تقسیم بر صفر)", () => {
    const result = simulateScenario({
      costs,
      hypotheticalPrice: 220_000,
      baselinePrice: 200_000,
      baselineAvgQuantity: 0,
      elasticity: -1.5,
    });
    expect(result.expectedQuantity).toBe(0);
    expect(result.expectedRevenue).toBe(0);
    expect(result.expectedProfit).toBe(0);
    expect(result.revenueChangePct).toBe(0);
    expect(result.profitChangePct).toBe(0);
  });

  it("baselinePrice منفی هم خطا می‌دهد (نه فقط صفر)", () => {
    expect(() =>
      simulateScenario({ costs, hypotheticalPrice: 200_000, baselinePrice: -1, baselineAvgQuantity: 10 })
    ).toThrow();
  });

  it("expectedQuantity حداکثر با دو رقم اعشار رُند می‌شود", () => {
    const result = simulateScenario({
      costs,
      hypotheticalPrice: 200_000, // بدون تغییر قیمت
      baselinePrice: 200_000,
      baselineAvgQuantity: 10 / 3, // 3.3333...
      elasticity: -1.5,
    });
    expect(result.expectedQuantity).toBe(3.33);
    expect(result.quantityChangePct).toBeCloseTo(0, 12);
  });

  it("expectedRevenue و expectedProfit به عدد صحیح رُند می‌شوند", () => {
    const result = simulateScenario({
      costs,
      hypotheticalPrice: 200_000,
      baselinePrice: 200_000,
      baselineAvgQuantity: 10.567,
      elasticity: 0,
    });
    expect(result.expectedRevenue).toBe(2_113_400);
    expect(Number.isInteger(result.expectedRevenue)).toBe(true);
    expect(Number.isInteger(result.expectedProfit)).toBe(true);
  });

  it("هنگام تغییر ندادن قیمت، درصد تغییر درآمد و سود صفر است", () => {
    const result = simulateScenario({
      costs,
      hypotheticalPrice: 200_000,
      baselinePrice: 200_000,
      baselineAvgQuantity: 42,
    });
    expect(result.quantityChangePct).toBeCloseTo(0, 12);
    expect(result.revenueChangePct).toBe(0);
    expect(result.profitChangePct).toBe(0);
    expect(result.expectedQuantity).toBe(42);
  });

  it("با elasticity اکیداً مثبت (کالای مکمل/لوکس) افزایش قیمت مقدار فروش را هم بالا می‌برد", () => {
    const result = simulateScenario({
      costs,
      hypotheticalPrice: 220_000,
      baselinePrice: 200_000,
      baselineAvgQuantity: 100,
      elasticity: 1,
    });
    expect(result.expectedQuantity).toBeCloseTo(110, 6);
    expect(result.quantityChangePct).toBeCloseTo(0.1, 9);
  });
});

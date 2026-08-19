import { describe, it, expect } from "vitest";
import { computeSalesTrend } from "./salesTrend";

function record(quantity: number, daysAgo: number) {
  const soldAt = new Date();
  soldAt.setDate(soldAt.getDate() - daysAgo);
  return { quantity, soldAt };
}

describe("computeSalesTrend", () => {
  it("با کمتر از ۴ رکورد، جهت UNKNOWN برمی‌گرداند", () => {
    const result = computeSalesTrend([record(5, 10), record(6, 5), record(7, 1)]);
    expect(result.direction).toBe("UNKNOWN");
    expect(result.changePct).toBeNull();
  });

  it("افزایش معنادار میانگین فروش نیمه اخیر را UP تشخیص می‌دهد", () => {
    const records = [record(10, 40), record(10, 30), record(30, 20), record(30, 10)];
    const result = computeSalesTrend(records);
    expect(result.direction).toBe("UP");
    expect(result.changePct).toBeGreaterThan(0.1);
  });

  it("کاهش معنادار میانگین فروش نیمه اخیر را DOWN تشخیص می‌دهد", () => {
    const records = [record(30, 40), record(30, 30), record(10, 20), record(10, 10)];
    const result = computeSalesTrend(records);
    expect(result.direction).toBe("DOWN");
    expect(result.changePct).toBeLessThan(-0.1);
  });

  it("تغییر کمتر از آستانه را STABLE در نظر می‌گیرد", () => {
    const records = [record(20, 40), record(21, 30), record(20, 20), record(21, 10)];
    const result = computeSalesTrend(records);
    expect(result.direction).toBe("STABLE");
  });

  it("ترتیب ورودی (نامرتب بودن رکوردها بر اساس تاریخ) روی نتیجه اثر نمی‌گذارد", () => {
    const sorted = [record(30, 40), record(30, 30), record(10, 20), record(10, 10)];
    const shuffled = [sorted[2], sorted[0], sorted[3], sorted[1]];
    expect(computeSalesTrend(shuffled)).toEqual(computeSalesTrend(sorted));
  });
});

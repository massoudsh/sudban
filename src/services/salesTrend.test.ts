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

// ---- مقادیر مرزی: کمینه تعداد رکورد، نیمه‌سازی نامتقارن، و تقسیم بر صفر ----

describe("computeSalesTrend — مرزها و نیمه‌سازی", () => {
  it("با آرایه خالی، UNKNOWN و همه میانگین‌ها null است", () => {
    expect(computeSalesTrend([])).toEqual({
      direction: "UNKNOWN",
      recentAvgQuantity: null,
      previousAvgQuantity: null,
      changePct: null,
    });
  });

  it("مرز دقیق تعداد رکورد: ۳ رکورد UNKNOWN می‌دهد ولی ۴ رکورد روند را محاسبه می‌کند", () => {
    const three = computeSalesTrend([record(10, 30), record(10, 20), record(30, 10)]);
    expect(three.direction).toBe("UNKNOWN");

    const four = computeSalesTrend([record(10, 40), record(10, 30), record(20, 20), record(20, 10)]);
    expect(four.direction).toBe("UP");
    expect(four.previousAvgQuantity).toBe(10);
    expect(four.recentAvgQuantity).toBe(20);
  });

  it("با تعداد فرد رکورد (۵)، نیمه اخیر یک رکورد بیشتر از نیمه قبلی می‌گیرد", () => {
    const result = computeSalesTrend([
      record(10, 50),
      record(10, 40),
      record(10, 30),
      record(20, 20),
      record(20, 10),
    ]);
    expect(result.previousAvgQuantity).toBe(10); // دو رکورد قدیمی‌تر
    expect(result.recentAvgQuantity).toBeCloseTo(50 / 3, 9); // سه رکورد جدیدتر
    expect(result.direction).toBe("UP");
  });

  it("روی مرز دقیق آستانه (۱۰٪) جهت تغییر نمی‌کند چون شرط اکید است (> نه >=)", () => {
    const up = computeSalesTrend([record(10, 40), record(10, 30), record(11, 20), record(11, 10)]);
    expect(up.changePct).toBeCloseTo(0.1, 12);
    expect(up.direction).toBe("STABLE");

    const down = computeSalesTrend([record(10, 40), record(10, 30), record(9, 20), record(9, 10)]);
    expect(down.changePct).toBeCloseTo(-0.1, 12);
    expect(down.direction).toBe("STABLE");
  });

  it("وقتی میانگین نیمه قبلی صفر باشد، changePct null و جهت STABLE است (بدون تقسیم بر صفر)", () => {
    const result = computeSalesTrend([record(0, 40), record(0, 30), record(5, 20), record(5, 10)]);
    expect(result.previousAvgQuantity).toBe(0);
    expect(result.recentAvgQuantity).toBe(5);
    expect(result.changePct).toBeNull();
    expect(result.direction).toBe("STABLE");
  });

  it("آرایه ورودی را تغییر نمی‌دهد (بدون sort درجا)", () => {
    const unsorted = [record(30, 10), record(10, 40), record(20, 20), record(15, 30)];
    const snapshot = JSON.stringify(unsorted);
    computeSalesTrend(unsorted);
    expect(JSON.stringify(unsorted)).toBe(snapshot);
  });
});

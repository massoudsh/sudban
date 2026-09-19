import { describe, it, expect } from "vitest";
import { computeCompetitivePosition } from "./competitivePosition";

describe("computeCompetitivePosition", () => {
  it("بدون هیچ داده رقیبی، همه فیلدها null و sampleSize صفر است", () => {
    const result = computeCompetitivePosition([], 100_000);
    expect(result).toEqual({
      min: null,
      max: null,
      median: null,
      avg: null,
      sampleSize: 0,
      currentPricePercentile: null,
    });
  });

  it("با یک رقیب، min=max=median=avg همان قیمت است", () => {
    const result = computeCompetitivePosition(
      [{ competitorName: "A", channel: "digikala", price: 150_000, capturedAt: new Date() }],
      150_000
    );
    expect(result.min).toBe(150_000);
    expect(result.max).toBe(150_000);
    expect(result.median).toBe(150_000);
    expect(result.avg).toBe(150_000);
    expect(result.sampleSize).toBe(1);
  });

  it("فقط آخرین قیمت هر رقیب (بر اساس competitorName+channel) را در نظر می‌گیرد", () => {
    const result = computeCompetitivePosition(
      [
        { competitorName: "A", channel: "digikala", price: 100_000, capturedAt: new Date("2025-01-01") },
        { competitorName: "A", channel: "digikala", price: 130_000, capturedAt: new Date("2025-02-01") },
        { competitorName: "B", channel: "basalam", price: 120_000, capturedAt: new Date("2025-01-15") },
      ],
      125_000
    );
    // رقیب A فقط با آخرین قیمت (130000) شمرده می‌شود، نه 100000
    expect(result.sampleSize).toBe(2);
    expect(result.min).toBe(120_000);
    expect(result.max).toBe(130_000);
  });

  it("median را برای تعداد زوج رقبا به‌درستی میانگین می‌گیرد", () => {
    const result = computeCompetitivePosition(
      [
        { competitorName: "A", channel: "c1", price: 100_000, capturedAt: new Date() },
        { competitorName: "B", channel: "c1", price: 200_000, capturedAt: new Date() },
        { competitorName: "C", channel: "c1", price: 300_000, capturedAt: new Date() },
        { competitorName: "D", channel: "c1", price: 400_000, capturedAt: new Date() },
      ],
      250_000
    );
    expect(result.median).toBe(250_000); // (200000+300000)/2
  });

  it("currentPricePercentile را بر اساس تعداد رقبای زیر یا مساوی قیمت فعلی محاسبه می‌کند", () => {
    const result = computeCompetitivePosition(
      [
        { competitorName: "A", channel: "c1", price: 100_000, capturedAt: new Date() },
        { competitorName: "B", channel: "c1", price: 200_000, capturedAt: new Date() },
        { competitorName: "C", channel: "c1", price: 300_000, capturedAt: new Date() },
        { competitorName: "D", channel: "c1", price: 400_000, capturedAt: new Date() },
      ],
      300_000
    );
    // ۳ رقیب از ۴ زیر یا مساوی ۳۰۰۰۰۰ هستند -> ۷۵٪
    expect(result.currentPricePercentile).toBe(75);
  });

  it("وقتی currentPrice داده نشود، currentPricePercentile null می‌ماند", () => {
    const result = computeCompetitivePosition(
      [{ competitorName: "A", channel: "c1", price: 100_000, capturedAt: new Date() }],
      null
    );
    expect(result.currentPricePercentile).toBeNull();
  });
});

// ---- مقادیر مرزی: دو سر باند، tie در زمان ثبت، و عدم تغییر ورودی ----

const fourCompetitors = [
  { competitorName: "A", channel: "c1", price: 100_000, capturedAt: new Date("2025-01-01") },
  { competitorName: "B", channel: "c1", price: 200_000, capturedAt: new Date("2025-01-02") },
  { competitorName: "C", channel: "c1", price: 300_000, capturedAt: new Date("2025-01-03") },
  { competitorName: "D", channel: "c1", price: 400_000, capturedAt: new Date("2025-01-04") },
];

describe("computeCompetitivePosition — مرزها و tie", () => {
  it("currentPrice بالاتر از سقف باند percentile=۱۰۰ و پایین‌تر از کف باند ۰ می‌دهد", () => {
    expect(computeCompetitivePosition(fourCompetitors, 900_000).currentPricePercentile).toBe(100);
    expect(computeCompetitivePosition(fourCompetitors, 1_000).currentPricePercentile).toBe(0);
  });

  it("روی هر دو سر باند، percentile به‌درستی محاسبه می‌شود (۱۰۰ برای max و ۲۵ برای min)", () => {
    expect(computeCompetitivePosition(fourCompetitors, 400_000).currentPricePercentile).toBe(100);
    expect(computeCompetitivePosition(fourCompetitors, 100_000).currentPricePercentile).toBe(25);
  });

  it("وقتی زمان ثبت دو قیمت یک رقیب دقیقاً برابر باشد، اولین رکورد نگه داشته می‌شود (شرط > نه >=)", () => {
    const sameMoment = new Date("2025-03-01");
    const result = computeCompetitivePosition(
      [
        { competitorName: "A", channel: "c1", price: 100_000, capturedAt: sameMoment },
        { competitorName: "A", channel: "c1", price: 999_000, capturedAt: sameMoment },
      ],
      null
    );
    expect(result.sampleSize).toBe(1);
    expect(result.min).toBe(100_000);
  });

  it("رقیب با نام یکسان ولی کانال متفاوت، یک نمونه جدا شمرده می‌شود", () => {
    const result = computeCompetitivePosition(
      [
        { competitorName: "A", channel: "digikala", price: 100_000, capturedAt: new Date("2025-01-01") },
        { competitorName: "A", channel: "basalam", price: 300_000, capturedAt: new Date("2025-01-01") },
      ],
      null
    );
    expect(result.sampleSize).toBe(2);
    expect(result.min).toBe(100_000);
    expect(result.max).toBe(300_000);
  });

  it("آرایه ورودی را تغییر نمی‌دهد (بدون mutation یا sort درجا)", () => {
    const input = [
      { competitorName: "C", channel: "c1", price: 300_000, capturedAt: new Date("2025-01-03") },
      { competitorName: "A", channel: "c1", price: 100_000, capturedAt: new Date("2025-01-01") },
      { competitorName: "B", channel: "c1", price: 200_000, capturedAt: new Date("2025-01-02") },
    ];
    const snapshot = JSON.stringify(input);
    computeCompetitivePosition(input, 150_000);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("با نمونه‌های تکراری قیمت، میانه و میانگین روی همان مقدار می‌مانند", () => {
    const result = computeCompetitivePosition(
      [
        { competitorName: "A", channel: "c1", price: 200_000, capturedAt: new Date("2025-01-01") },
        { competitorName: "B", channel: "c1", price: 200_000, capturedAt: new Date("2025-01-01") },
        { competitorName: "C", channel: "c1", price: 200_000, capturedAt: new Date("2025-01-01") },
      ],
      200_000
    );
    expect(result.min).toBe(200_000);
    expect(result.max).toBe(200_000);
    expect(result.median).toBe(200_000);
    expect(result.avg).toBe(200_000);
    expect(result.currentPricePercentile).toBe(100);
  });
});

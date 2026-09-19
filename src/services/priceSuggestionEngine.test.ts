import { describe, it, expect } from "vitest";
import { suggestPrice } from "./priceSuggestionEngine";
import { CostBreakdown, CompetitivePosition } from "../types";

const costs: CostBreakdown = {
  unitCost: 100_000,
  packagingCost: 5_000,
  shippingCost: 10_000,
  otherFixedCost: 0,
  commissionRate: 0.1,
  returnRate: 0,
};

const noCompetitors: CompetitivePosition = {
  min: null,
  max: null,
  median: null,
  avg: null,
  sampleSize: 0,
  currentPricePercentile: null,
};

const withCompetitors: CompetitivePosition = {
  min: 180_000,
  max: 260_000,
  median: 220_000,
  avg: 220_000,
  sampleSize: 3,
  currentPricePercentile: 50,
};

describe("suggestPrice", () => {
  it("بدون داده رقیب، لنگر روی کف قیمت بر اساس حاشیه سود قرار می‌گیرد", () => {
    const result = suggestPrice({
      costs,
      minMarginPct: 0.2,
      strategy: "MATCH",
      competitivePosition: noCompetitors,
    });
    expect(result.suggestedPrice).toBe(result.costFloor);
    expect(result.rationale.some((r) => r.includes("داده قیمت رقبا موجود نیست"))).toBe(true);
  });

  it("استراتژی MATCH لنگر را روی میانه رقبا قرار می‌دهد", () => {
    const result = suggestPrice({
      costs,
      minMarginPct: 0.2,
      strategy: "MATCH",
      competitivePosition: withCompetitors,
    });
    expect(result.suggestedPrice).toBe(220_000);
  });

  it("استراتژی PREMIUM قیمت را بالاتر از میانه (به سمت سقف) می‌برد", () => {
    const result = suggestPrice({
      costs,
      minMarginPct: 0.2,
      strategy: "PREMIUM",
      competitivePosition: withCompetitors,
    });
    expect(result.suggestedPrice).toBeGreaterThan(withCompetitors.median!);
    expect(result.suggestedPrice).toBeLessThanOrEqual(withCompetitors.max!);
  });

  it("استراتژی PENETRATION قیمت را پایین‌تر از میانه (به سمت کف بازار) می‌برد", () => {
    const result = suggestPrice({
      costs,
      minMarginPct: 0.2,
      strategy: "PENETRATION",
      competitivePosition: withCompetitors,
    });
    expect(result.suggestedPrice).toBeLessThan(withCompetitors.median!);
    expect(result.suggestedPrice).toBeGreaterThanOrEqual(withCompetitors.min!);
  });

  it("وقتی لنگر پایین‌تر از کف بهای تمام‌شده باشد، به کف اصلاح می‌شود", () => {
    const cheapMarket: CompetitivePosition = {
      min: 100_000,
      max: 110_000,
      median: 105_000,
      avg: 105_000,
      sampleSize: 2,
      currentPricePercentile: 50,
    };
    const result = suggestPrice({
      costs,
      minMarginPct: 0.3, // حاشیه سود بالا -> کف قیمتی بالاتر از بازار
      strategy: "MATCH",
      competitivePosition: cheapMarket,
    });
    expect(result.suggestedPrice).toBe(result.costFloor);
    expect(result.rationale.some((r) => r.includes("پایین‌تر از کف مجاز بود"))).toBe(true);
  });

  it("سقف قیمت دستی (ceilingPrice) قیمت پیشنهادی را محدود می‌کند", () => {
    const result = suggestPrice({
      costs,
      minMarginPct: 0.2,
      strategy: "PREMIUM",
      ceilingPrice: 210_000,
      competitivePosition: withCompetitors,
    });
    expect(result.suggestedPrice).toBe(210_000);
  });

  it("floorPrice دستی وقتی از کف حاشیه سود بالاتر باشد، اعمال می‌شود", () => {
    const result = suggestPrice({
      costs,
      minMarginPct: 0.1,
      floorPrice: 200_000,
      strategy: "PENETRATION",
      competitivePosition: withCompetitors,
    });
    expect(result.suggestedPrice).toBeGreaterThanOrEqual(200_000);
  });

  it("competitivenessScore هرچه به میانه نزدیک‌تر باشد بالاتر است", () => {
    const atMedian = suggestPrice({
      costs,
      minMarginPct: 0.1,
      strategy: "MATCH",
      competitivePosition: withCompetitors,
    });
    const premium = suggestPrice({
      costs,
      minMarginPct: 0.1,
      strategy: "PREMIUM",
      competitivePosition: withCompetitors,
    });
    expect(atMedian.competitivenessScore).toBeGreaterThan(premium.competitivenessScore);
  });
});

// ---- مقادیر مرزی: رُندکردن، کلمپ امتیاز، باند تک‌قیمتی ----

describe("suggestPrice — رُندکردن و مرزهای امتیاز", () => {
  it("suggestedPrice و costFloor همیشه عدد صحیح (رُندشده) هستند", () => {
    const fractionalMarket: CompetitivePosition = {
      min: 200_000,
      max: 220_001,
      median: 220_000,
      avg: 220_000,
      sampleSize: 3,
      currentPricePercentile: 50,
    };
    const result = suggestPrice({
      costs,
      minMarginPct: 0.1,
      strategy: "PREMIUM",
      competitivePosition: fractionalMarket,
    });
    // لنگر = 220000 + (220001 - 220000) * 0.6 = 220000.6 -> رُند به 220001
    expect(result.suggestedPrice).toBe(220_001);
    expect(Number.isInteger(result.suggestedPrice)).toBe(true);
    expect(Number.isInteger(result.costFloor)).toBe(true);
  });

  it("competitivenessScore هرگز منفی نمی‌شود (کلمپ کف صفر)", () => {
    const result = suggestPrice({
      costs,
      minMarginPct: 0.1,
      strategy: "MATCH",
      competitivePosition: withCompetitors,
      ceilingPrice: 140_000, // بسیار پایین‌تر از باند رقبا (۱۸۰k..۲۶۰k)
    });
    expect(result.suggestedPrice).toBe(140_000);
    expect(result.competitivenessScore).toBe(0);
  });

  it("با باند تک‌قیمتی (max === min) امتیاز خنثی ۵۰ می‌ماند و تقسیم بر صفر رخ نمی‌دهد", () => {
    const flatMarket: CompetitivePosition = {
      min: 200_000,
      max: 200_000,
      median: 200_000,
      avg: 200_000,
      sampleSize: 2,
      currentPricePercentile: 100,
    };
    const result = suggestPrice({
      costs,
      minMarginPct: 0.1,
      strategy: "MATCH",
      competitivePosition: flatMarket,
    });
    expect(result.suggestedPrice).toBe(200_000);
    expect(result.competitivenessScore).toBe(50);
  });

  it("امتیاز حداکثر ۱۰۰ است وقتی قیمت پیشنهادی دقیقاً روی میانه بنشیند", () => {
    const result = suggestPrice({
      costs,
      minMarginPct: 0.1,
      strategy: "MATCH",
      competitivePosition: withCompetitors,
    });
    expect(result.competitivenessScore).toBe(100);
  });

  it("کلمپ به سقف فروشنده در rationale توضیح داده می‌شود", () => {
    const result = suggestPrice({
      costs,
      minMarginPct: 0.1,
      strategy: "PREMIUM",
      ceilingPrice: 210_000,
      competitivePosition: withCompetitors,
    });
    expect(result.rationale.some((r) => r.includes("سقف تعیین‌شده توسط فروشنده"))).toBe(true);
  });

  it("نتیجه شامل استراتژی انتخاب‌شده و متن rationale غیرخالی است", () => {
    const result = suggestPrice({
      costs,
      minMarginPct: 0.1,
      strategy: "PENETRATION",
      competitivePosition: withCompetitors,
    });
    expect(result.strategy).toBe("PENETRATION");
    expect(result.rationale.length).toBeGreaterThan(0);
    expect(result.expectedMarginPct).toBeGreaterThan(0);
  });
});

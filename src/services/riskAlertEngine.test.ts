import { describe, it, expect } from "vitest";
import { checkRisks } from "./riskAlertEngine";
import { CostBreakdown, CompetitivePosition } from "../types";

const costs: CostBreakdown = {
  unitCost: 100_000,
  packagingCost: 5_000,
  shippingCost: 10_000,
  otherFixedCost: 0,
  commissionRate: 0.1,
  returnRate: 0,
};

const neutralCompetitors: CompetitivePosition = {
  min: 180_000,
  max: 260_000,
  median: 220_000,
  avg: 220_000,
  sampleSize: 3,
  currentPricePercentile: 50,
};

describe("checkRisks", () => {
  it("وقتی price کمتر از trueCost باشد، هشدار LOSS_MAKING با شدت CRITICAL می‌دهد", () => {
    const risks = checkRisks({
      price: 100_000, // زیر trueCost (135000)
      costs,
      minMarginPct: 0.2,
      competitivePosition: neutralCompetitors,
    });
    expect(risks.some((r) => r.type === "LOSS_MAKING" && r.severity === "CRITICAL")).toBe(true);
  });

  it("وقتی marginPct کمتر از minMarginPct باشد (ولی سودده)، هشدار LOW_MARGIN می‌دهد", () => {
    const risks = checkRisks({
      price: 140_000, // trueCost=135000، سودده اما حاشیه کم
      costs,
      minMarginPct: 0.3,
      competitivePosition: neutralCompetitors,
    });
    expect(risks.some((r) => r.type === "LOW_MARGIN" && r.severity === "WARNING")).toBe(true);
    expect(risks.some((r) => r.type === "LOSS_MAKING")).toBe(false);
  });

  it("وقتی قیمت بیش از ۱۵٪ بالاتر از سقف رقبا باشد، هشدار UNCOMPETITIVE_HIGH می‌دهد", () => {
    const risks = checkRisks({
      price: 320_000, // > 260000 * 1.15 = 299000
      costs,
      minMarginPct: 0.1,
      competitivePosition: neutralCompetitors,
    });
    expect(risks.some((r) => r.type === "UNCOMPETITIVE_HIGH")).toBe(true);
  });

  it("وقتی قیمت به‌طور قابل‌توجهی زیر کف بازار و نزدیک حداقل حاشیه سود باشد، هشدار PRICE_WAR_RISK می‌دهد", () => {
    const risks = checkRisks({
      price: 135_000, // < 180000 * 0.85 = 153000 و marginPct ~0.048 نزدیک minMarginPct
      costs,
      minMarginPct: 0.05,
      competitivePosition: neutralCompetitors,
    });
    expect(risks.some((r) => r.type === "PRICE_WAR_RISK")).toBe(true);
  });

  it("وقتی قیمت سالم و رقابتی است، هیچ هشداری تولید نمی‌شود", () => {
    const risks = checkRisks({
      price: 220_000, // میانه بازار، حاشیه سود کافی
      costs,
      minMarginPct: 0.2,
      competitivePosition: neutralCompetitors,
    });
    expect(risks).toEqual([]);
  });

  it("بدون داده رقیب (min/max=null)، هشدارهای رقابتی صادر نمی‌شوند", () => {
    const risks = checkRisks({
      price: 200_000,
      costs,
      minMarginPct: 0.1,
      competitivePosition: { min: null, max: null, median: null, avg: null, sampleSize: 0, currentPricePercentile: null },
    });
    expect(risks.some((r) => r.type === "UNCOMPETITIVE_HIGH" || r.type === "PRICE_WAR_RISK")).toBe(false);
  });
});

// ---- مرزهای دقیق آستانه‌ها (شرط‌ها اکید هستند: > و < نه >= و <=) ----

const costsNoCommission: CostBreakdown = { ...costs, commissionRate: 0 };

describe("checkRisks — مرزهای دقیق", () => {
  it("روی مرز سربه‌سر (price === trueCost) هشدار LOSS_MAKING نیست ولی LOW_MARGIN هست", () => {
    const trueCost = 115_000; // بدون کمیسیون، مستقل از قیمت
    const risks = checkRisks({
      price: trueCost,
      costs: costsNoCommission,
      minMarginPct: 0.1,
      competitivePosition: neutralCompetitors,
    });
    expect(risks.some((r) => r.type === "LOSS_MAKING")).toBe(false);
    expect(risks.some((r) => r.type === "LOW_MARGIN")).toBe(true);
  });

  it("هنگام marginPct دقیقاً برابر minMarginPct، هشدار LOW_MARGIN صادر نمی‌شود", () => {
    // (125000 - 115000) / 125000 = 0.08 دقیقاً
    const risks = checkRisks({
      price: 125_000,
      costs: costsNoCommission,
      minMarginPct: 0.08,
      competitivePosition: neutralCompetitors,
    });
    expect(risks.some((r) => r.type === "LOW_MARGIN")).toBe(false);
  });

  it("روی مرز دقیق آستانه عدم‌رقابت‌پذیری (max * 1.15) هشدار صادر نمی‌شود", () => {
    const boundaryPrice = 260_000 * 1.15; // ۲۹۹۰۰۰
    expect(
      checkRisks({
        price: boundaryPrice,
        costs,
        minMarginPct: 0.1,
        competitivePosition: neutralCompetitors,
      })
    ).toEqual([]);

    const justAbove = checkRisks({
      price: boundaryPrice + 1,
      costs,
      minMarginPct: 0.1,
      competitivePosition: neutralCompetitors,
    });
    expect(justAbove.map((r) => r.type)).toEqual(["UNCOMPETITIVE_HIGH"]);
  });

  it("قیمت برابر سقف رقبا (max) هیچ هشدار رقابتی ایجاد نمی‌کند", () => {
    const risks = checkRisks({
      price: 260_000,
      costs,
      minMarginPct: 0.1,
      competitivePosition: neutralCompetitors,
    });
    expect(risks).toEqual([]);
  });

  it("روی مرز دقیق جنگ قیمتی (min - ۱۵٪ = ۱۵۳۰۰۰) هشدار PRICE_WAR_RISK صادر نمی‌شود", () => {
    const risks = checkRisks({
      price: 153_000, // 180000 * (1 - 0.15)؛ شرط price < آستانه است، پس خود آستانه هشدار نیست
      costs,
      minMarginPct: 0.1,
      competitivePosition: neutralCompetitors,
    });
    expect(risks.some((r) => r.type === "PRICE_WAR_RISK")).toBe(false);
  });

  it("هر هشدار context عددی مربوط به خودش را برمی‌گرداند", () => {
    const risks = checkRisks({
      price: 100_000, // زیر trueCost = 125000
      costs,
      minMarginPct: 0.2,
      competitivePosition: neutralCompetitors,
    });
    const lossMaking = risks.find((r) => r.type === "LOSS_MAKING");
    expect(lossMaking?.context.price).toBe(100_000);
    expect(lossMaking?.context.trueCost).toBe(125_000);
  });
});

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

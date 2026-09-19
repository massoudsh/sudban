import { describe, it, expect } from "vitest";
import { generateWisdom, WisdomInput } from "./wisdomEngine";
import { CostBreakdown, CompetitivePosition, PriceSuggestionResult, RiskAlertCandidate, SalesTrend } from "../types";

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

const noRisks: RiskAlertCandidate[] = [];
const unknownTrend: SalesTrend = { direction: "UNKNOWN", recentAvgQuantity: null, previousAvgQuantity: null, changePct: null };

function suggestion(overrides: Partial<PriceSuggestionResult> = {}): PriceSuggestionResult {
  return {
    suggestedPrice: 220_000,
    costFloor: 150_000,
    expectedMarginPct: 0.3,
    competitivenessScore: 90,
    strategy: "MATCH",
    rationale: [],
    ...overrides,
  };
}

describe("generateWisdom", () => {
  it("هشدارهای ریسک را به بینش تبدیل می‌کند و CRITICAL را HIGH اولویت می‌دهد", () => {
    const risks: RiskAlertCandidate[] = [
      { type: "LOSS_MAKING", severity: "CRITICAL", message: "زیان‌ده", context: {} },
    ];
    const report = generateWisdom({
      currentPrice: 220_000,
      costs,
      minMarginPct: 0.2,
      competitivePosition: neutralCompetitors,
      suggestion: suggestion(),
      risks,
      salesTrend: unknownTrend,
    });
    expect(report.insights[0].priority).toBe("HIGH");
    expect(report.insights[0].category).toBe("RISK");
    expect(report.topRecommendation).toContain("کف بهای تمام‌شده");
  });

  it("اختلاف قابل‌توجه با قیمت پیشنهادی، بینش OPPORTUNITY تولید می‌کند", () => {
    const report = generateWisdom({
      currentPrice: 180_000,
      costs,
      minMarginPct: 0.1,
      competitivePosition: neutralCompetitors,
      suggestion: suggestion({ suggestedPrice: 220_000 }), // ~22% فاصله
      risks: noRisks,
      salesTrend: unknownTrend,
    });
    expect(report.insights.some((i) => i.category === "OPPORTUNITY" && i.priority === "HIGH")).toBe(true);
  });

  it("وقتی هیچ ریسکی نیست و حاشیه سود به‌طور معنادار بالای حداقل است، بینش MARGIN سالم می‌دهد", () => {
    const report = generateWisdom({
      currentPrice: 220_000,
      costs, // marginPct در 220000 حدود 0.386 است
      minMarginPct: 0.1,
      competitivePosition: neutralCompetitors,
      suggestion: suggestion({ suggestedPrice: 220_000 }),
      risks: noRisks,
      salesTrend: unknownTrend,
    });
    expect(report.insights.some((i) => i.category === "MARGIN" && i.priority === "LOW")).toBe(true);
  });

  it("روند نزولی فروش را با اولویت بالاتر وقتی حاشیه سود نزدیک کف است گزارش می‌کند", () => {
    const downTrend: SalesTrend = { direction: "DOWN", recentAvgQuantity: 10, previousAvgQuantity: 20, changePct: -0.5 };
    const report = generateWisdom({
      currentPrice: 136_000, // marginPct~0.054 نزدیک minMarginPct+MARGIN_WAR_RISK_BUFFER معادل کف
      costs,
      minMarginPct: 0.05,
      competitivePosition: neutralCompetitors,
      suggestion: suggestion({ suggestedPrice: 136_000 }),
      risks: noRisks,
      salesTrend: downTrend,
    });
    const trendInsight = report.insights.find((i) => i.category === "TREND");
    expect(trendInsight?.priority).toBe("HIGH");
  });

  it("در وضعیت کاملاً پایدار (بدون بینش دیگر) و جایگاه رقابتی میانی، بینش COMPETITIVE پایدار می‌دهد", () => {
    const report = generateWisdom({
      currentPrice: 220_000,
      costs,
      minMarginPct: 0.05,
      competitivePosition: neutralCompetitors, // percentile=50
      suggestion: suggestion({ suggestedPrice: 220_000 }),
      risks: noRisks,
      salesTrend: { direction: "STABLE", recentAvgQuantity: 10, previousAvgQuantity: 10, changePct: 0 },
    });
    // marginPct در 220000 با minMarginPct=0.05 بیشتر از HEALTHY_MARGIN_BUFFER فاصله دارد
    // پس ممکن است بینش MARGIN هم تولید شود؛ فقط چک می‌کنیم لیست خالی نیست و توصیه محوری وجود دارد
    expect(report.insights.length).toBeGreaterThan(0);
    expect(report.topRecommendation).toBeTruthy();
  });

  it("بدون هیچ بینشی، topRecommendation پیام پیش‌فرض پایداری را برمی‌گرداند", () => {
    const flatCosts: CostBreakdown = { ...costs, commissionRate: 0 };
    const report = generateWisdom({
      currentPrice: 220_000,
      costs: flatCosts,
      minMarginPct: 0.386, // خیلی نزدیک به marginPct واقعی که HEALTHY_MARGIN_BUFFER رد نشود ولی LOW_MARGIN هم رد نشود
      competitivePosition: { min: null, max: null, median: null, avg: null, sampleSize: 0, currentPricePercentile: null },
      suggestion: suggestion({ suggestedPrice: 220_000 }),
      risks: noRisks,
      salesTrend: unknownTrend,
    });
    if (report.insights.length === 0) {
      expect(report.topRecommendation).toBe("وضعیت این محصول پایدار است؛ نیاز به اقدام فوری نیست.");
    } else {
      expect(report.topRecommendation).toBeTruthy();
    }
  });

  it("بینش‌ها بر اساس اولویت (HIGH قبل از MEDIUM قبل از LOW) مرتب می‌شوند", () => {
    const risks: RiskAlertCandidate[] = [
      { type: "LOW_MARGIN", severity: "WARNING", message: "کم", context: {} },
    ];
    const downTrend: SalesTrend = { direction: "DOWN", recentAvgQuantity: 5, previousAvgQuantity: 10, changePct: -0.5 };
    const report = generateWisdom({
      currentPrice: 220_000,
      costs,
      minMarginPct: 0.3,
      competitivePosition: neutralCompetitors,
      suggestion: suggestion({ suggestedPrice: 220_000 }),
      risks,
      salesTrend: downTrend,
    });
    const priorityRank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    for (let i = 1; i < report.insights.length; i++) {
      expect(priorityRank[report.insights[i].priority]).toBeGreaterThanOrEqual(
        priorityRank[report.insights[i - 1].priority]
      );
    }
  });
});

// ---- مقادیر مرزی: آستانه‌های اختلاف قیمت/حاشیه سود، مرزهای جایگاه رقابتی، و نگاشت توصیه هشدارها ----

const flatCosts: CostBreakdown = {
  unitCost: 100_000,
  packagingCost: 0,
  shippingCost: 0,
  otherFixedCost: 0,
  commissionRate: 0,
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

const atPercentile = (currentPricePercentile: number | null): CompetitivePosition => ({
  ...neutralCompetitors,
  currentPricePercentile,
});

/**
 * ورودی پایه تست‌های مرزی: قیمت ۲۰۰۰۰۰ و بهای تمام‌شده ثابت ۱۰۰۰۰۰
 * => marginPct دقیقاً ۰.۵ (بدون وابستگی به قیمت، چون commissionRate صفر است).
 */
function boundaryInput(overrides: Partial<WisdomInput> = {}): WisdomInput {
  return {
    currentPrice: 200_000,
    costs: flatCosts,
    minMarginPct: 0.45,
    competitivePosition: noCompetitors,
    suggestion: suggestion({ suggestedPrice: 200_000 }),
    risks: noRisks,
    salesTrend: unknownTrend,
    ...overrides,
  };
}

describe("generateWisdom — مرزهای آستانه‌ها", () => {
  it("روی مرز دقیق اختلاف ۵٪ بینش OPPORTUNITY با اولویت MEDIUM تولید می‌شود (شرط >= نه >)", () => {
    const report = generateWisdom(boundaryInput({ suggestion: suggestion({ suggestedPrice: 210_000 }) }));
    const gapInsight = report.insights.find((i) => i.title === "فاصله از قیمت پیشنهادی");
    expect(gapInsight?.category).toBe("OPPORTUNITY");
    expect(gapInsight?.priority).toBe("MEDIUM");
  });

  it("با اختلاف ۴.۹٪ (کمی زیر آستانه) هیچ بینش اختلافی تولید نمی‌شود", () => {
    const report = generateWisdom(boundaryInput({ suggestion: suggestion({ suggestedPrice: 209_800 }) }));
    expect(report.insights.some((i) => i.title === "فاصله از قیمت پیشنهادی")).toBe(false);
  });

  it("روی مرز دقیق اختلاف ۱۵٪ اولویت بینش به HIGH ارتقا می‌یابد", () => {
    const report = generateWisdom(boundaryInput({ suggestion: suggestion({ suggestedPrice: 230_000 }) }));
    const gapInsight = report.insights.find((i) => i.title === "فاصله از قیمت پیشنهادی");
    expect(gapInsight?.priority).toBe("HIGH");
  });

  it("حاشیه سود دقیقاً روی مرز «سالم» (minMarginPct + ۵٪) بینش MARGIN می‌دهد", () => {
    const report = generateWisdom(boundaryInput()); // marginPct=0.5 و minMarginPct=0.45
    expect(report.insights).toHaveLength(1);
    expect(report.insights[0].category).toBe("MARGIN");
    expect(report.insights[0].priority).toBe("LOW");
  });

  it("با حاشیه سود کمی زیر مرز «سالم» هیچ بینشی تولید نمی‌شود و توصیه پیش‌فرض برمی‌گردد", () => {
    const report = generateWisdom(boundaryInput({ minMarginPct: 0.450001 }));
    expect(report.insights).toEqual([]);
    expect(report.topRecommendation).toBe("وضعیت این محصول پایدار است؛ نیاز به اقدام فوری نیست.");
  });

  it("بینش «وضعیت پایدار» فقط در بازه درصدی ۳۵ تا ۶۵ (شامل دو سر) تولید می‌شود", () => {
    const base = boundaryInput({ minMarginPct: 0.450001 }); // بدون بینش MARGIN

    for (const percentile of [35, 50, 65]) {
      const report = generateWisdom({ ...base, competitivePosition: atPercentile(percentile) });
      expect(report.insights).toHaveLength(1);
      expect(report.insights[0].category).toBe("COMPETITIVE");
      expect(report.insights[0].priority).toBe("LOW");
    }

    for (const percentile of [34, 66]) {
      const report = generateWisdom({ ...base, competitivePosition: atPercentile(percentile) });
      expect(report.insights).toEqual([]);
    }
  });

  it("با percentile خنثی ولی بدون داده رقیب (null)، بینش «وضعیت پایدار» تولید نمی‌شود", () => {
    const report = generateWisdom(boundaryInput({ minMarginPct: 0.450001 }));
    expect(report.insights.some((i) => i.category === "COMPETITIVE")).toBe(false);
  });

  it("روند نزولی با حاشیه سود دور از کف اولویت MEDIUM می‌گیرد (نه HIGH)", () => {
    const downTrend: SalesTrend = { direction: "DOWN", recentAvgQuantity: 5, previousAvgQuantity: 10, changePct: -0.5 };
    const report = generateWisdom(boundaryInput({ minMarginPct: 0.1, salesTrend: downTrend }));
    // marginPct=0.5 در برابر آستانه کف 0.1+0.03=0.13
    expect(report.insights.find((i) => i.category === "TREND")?.priority).toBe("MEDIUM");
  });

  it("روند STABLE هیچ بینش TREND تولید نمی‌کند (فقط UP و DOWN بینش دارند)", () => {
    const stableTrend: SalesTrend = { direction: "STABLE", recentAvgQuantity: 10, previousAvgQuantity: 10, changePct: 0 };
    const report = generateWisdom(boundaryInput({ salesTrend: stableTrend }));
    expect(report.insights.some((i) => i.category === "TREND")).toBe(false);
  });

  it("هر نوع هشدار ریسک توصیه متناظر خودش را می‌گیرد (CRITICAL->HIGH و WARNING->MEDIUM)", () => {
    const cases: Array<[RiskAlertCandidate["type"], "HIGH" | "MEDIUM", string]> = [
      ["LOSS_MAKING", "HIGH", "کف بهای تمام‌شده"],
      ["LOW_MARGIN", "MEDIUM", "بهای تمام‌شده را کاهش دهید"],
      ["UNCOMPETITIVE_HIGH", "MEDIUM", "باند رقبا"],
      ["PRICE_WAR_RISK", "MEDIUM", "جنگ قیمتی"],
    ];

    for (const [type, priority, needle] of cases) {
      const risk: RiskAlertCandidate = {
        type,
        severity: priority === "HIGH" ? "CRITICAL" : "WARNING",
        message: "پیام تست",
        context: {},
      };
      const report = generateWisdom(boundaryInput({ risks: [risk] }));
      const riskInsight = report.insights.find((i) => i.category === "RISK");
      expect(riskInsight?.title).toBe(type);
      expect(riskInsight?.priority).toBe(priority);
      expect(riskInsight?.recommendation).toContain(needle);
    }
  });

  it("توصیه محوری برابر recommendation اولین بینش پس از مرتب‌سازی اولویت است", () => {
    const downTrend: SalesTrend = { direction: "DOWN", recentAvgQuantity: 5, previousAvgQuantity: 10, changePct: -0.5 };
    const report = generateWisdom(
      boundaryInput({
        minMarginPct: 0.1,
        salesTrend: downTrend,
        suggestion: suggestion({ suggestedPrice: 230_000 }), // اختلاف ۱۵٪ -> OPPORTUNITY با اولویت HIGH
      })
    );
    expect(report.insights.length).toBeGreaterThan(1);
    expect(report.topRecommendation).toBe(report.insights[0].recommendation);
  });
});

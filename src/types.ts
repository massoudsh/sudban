export type Strategy = "MATCH" | "PREMIUM" | "PENETRATION";

export interface CostBreakdown {
  unitCost: number;
  packagingCost: number;
  shippingCost: number;
  otherFixedCost: number;
  commissionRate: number; // 0..1
  returnRate: number; // 0..1
}

export interface MarginResult {
  price: number;
  trueCost: number;
  profit: number;
  marginPct: number;
}

export interface CompetitivePosition {
  min: number | null;
  max: number | null;
  median: number | null;
  avg: number | null;
  sampleSize: number;
  currentPricePercentile: number | null; // 0..100، جایگاه قیمت فعلی فروشنده در باند رقبا
}

export interface PriceSuggestionResult {
  suggestedPrice: number;
  costFloor: number;
  expectedMarginPct: number;
  competitivenessScore: number; // 0..100
  strategy: Strategy;
  rationale: string[];
}

export interface ScenarioResult {
  hypotheticalPrice: number;
  baselinePrice: number;
  baselineAvgQuantity: number;
  expectedQuantity: number;
  expectedRevenue: number;
  expectedProfit: number;
  expectedMarginPct: number;
  quantityChangePct: number;
  revenueChangePct: number;
  profitChangePct: number;
}

export interface RiskAlertCandidate {
  type: "LOSS_MAKING" | "LOW_MARGIN" | "UNCOMPETITIVE_HIGH" | "PRICE_WAR_RISK";
  severity: "CRITICAL" | "WARNING";
  message: string;
  context: Record<string, number>;
}

// ضرایب پیش‌فرض سیستمی — قابل بازنویسی به ازای هر محصول از طریق PricingRule
export const DEFAULTS = {
  PRICE_ELASTICITY: -1.5, // درصد تغییر تقاضا به ازای هر ۱٪ تغییر قیمت (کالای معمولی، نه لوکس/ضروری محض)
  UNCOMPETITIVE_HIGH_THRESHOLD: 0.15, // ۱۵٪ بالاتر از سقف بازار
  PRICE_WAR_THRESHOLD: 0.15, // ۱۵٪ پایین‌تر از کف بازار
  MARGIN_WAR_RISK_BUFFER: 0.02, // فاصله تا حداقل حاشیه سود که «نزدیک کف» محسوب می‌شود
};

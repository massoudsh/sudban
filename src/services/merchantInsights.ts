/**
 * محاسبات خالص برای بینش‌های فروشنده: MAP، پیش‌بینی اتمام موجودی، جایگاه قیمت،
 * خلاصه تاریخچه قیمت و برنامه تخفیف. هیچ دسترسی به دیتابیس اینجا نیست.
 */

const isPositive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
const isNonNegative = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;

export type MapStatus = "NOT_CONFIGURED" | "COMPLIANT" | "VIOLATION";

export interface MapCompliance {
  status: MapStatus;
  /** مبلغ تخلف (مثبت یعنی زیر MAP فروخته می‌شود) */
  deviationAmount: number | null;
  deviationPct: number | null;
}

/**
 * MAP (حداقل قیمت تبلیغ‌شده) — اگر قیمت فروش زیر آن باشد تخلف است.
 * وضعیت «COMPLIANT» شامل قیمت برابر با MAP هم می‌شود.
 */
export function mapCompliance(price: number, mapPrice: number | null | undefined): MapCompliance {
  if (!isPositive(mapPrice)) return { status: "NOT_CONFIGURED", deviationAmount: null, deviationPct: null };
  if (!isPositive(price)) throw new Error("قیمت باید عددی مثبت باشد");

  const deviationAmount = mapPrice - price;
  if (deviationAmount <= 0) return { status: "COMPLIANT", deviationAmount: 0, deviationPct: 0 };

  return { status: "VIOLATION", deviationAmount, deviationPct: deviationAmount / mapPrice };
}

export type ForecastConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface StockoutForecast {
  dailyVelocity: number;
  daysOfCover: number | null;
  daysUntilReorderPoint: number | null;
  willStockOutBeforeRestock: boolean;
  suggestedReorderQuantity: number;
  confidence: ForecastConfidence;
}

/**
 * پیش‌بینی اتمام موجودی بر پایه سرعت فروش دوره قبل.
 * اگر در دوره فروشی ثبت نشده باشد، سرعت صفر است و daysOfCover به معنی «نامعلوم» null برمی‌گردد.
 */
export function stockoutForecast(input: {
  stockQuantity: number;
  reorderPoint: number;
  unitsSold: number;
  windowDays: number;
  leadTimeDays: number;
  safetyDays?: number;
}): StockoutForecast {
  const { stockQuantity, reorderPoint, unitsSold, windowDays, leadTimeDays } = input;
  const safetyDays = input.safetyDays ?? 7;

  if (!isNonNegative(stockQuantity)) throw new Error("موجودی باید عددی نامنفی باشد");
  if (!isNonNegative(reorderPoint)) throw new Error("نقطه سفارش باید عددی نامنفی باشد");
  if (!isNonNegative(unitsSold)) throw new Error("تعداد فروش باید عددی نامنفی باشد");
  if (!isPositive(windowDays)) throw new Error("بازه محاسبه باید مثبت باشد");
  if (!isNonNegative(leadTimeDays)) throw new Error("زمان تأمین باید نامنفی باشد");
  if (!isNonNegative(safetyDays)) throw new Error("ذخیره احتیاطی باید نامنفی باشد");

  const dailyVelocity = unitsSold / windowDays;
  const daysOfCover = dailyVelocity > 0 ? stockQuantity / dailyVelocity : null;
  const daysUntilReorderPoint = dailyVelocity > 0 ? Math.max(0, (stockQuantity - reorderPoint) / dailyVelocity) : null;
  const willStockOutBeforeRestock = daysOfCover !== null && daysOfCover <= leadTimeDays;
  const targetStock = dailyVelocity * (leadTimeDays + safetyDays) + reorderPoint;
  const suggestedReorderQuantity = Math.max(0, Math.ceil(targetStock - stockQuantity));

  // اطمینان بر اساس حجم داده: حداقل ۱۰ واحد فروش و ۳۰ روز پنجره برای HIGH.
  const confidence: ForecastConfidence = unitsSold >= 10 && windowDays >= 30 ? "HIGH" : unitsSold >= 3 ? "MEDIUM" : "LOW";

  return { dailyVelocity, daysOfCover, daysUntilReorderPoint, willStockOutBeforeRestock, suggestedReorderQuantity, confidence };
}

export type PriceStanding = "CHEAPEST" | "BELOW_MEDIAN" | "ABOVE_MEDIAN" | "MOST_EXPENSIVE" | "NO_DATA";

export interface PricePosition {
  standing: PriceStanding;
  cheapest: number | null;
  median: number | null;
  /** اختلاف با ارزان‌ترین قیمت بازار (مثبت یعنی گران‌تر از ارزان‌ترین) */
  gapToCheapest: number | null;
  /** اختلاف درصدی با میانه بازار */
  gapToMedianPct: number | null;
  sampleSize: number;
}

/** جایگاه قیمت فعلی فروشنده نسبت به باند قیمت رقبا. */
export function pricePosition(currentPrice: number | null, marketPrices: number[]): PricePosition {
  const prices = marketPrices.filter(isPositive).sort((a, b) => a - b);
  if (!prices.length || !isPositive(currentPrice)) {
    return { standing: "NO_DATA", cheapest: null, median: null, gapToCheapest: null, gapToMedianPct: null, sampleSize: prices.length };
  }

  const cheapest = prices[0];
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];

  let standing: PriceStanding;
  if (currentPrice < cheapest) standing = "CHEAPEST";
  else if (currentPrice === cheapest) standing = "CHEAPEST";
  else if (currentPrice > prices[prices.length - 1]) standing = "MOST_EXPENSIVE";
  else if (currentPrice <= median) standing = "BELOW_MEDIAN";
  else if (currentPrice >= prices[prices.length - 1]) standing = "MOST_EXPENSIVE";
  else standing = "ABOVE_MEDIAN";

  return {
    standing,
    cheapest,
    median,
    gapToCheapest: currentPrice - cheapest,
    gapToMedianPct: median > 0 ? (currentPrice - median) / median : null,
    sampleSize: prices.length,
  };
}

export interface PriceHistoryPoint {
  at: Date;
  price: number;
}

export interface PriceHistorySummary {
  low: number | null;
  high: number | null;
  current: number | null;
  changePct: number | null;
  /** نوسان نسبی (بالاترین منهای پایین‌ترین، تقسیم بر میانگین) */
  volatilityPct: number | null;
  points: number;
}

/** خلاصه تاریخچه قیمت یک محصول از نقاط زمانی (پیشنهاد، تأیید، فروش و رقیب). */
export function summarizePriceHistory(rawPoints: PriceHistoryPoint[]): PriceHistorySummary {
  const points = rawPoints
    .filter((p) => isPositive(p.price) && p.at instanceof Date && !Number.isNaN(p.at.getTime()))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  if (!points.length) return { low: null, high: null, current: null, changePct: null, volatilityPct: null, points: 0 };

  const values = points.map((p) => p.price);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const current = points[points.length - 1].price;
  const first = points[0].price;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;

  return {
    low,
    high,
    current,
    changePct: first > 0 ? (current - first) / first : null,
    volatilityPct: avg > 0 ? (high - low) / avg : null,
    points: points.length,
  };
}

export interface PromotionPlan {
  maxSafeDiscountPct: number;
  maxSafeDiscountAmount: number;
  maxSafePrice: number;
  withinSafety: boolean;
}

/**
 * بیشترین تخفیفی که قیمت را زیر کف سود نبرد.
 * `floorPrice` باید از `calculatePriceFloor` (کف مبتنی بر هزینه) بیاید؛ کف دستی جداگانه بررسی شود.
 */
export function promotionPlan(price: number, floorPrice: number): PromotionPlan {
  if (!isPositive(price)) throw new Error("قیمت باید عددی مثبت باشد");
  if (!isNonNegative(floorPrice)) throw new Error("کف قیمت باید عددی نامنفی باشد");

  const safePrice = Math.min(price, Math.max(floorPrice, 0));
  const amount = Math.max(0, price - safePrice);

  return {
    maxSafeDiscountPct: amount / price,
    maxSafeDiscountAmount: amount,
    maxSafePrice: safePrice,
    withinSafety: price >= floorPrice,
  };
}

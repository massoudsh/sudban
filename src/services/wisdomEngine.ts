import {
  CostBreakdown,
  CompetitivePosition,
  PriceSuggestionResult,
  RiskAlertCandidate,
  SalesTrend,
  WisdomInsight,
  WisdomReport,
} from "../types";
import { calculateMargin } from "./marginCalculator";

export interface WisdomInput {
  currentPrice: number;
  costs: CostBreakdown;
  minMarginPct: number;
  competitivePosition: CompetitivePosition;
  suggestion: PriceSuggestionResult;
  risks: RiskAlertCandidate[];
  salesTrend: SalesTrend;
}

const SUGGESTION_GAP_THRESHOLD = 0.05; // ۵٪+ اختلاف قیمت فعلی با پیشنهاد موتور قابل توجه است
const HEALTHY_MARGIN_BUFFER = 0.05; // ۵٪+ بالاتر از حداقل یعنی حاشیه سود «مرتاح»

/**
 * موتور خرد (Wisdom Engine).
 * لایه ترکیبی روی خروجی سایر موتورها (margin/competitive/suggestion/risk) + روند فروش؛
 * بینش‌های اولویت‌بندی‌شده و یک توصیه محوری تولید می‌کند.
 * منطق کامل در docs/wiki/concepts/wisdom-engine.md مستند شده است.
 */
export function generateWisdom(input: WisdomInput): WisdomReport {
  const { currentPrice, costs, minMarginPct, competitivePosition, suggestion, risks, salesTrend } = input;
  const insights: WisdomInsight[] = [];

  const { marginPct } = calculateMargin(costs, currentPrice);

  // ۱) هشدارهای ریسک فعال -> بینش با اولویت بر اساس شدت
  for (const risk of risks) {
    insights.push({
      priority: risk.severity === "CRITICAL" ? "HIGH" : "MEDIUM",
      category: "RISK",
      title: risk.type,
      message: risk.message,
      recommendation:
        risk.type === "LOSS_MAKING"
          ? "قیمت را فوراً حداقل به کف بهای تمام‌شده برسانید یا فروش این محصول را متوقف کنید."
          : risk.type === "LOW_MARGIN"
          ? "قیمت را به سمت پیشنهاد موتور قیمت‌گذاری تنظیم کنید یا بهای تمام‌شده را کاهش دهید."
          : risk.type === "UNCOMPETITIVE_HIGH"
          ? "قیمت را نزدیک‌تر به باند رقبا بیاورید تا ریسک از دست دادن مشتری کاهش یابد."
          : "با احتیاط قیمت را افزایش دهید؛ ورود به جنگ قیمتی در این حاشیه سود پرریسک است.",
    });
  }

  // ۲) اختلاف قیمت فعلی با پیشنهاد موتور قیمت‌گذاری
  const gapPct = (suggestion.suggestedPrice - currentPrice) / currentPrice;
  if (Math.abs(gapPct) >= SUGGESTION_GAP_THRESHOLD) {
    insights.push({
      priority: Math.abs(gapPct) >= 0.15 ? "HIGH" : "MEDIUM",
      category: "OPPORTUNITY",
      title: "فاصله از قیمت پیشنهادی",
      message: `قیمت فعلی (${Math.round(currentPrice).toLocaleString("fa-IR")}) با قیمت پیشنهادی موتور (${Math.round(
        suggestion.suggestedPrice
      ).toLocaleString("fa-IR")}) حدود ${(Math.abs(gapPct) * 100).toFixed(0)}٪ اختلاف دارد.`,
      recommendation:
        gapPct > 0
          ? "بررسی کنید که آیا می‌توانید قیمت را افزایش دهید بدون از دست دادن رقابت‌پذیری."
          : "بررسی کنید که آیا قیمت فعلی بیش از حد بالاست و فرصت فروش بیشتر را از دست می‌دهید.",
    });
  }

  // ۳) حاشیه سود مرتاح (فرصت) — فقط وقتی هیچ ریسکی ثبت نشده و به‌طور معنادار بالاتر از حداقل است
  if (risks.length === 0 && marginPct >= minMarginPct + HEALTHY_MARGIN_BUFFER) {
    insights.push({
      priority: "LOW",
      category: "MARGIN",
      title: "حاشیه سود سالم",
      message: `حاشیه سود فعلی (${(marginPct * 100).toFixed(1)}٪) به‌طور قابل‌توجهی بالاتر از حداقل تعیین‌شده (${(
        minMarginPct * 100
      ).toFixed(1)}٪) است.`,
      recommendation:
        "می‌توانید برای افزایش سهم بازار قیمت را کمی پایین‌تر آزمایش کنید یا این حاشیه را به‌عنوان ذخیره ریسک نگه دارید.",
    });
  }

  // ۴) روند فروش
  if (salesTrend.direction === "DOWN") {
    const marginNearFloor = marginPct < minMarginPct + 0.03;
    insights.push({
      priority: marginNearFloor ? "HIGH" : "MEDIUM",
      category: "TREND",
      title: "روند نزولی فروش",
      message: `میانگین فروش دوره اخیر نسبت به دوره قبل حدود ${Math.abs(
        (salesTrend.changePct ?? 0) * 100
      ).toFixed(0)}٪ کاهش داشته است.`,
      recommendation: marginNearFloor
        ? "چون حاشیه سود هم به کف نزدیک است، افت فروش را جدی بگیرید — بازبینی قیمت یا بررسی رقبای جدید لازم است."
        : "علت افت (فصلی/رقابتی/موجودی) را بررسی کنید؛ در صورت نیاز استراتژی PENETRATION را برای یک دوره کوتاه آزمایش کنید.",
    });
  } else if (salesTrend.direction === "UP") {
    insights.push({
      priority: "LOW",
      category: "OPPORTUNITY",
      title: "روند صعودی فروش",
      message: `میانگین فروش دوره اخیر نسبت به دوره قبل حدود ${((salesTrend.changePct ?? 0) * 100).toFixed(
        0
      )}٪ افزایش داشته است.`,
      recommendation: "تقاضا در حال رشد است؛ می‌توانید استراتژی PREMIUM را آزمایش یا از کافی‌بودن موجودی مطمئن شوید.",
    });
  }

  // ۵) وضعیت پایدار — فقط اگر هیچ بینش دیگری تولید نشده و جایگاه رقابتی خنثی است
  if (
    insights.length === 0 &&
    competitivePosition.currentPricePercentile !== null &&
    competitivePosition.currentPricePercentile >= 35 &&
    competitivePosition.currentPricePercentile <= 65
  ) {
    insights.push({
      priority: "LOW",
      category: "COMPETITIVE",
      title: "وضعیت پایدار",
      message: "قیمت فعلی در میانه باند رقبا و حاشیه سود در محدوده مطلوب قرار دارد.",
      recommendation: "فعلاً نیاز به اقدام فوری نیست؛ وضعیت را به‌صورت دوره‌ای پایش کنید.",
    });
  }

  const priorityRank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  insights.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

  const topRecommendation =
    insights.length > 0 ? insights[0].recommendation : "وضعیت این محصول پایدار است؛ نیاز به اقدام فوری نیست.";

  return { insights, topRecommendation };
}

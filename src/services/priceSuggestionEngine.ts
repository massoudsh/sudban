import { CostBreakdown, CompetitivePosition, PriceSuggestionResult, Strategy } from "../types";
import { calculateMargin, calculatePriceFloor } from "./marginCalculator";

export interface SuggestionInput {
  costs: CostBreakdown;
  minMarginPct: number;
  floorPrice?: number | null;
  ceilingPrice?: number | null;
  strategy: Strategy;
  competitivePosition: CompetitivePosition;
}

/**
 * موتور پیشنهاد قیمت نسخه ۱ (rule-based).
 * منطق کامل در docs/ARCHITECTURE.md بخش ۲.۳ توضیح داده شده است.
 */
export function suggestPrice(input: SuggestionInput): PriceSuggestionResult {
  const { costs, minMarginPct, floorPrice, ceilingPrice, strategy, competitivePosition } = input;
  const rationale: string[] = [];

  const marginCostFloor = calculatePriceFloor(costs, minMarginPct);
  const effectiveFloor = floorPrice != null ? Math.max(marginCostFloor, floorPrice) : marginCostFloor;
  rationale.push(
    `کف قیمت بر اساس حداقل حاشیه سود ${(minMarginPct * 100).toFixed(0)}٪ برابر ${Math.round(
      marginCostFloor
    ).toLocaleString("fa-IR")} است.`
  );

  let anchor: number | null;
  const { min, max, median } = competitivePosition;

  if (median === null) {
    // بدون داده رقیب: صرفاً بر اساس حاشیه سود هدف تصمیم بگیر (استفاده از کف به‌عنوان لنگر)
    anchor = effectiveFloor;
    rationale.push("داده قیمت رقبا موجود نیست؛ پیشنهاد صرفاً بر اساس بهای تمام‌شده و حاشیه سود هدف است.");
  } else {
    switch (strategy) {
      case "MATCH":
        anchor = median;
        rationale.push(`استراتژی «همراستا با بازار»: لنگر قیمت روی میانه رقبا (${Math.round(median).toLocaleString("fa-IR")}) قرار گرفت.`);
        break;
      case "PREMIUM": {
        // به سمت انتهای بالای بازار (نزدیک max) اما نه لزوماً برابر max
        const premiumAnchor = median + (max! - median) * 0.6;
        anchor = premiumAnchor;
        rationale.push(`استراتژی «پرمیوم»: لنگر قیمت به سمت سقف بازار (${Math.round(max!).toLocaleString("fa-IR")}) متمایل شد.`);
        break;
      }
      case "PENETRATION": {
        // به سمت انتهای پایین بازار (نزدیک min) اما هرگز زیر کف هزینه
        const penetrationAnchor = median - (median - min!) * 0.6;
        anchor = penetrationAnchor;
        rationale.push(`استراتژی «نفوذ در بازار»: لنگر قیمت به سمت کف بازار (${Math.round(min!).toLocaleString("fa-IR")}) متمایل شد.`);
        break;
      }
    }
  }

  let suggestedPrice = anchor as number;

  if (suggestedPrice < effectiveFloor) {
    suggestedPrice = effectiveFloor;
    rationale.push("قیمت لنگر پایین‌تر از کف مجاز بود؛ به کف بهای تمام‌شده/حاشیه سود اصلاح شد.");
  }
  if (ceilingPrice != null && suggestedPrice > ceilingPrice) {
    suggestedPrice = ceilingPrice;
    rationale.push(`قیمت به سقف تعیین‌شده توسط فروشنده (${Math.round(ceilingPrice).toLocaleString("fa-IR")}) محدود شد.`);
  }

  const { marginPct } = calculateMargin(costs, suggestedPrice);

  // امتیاز رقابت‌پذیری: هرچه به میانه بازار نزدیک‌تر باشد امتیاز بالاتر؛ بدون داده رقیب امتیاز خنثی است.
  let competitivenessScore = 50;
  if (median !== null && min !== null && max !== null && max > min) {
    const distanceFromMedian = Math.abs(suggestedPrice - median);
    const bandWidth = max - min;
    competitivenessScore = Math.max(0, Math.round(100 - (distanceFromMedian / bandWidth) * 100));
  }

  return {
    suggestedPrice: Math.round(suggestedPrice),
    costFloor: Math.round(effectiveFloor),
    expectedMarginPct: marginPct,
    competitivenessScore,
    strategy,
    rationale,
  };
}

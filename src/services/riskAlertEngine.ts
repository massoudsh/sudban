import { CostBreakdown, CompetitivePosition, RiskAlertCandidate, DEFAULTS } from "../types";
import { calculateMargin } from "./marginCalculator";

export interface RiskCheckInput {
  price: number;
  costs: CostBreakdown;
  minMarginPct: number;
  competitivePosition: CompetitivePosition;
}

/**
 * قوانین هشدار ریسک روی یک قیمت مشخص (فعلی یا پیشنهادی).
 * قوانین در docs/ARCHITECTURE.md بخش ۲.۵ مستند شده‌اند.
 */
export function checkRisks(input: RiskCheckInput): RiskAlertCandidate[] {
  const { price, costs, minMarginPct, competitivePosition } = input;
  const alerts: RiskAlertCandidate[] = [];

  const { trueCost, marginPct } = calculateMargin(costs, price);

  if (price < trueCost) {
    alerts.push({
      type: "LOSS_MAKING",
      severity: "CRITICAL",
      message: `قیمت ${Math.round(price).toLocaleString("fa-IR")} پایین‌تر از بهای تمام‌شده واقعی (${Math.round(
        trueCost
      ).toLocaleString("fa-IR")}) است — این فروش زیان‌ده است.`,
      context: { price, trueCost, marginPct },
    });
  } else if (marginPct < minMarginPct) {
    alerts.push({
      type: "LOW_MARGIN",
      severity: "WARNING",
      message: `حاشیه سود فعلی (${(marginPct * 100).toFixed(1)}٪) کمتر از حداقل تعیین‌شده (${(
        minMarginPct * 100
      ).toFixed(1)}٪) است.`,
      context: { price, marginPct, minMarginPct },
    });
  }

  const { max, min } = competitivePosition;

  if (max !== null && price > max * (1 + DEFAULTS.UNCOMPETITIVE_HIGH_THRESHOLD)) {
    alerts.push({
      type: "UNCOMPETITIVE_HIGH",
      severity: "WARNING",
      message: `قیمت فعلی بیش از ${(DEFAULTS.UNCOMPETITIVE_HIGH_THRESHOLD * 100).toFixed(
        0
      )}٪ بالاتر از بالاترین قیمت رقبا (${Math.round(max).toLocaleString(
        "fa-IR"
      )}) است — ریسک از دست دادن مشتری به دلیل عدم رقابت‌پذیری.`,
      context: { price, competitorMax: max },
    });
  }

  if (
    min !== null &&
    price < min * (1 - DEFAULTS.PRICE_WAR_THRESHOLD) &&
    marginPct < minMarginPct + DEFAULTS.MARGIN_WAR_RISK_BUFFER
  ) {
    alerts.push({
      type: "PRICE_WAR_RISK",
      severity: "WARNING",
      message: `قیمت فعلی به‌طور قابل‌توجهی پایین‌تر از کف بازار (${Math.round(
        min
      ).toLocaleString("fa-IR")}) است و حاشیه سود هم به کف مجاز نزدیک است — ریسک ورود به جنگ قیمتی زیان‌ده.`,
      context: { price, competitorMin: min, marginPct },
    });
  }

  return alerts;
}

import { SalesTrend } from "../types";

const TREND_THRESHOLD = 0.1; // ۱۰٪ تغییر میانگین برای تشخیص روند صعودی/نزولی، وگرنه پایدار
const MIN_RECORDS_FOR_TREND = 4; // با کمتر از این تعداد رکورد، روند قابل اتکا نیست

/**
 * تاریخچه فروش را بر اساس soldAt به دو نیمه (قدیمی/جدید) تقسیم می‌کند و میانگین مقدار فروش
 * هر نیمه را مقایسه می‌کند تا جهت روند فروش مشخص شود.
 */
export function computeSalesTrend(
  salesRecords: { quantity: number; soldAt: Date }[]
): SalesTrend {
  if (salesRecords.length < MIN_RECORDS_FOR_TREND) {
    return { direction: "UNKNOWN", recentAvgQuantity: null, previousAvgQuantity: null, changePct: null };
  }

  const sorted = [...salesRecords].sort((a, b) => a.soldAt.getTime() - b.soldAt.getTime());
  const mid = Math.floor(sorted.length / 2);
  const previousHalf = sorted.slice(0, mid);
  const recentHalf = sorted.slice(mid);

  const avg = (records: { quantity: number }[]) =>
    records.reduce((sum, r) => sum + r.quantity, 0) / records.length;

  const previousAvgQuantity = avg(previousHalf);
  const recentAvgQuantity = avg(recentHalf);

  const changePct =
    previousAvgQuantity > 0 ? (recentAvgQuantity - previousAvgQuantity) / previousAvgQuantity : null;

  let direction: SalesTrend["direction"] = "STABLE";
  if (changePct !== null) {
    if (changePct > TREND_THRESHOLD) direction = "UP";
    else if (changePct < -TREND_THRESHOLD) direction = "DOWN";
  }

  return { direction, recentAvgQuantity, previousAvgQuantity, changePct };
}

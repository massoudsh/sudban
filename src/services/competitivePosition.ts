import { CompetitivePosition } from "../types";

/**
 * از بین قیمت‌های ثبت‌شده رقبا، آخرین قیمت هر رقیب (بر اساس competitorName+channel) را
 * نگه می‌دارد و بر اساس آن باند قیمتی بازار را می‌سازد.
 */
export function computeCompetitivePosition(
  competitorPrices: { competitorName: string; channel: string; price: number; capturedAt: Date }[],
  currentPrice: number | null
): CompetitivePosition {
  const latestByCompetitor = new Map<string, { price: number; capturedAt: Date }>();

  for (const cp of competitorPrices) {
    const key = `${cp.competitorName}::${cp.channel}`;
    const existing = latestByCompetitor.get(key);
    if (!existing || cp.capturedAt > existing.capturedAt) {
      latestByCompetitor.set(key, { price: cp.price, capturedAt: cp.capturedAt });
    }
  }

  const prices = Array.from(latestByCompetitor.values())
    .map((v) => v.price)
    .sort((a, b) => a - b);

  if (prices.length === 0) {
    return { min: null, max: null, median: null, avg: null, sampleSize: 0, currentPricePercentile: null };
  }

  const min = prices[0];
  const max = prices[prices.length - 1];
  const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];

  let currentPricePercentile: number | null = null;
  if (currentPrice !== null) {
    const belowOrEqual = prices.filter((p) => p <= currentPrice).length;
    currentPricePercentile = Math.round((belowOrEqual / prices.length) * 100);
  }

  return { min, max, median, avg, sampleSize: prices.length, currentPricePercentile };
}

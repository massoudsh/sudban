# Pricing Engines (`src/services/*`)

> mirror از `docs/wiki/entities/pricing-engines.md` — منبع حقیقت همان‌جاست.

شش تابع خالص + یک تابع کمکی روند فروش؛ بدون وابستگی مستقیم به Prisma یا Express.

| موتور | فایل | ورودی کلیدی | خروجی |
|---|---|---|---|
| Margin Calculator | `marginCalculator.ts` | `CostBreakdown`, `price` | `MarginResult` + `calculatePriceFloor` |
| Competitive Position | `competitivePosition.ts` | لیست `CompetitorPrice` | `CompetitivePosition` (min/max/median/avg/percentile) |
| Price Suggestion Engine | `priceSuggestionEngine.ts` | costs + minMarginPct + strategy + competitivePosition | `PriceSuggestionResult` با `rationale` |
| Scenario Simulator | `scenarioSimulator.ts` | costs + hypotheticalPrice + baseline + elasticity | `ScenarioResult` |
| Risk Alert Engine | `riskAlertEngine.ts` | price + costs + minMarginPct + competitivePosition | `RiskAlertCandidate[]` |
| Sales Trend (کمکی) | `salesTrend.ts` | لیست `SalesRecord` | `SalesTrend` (UP/DOWN/STABLE/UNKNOWN) |
| **Wisdom Engine** | `wisdomEngine.ts` | خروجی پنج مورد بالا (ترکیبی) | `WisdomReport` — جزئیات: [[Wisdom Engine|Wisdom-Engine]] |

## قراردادها / Edge cases
- `calculateTrueCost` هزینه مرجوعی را با تقسیم بر `(1 - returnRate)` جبران می‌کند.
- `suggestPrice`: بدون داده رقیب، لنگر قیمت = کف بهای تمام‌شده.
- `computeSalesTrend` با کمتر از ۴ رکورد `UNKNOWN` برمی‌گرداند.
- `generateWisdom` نتیجه را persist نمی‌کند (بر خلاف `/suggestion`).

## منابع کد
- `src/services/*.ts` — پیاده‌سازی هر موتور

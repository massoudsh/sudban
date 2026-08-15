# Pricing Engines (`src/services/*`)

> شش تابع خالص (pure function) + یک تابع کمکی روند فروش که منطق اصلی کسب‌وکار سودبان را تشکیل
> می‌دهند؛ بدون وابستگی مستقیم به Prisma یا Express — فقط ورودی/خروجی تایپ‌شده (`src/types.ts`).

## مسئولیت‌ها
| موتور | فایل | ورودی کلیدی | خروجی |
|---|---|---|---|
| Margin Calculator | `marginCalculator.ts` | `CostBreakdown`, `price` | `MarginResult` (trueCost, profit, marginPct) + `calculatePriceFloor` |
| Competitive Position | `competitivePosition.ts` | لیست `CompetitorPrice` | `CompetitivePosition` (min/max/median/avg/percentile) |
| Price Suggestion Engine | `priceSuggestionEngine.ts` | costs + minMarginPct + strategy + competitivePosition | `PriceSuggestionResult` با `rationale` |
| Scenario Simulator | `scenarioSimulator.ts` | costs + hypotheticalPrice + baseline + elasticity | `ScenarioResult` (تغییر مقدار/درآمد/سود) |
| Risk Alert Engine | `riskAlertEngine.ts` | price + costs + minMarginPct + competitivePosition | `RiskAlertCandidate[]` |
| Sales Trend (کمکی) | `salesTrend.ts` | لیست `SalesRecord` (quantity+soldAt) | `SalesTrend` (direction UP/DOWN/STABLE/UNKNOWN + changePct) |
| **Wisdom Engine** | `wisdomEngine.ts` | خروجی پنج مورد بالا (ترکیبی) | `WisdomReport` (`insights[]` اولویت‌بندی‌شده + `topRecommendation`) |

## وابستگی‌ها
- [[concepts/pricing-strategy]] — منطق دقیق فرمول‌های کف قیمت، لنگر قیمت هر استراتژی، و کشش قیمتی
- [[concepts/wisdom-engine]] — منطق کامل قوانین ترکیب بینش‌ها در Wisdom Engine
- [[entities/data-model]] — منبع داده ورودی هر موتور
- [[entities/api-routes]] — این موتورها را از routeها صدا می‌زند

## قراردادها / Edge cases
- `calculateTrueCost` هزینه کالای مرجوعی را با تقسیم بر `(1 - returnRate)` جبران می‌کند؛ اگر
  `returnRate >= 1` خطا می‌دهد.
- `calculatePriceFloor` اگر `commissionRate + minMarginPct >= 1` باشد خطا می‌دهد (ترکیب غیرممکن).
- `suggestPrice`: بدون داده رقیب (`median === null`) لنگر قیمت = کف بهای تمام‌شده.
- `checkRisks` تا ۳ نوع هشدار همزمان می‌تواند برگرداند (loss-making با low-margin هم‌زمان رخ نمی‌دهد چون `else if`).
- `computeSalesTrend` با کمتر از ۴ رکورد فروش `UNKNOWN` برمی‌گرداند (روند غیرقابل‌اتکا).
- `generateWisdom` نتیجه را persist نمی‌کند (بر خلاف `/suggestion`)؛ جزئیات کامل: [[concepts/wisdom-engine]].

## منابع کد
- `src/services/marginCalculator.ts:8,21,35`
- `src/services/competitivePosition.ts:7`
- `src/services/priceSuggestionEngine.ts:17`
- `src/services/scenarioSimulator.ts:16`
- `src/services/riskAlertEngine.ts:15`
- `src/services/salesTrend.ts:11`
- `src/services/wisdomEngine.ts:29`

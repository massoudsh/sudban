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
- `calculateMargin` با `price = 0` (یا منفی) مقدار `marginPct = -Infinity` برمی‌گرداند، نه `NaN`.
- `suggestPrice`: بدون داده رقیب (`median === null`) لنگر قیمت = کف بهای تمام‌شده.
- `suggestPrice`: `suggestedPrice`/`costFloor` همیشه رُند به عدد صحیح‌اند؛ `competitivenessScore` در
  بازه ۰..۱۰۰ کلمپ می‌شود و با باند تک‌قیمتی (`max === min`) روی ۵۰ خنثی می‌ماند.
- `simulateScenario` اگر `baselinePrice <= 0` باشد خطا می‌دهد؛ `expectedQuantity` کف صفر دارد.
- `checkRisks` حداکثر ۳ نوع هشدار همزمان می‌تواند برگرداند (loss-making با low-margin هم‌زمان رخ نمی‌دهد چون `else if`).
  آستانه‌ها اکید هستند (`>` و `<`)، پس مقدار دقیقاً روی مرز هشدار تولید نمی‌کند.
- `computeSalesTrend` با کمتر از ۴ رکورد فروش `UNKNOWN` برمی‌گرداند (روند غیرقابل‌اتکا)؛ اگر میانگین
  نیمه قبلی صفر باشد `changePct = null` و جهت `STABLE` می‌ماند.
- `generateWisdom` نتیجه را persist نمی‌کند (بر خلاف `/suggestion`)؛ جزئیات کامل: [[concepts/wisdom-engine]].

## تست‌های واحد (#1)
هر هفت موتور تست Vitest دارند (`npm test`) — کنار هر سرویس یک `*.test.ts`:
- `marginCalculator.test.ts` — trueCost/margin/floor، صفر و منفی، سربه‌سر، `returnRate >= 1`، مرز
  `commissionRate + minMarginPct = 1`، عدم تجمع خطای گردکردن.
- `competitivePosition.test.ts` — نبود داده رقیب، آخرین قیمت هر رقیب، میانه زوج/فرد، percentile دو سر
  باند، tie زمانی، عدم mutation ورودی.
- `priceSuggestionEngine.test.ts` — سه استراتژی، اصلاح به کف/سقف، رُندکردن، کلمپ امتیاز، باند تک‌قیمتی.
- `scenarioSimulator.test.ts` — baseline صفر/منفی، کشش صفر/منفی/مثبت، کف صفر مقدار، رُندکردن، تقسیم بر صفر.
- `riskAlertEngine.test.ts` — چهار نوع هشدار + مرز دقیق هر آستانه + context عددی هر هشدار.
- `salesTrend.test.ts` — مرز ۴ رکورد، نیمه‌سازی زوج/فرد، آستانه دقیق ۱۰٪، تقسیم بر صفر.
- `wisdomEngine.test.ts` — نگاشت شدت هشدار به اولویت، آستانه‌های ۵٪/۱۵٪ اختلاف قیمت، مرزهای حاشیه سود،
  بازه percentile ۳۵..۶۵، مرتب‌سازی اولویت و توصیه محوری.

## منابع کد
- `src/services/marginCalculator.ts:8,21,35`
- `src/services/competitivePosition.ts:7`
- `src/services/priceSuggestionEngine.ts:17`
- `src/services/scenarioSimulator.ts:16`
- `src/services/riskAlertEngine.ts:15`
- `src/services/salesTrend.ts:11`
- `src/services/wisdomEngine.ts:29`

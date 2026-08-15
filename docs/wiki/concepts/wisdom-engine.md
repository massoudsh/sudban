# Wisdom Engine — منطق ترکیب بینش‌ها

> لایه ترکیبی (synthesis) روی خروجی پنج موتور دیگر + یک سیگنال تازه (روند فروش)؛ به‌جای چند عدد
> پراکنده، یک لیست بینش اولویت‌بندی‌شده و یک توصیه محوری تولید می‌کند.

## ورودی‌ها
- خروجی `checkRisks` (ریسک‌های فعال روی قیمت فعلی)
- خروجی `suggestPrice` (قیمت پیشنهادی موتور با همان استراتژی فعال)
- `marginPct` فعلی (از `calculateMargin`)
- `SalesTrend` — سیگنال جدید از `src/services/salesTrend.ts` (نه از موتورهای قبلی)
- `CompetitivePosition.currentPricePercentile`

## قوانین تولید بینش (به ترتیب بررسی)
1. **هر ریسک فعال** → یک `WisdomInsight` با دسته `RISK`؛ اولویت `HIGH` اگر severity=`CRITICAL`، وگرنه `MEDIUM`.
2. **فاصله قیمت فعلی از پیشنهاد موتور** ≥۵٪ → دسته `OPPORTUNITY`؛ اگر ≥۱۵٪ اولویت `HIGH` وگرنه `MEDIUM`.
3. **حاشیه سود سالم** (فقط اگر هیچ ریسکی فعال نیست و `marginPct ≥ minMarginPct + 0.05`) → دسته `MARGIN`, اولویت `LOW`.
4. **روند فروش نزولی** (`SalesTrend.direction === "DOWN"`) → دسته `TREND`؛ اولویت `HIGH` اگر حاشیه هم نزدیک کف باشد (`marginPct < minMarginPct + 0.03`), وگرنه `MEDIUM`.
5. **روند فروش صعودی** → دسته `OPPORTUNITY`, اولویت `LOW`.
6. **وضعیت پایدار** — فقط اگر هیچ‌کدام از موارد بالا بینشی تولید نکردند و `currentPricePercentile` بین ۳۵ تا ۶۵ است → دسته `COMPETITIVE`, اولویت `LOW`.

خروجی نهایی بر اساس اولویت مرتب می‌شود (`HIGH` > `MEDIUM` > `LOW`) و `topRecommendation` = توصیه اولین آیتم لیست (یا پیام خنثی اگر لیست خالی بماند).

## SalesTrend (سیگنال جدید، مستقل)
تاریخچه `SalesRecord` را بر اساس `soldAt` به دو نیمه مساوی تقسیم می‌کند (قدیمی/جدید) و میانگین
`quantity` هر نیمه را مقایسه می‌کند:
- کمتر از ۴ رکورد → `UNKNOWN`
- تغییر ≥+۱۰٪ → `UP`
- تغییر ≤-۱۰٪ → `DOWN`
- در غیر این صورت → `STABLE`

## تفاوت با `/suggestion` و `/alerts`
- `/suggestion` نتیجه را در `PriceSuggestion` persist می‌کند؛ `/wisdom` **persist نمی‌کند** (مثل `/margin`، صرفاً محاسبه لحظه‌ای) — برای جلوگیری از رکورد تکراری در هر بار مشاهده داشبورد.
- `/alerts` رکورد `Alert` در DB باز/بسته می‌کند؛ `/wisdom` مستقیماً از `checkRisks` (بدون DB side-effect) استفاده می‌کند، چون فقط نیاز به candidate لحظه‌ای دارد نه تاریخچه.

## وابستگی‌ها
- [[entities/pricing-engines]] — پنج موتور ورودی + `salesTrend.ts`
- [[entities/api-routes]] — `GET /products/:id/wisdom` در `pricingRouter`
- [[concepts/pricing-strategy]] — منطق `suggestPrice` که به‌عنوان یکی از ورودی‌ها استفاده می‌شود

## منابع کد
- `src/services/wisdomEngine.ts:29` — تابع اصلی `generateWisdom`
- `src/services/salesTrend.ts:11` — تابع `computeSalesTrend`
- `src/routes/pricing.ts` — endpoint `GET /:id/wisdom`

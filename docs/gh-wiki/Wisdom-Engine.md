# Wisdom Engine — منطق ترکیب بینش‌ها

> mirror از `docs/wiki/concepts/wisdom-engine.md` — منبع حقیقت همان‌جاست.

لایه ترکیبی (synthesis) روی خروجی پنج موتور دیگر ([[Pricing Engines|Pricing-Engines]]) + یک سیگنال
تازه (روند فروش)؛ به‌جای چند عدد پراکنده، یک لیست بینش اولویت‌بندی‌شده و یک توصیه محوری تولید می‌کند.

## قوانین تولید بینش (به ترتیب بررسی)
1. هر ریسک فعال ([[Pricing Strategy|Pricing-Strategy]]) → دسته `RISK`؛ `HIGH` اگر CRITICAL وگرنه `MEDIUM`.
2. فاصله قیمت فعلی از پیشنهاد موتور ≥۵٪ → دسته `OPPORTUNITY`؛ ≥۱۵٪ اولویت `HIGH`.
3. حاشیه سود سالم (بدون ریسک فعال، ≥۵٪ بالاتر از حداقل) → دسته `MARGIN`, اولویت `LOW`.
4. روند فروش نزولی → دسته `TREND`؛ `HIGH` اگر حاشیه هم نزدیک کف باشد.
5. روند فروش صعودی → دسته `OPPORTUNITY`, اولویت `LOW`.
6. وضعیت پایدار (هیچ‌کدام از بالا، percentile بین ۳۵-۶۵) → دسته `COMPETITIVE`, اولویت `LOW`.

خروجی بر اساس اولویت مرتب می‌شود؛ `topRecommendation` = توصیه اولین آیتم.

## Sales Trend
تاریخچه فروش را به دو نیمه (قدیمی/جدید) تقسیم و میانگین مقدار هر نیمه را مقایسه می‌کند:
کمتر از ۴ رکورد → `UNKNOWN`؛ تغییر ≥+۱۰٪ → `UP`؛ ≤-۱۰٪ → `DOWN`؛ وگرنه `STABLE`.

## تفاوت با `/suggestion` و `/alerts`
`/wisdom` بر خلاف `/suggestion` نتیجه را در دیتابیس persist نمی‌کند (مثل `/margin`).

## منابع کد
- `src/services/wisdomEngine.ts`
- `src/services/salesTrend.ts`
- `src/routes/pricing.ts` — endpoint `GET /:id/wisdom`

# Pricing Strategy — منطق استراتژی‌های قیمت‌گذاری

> flow تصمیم‌گیری کامل موتور پیشنهاد قیمت، از کف بهای تمام‌شده تا لنگر استراتژی و مدل کشش قیمتی.

## کف قیمت (Price Floor)
از حل معادله `(price - trueCost(price)) / price = minMarginPct` به‌دست می‌آید:
```
priceFloor = fixedCosts / (1 - commissionRate - minMarginPct)
```
اگر `floorPrice` دستی فروشنده تعیین شده باشد، کف نهایی = `max(marginCostFloor, floorPrice)`.

## سه استراتژی (لنگر قیمت روی باند رقبا)
| استراتژی | لنگر |
|---|---|
| `MATCH` | دقیقاً روی میانه (median) قیمت رقبا |
| `PREMIUM` | `median + (max - median) * 0.6` — متمایل به سقف بازار |
| `PENETRATION` | `median - (median - min) * 0.6` — متمایل به کف بازار |

بدون داده رقیب (`median === null`)، لنگر = کف بهای تمام‌شده و rationale شفاف اعلام می‌کند که تصمیم
صرفاً بر اساس هزینه است، نه رقابت.

پس از تعیین لنگر: اگر زیر کف افتاد → اصلاح به کف؛ اگر `ceilingPrice` دستی وجود دارد و لنگر بالاتر
رفت → اصلاح به سقف.

## مدل کشش قیمتی (Scenario Simulator)
کشش ثابت فرض می‌شود:
```
%ΔQuantity = elasticity * %ΔPrice
```
پیش‌فرض `elasticity` در `DEFAULTS.PRICE_ELASTICITY` (`src/types.ts`) است؛ هر محصول می‌تواند
`priceElasticity` سفارشی در `PricingRule` داشته باشد.

## قوانین هشدار ریسک (Risk Alert Engine)
- `price < trueCost` → `LOSS_MAKING` (CRITICAL)
- در غیر این صورت `marginPct < minMarginPct` → `LOW_MARGIN` (WARNING)
- `price > max * (1 + UNCOMPETITIVE_HIGH_THRESHOLD)` → `UNCOMPETITIVE_HIGH`
- `price < min * (1 - PRICE_WAR_THRESHOLD)` **و** حاشیه نزدیک کف مجاز → `PRICE_WAR_RISK`

## وابستگی‌ها
- [[entities/pricing-engines]] — پیاده‌سازی این منطق در `priceSuggestionEngine.ts`, `scenarioSimulator.ts`, `riskAlertEngine.ts`
- [[entities/data-model]] — `PricingRule.strategy`, `PricingRule.priceElasticity`

## منابع کد
- `src/services/priceSuggestionEngine.ts:21-68`
- `src/services/scenarioSimulator.ts:23-27`
- `src/services/riskAlertEngine.ts:15-72`
- `docs/ARCHITECTURE.md` بخش ۲.۳ و ۲.۵ — توضیح روایی همین فرمول‌ها

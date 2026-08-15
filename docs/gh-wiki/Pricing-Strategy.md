# Pricing Strategy — منطق استراتژی‌های قیمت‌گذاری

> mirror از `docs/wiki/concepts/pricing-strategy.md` — منبع حقیقت همان‌جاست.

## کف قیمت (Price Floor)
```
priceFloor = fixedCosts / (1 - commissionRate - minMarginPct)
```
اگر `floorPrice` دستی فروشنده تعیین شده باشد، کف نهایی = `max(marginCostFloor, floorPrice)`.

## سه استراتژی (لنگر قیمت روی باند رقبا)
| استراتژی | لنگر |
|---|---|
| `MATCH` | دقیقاً روی میانه (median) قیمت رقبا |
| `PREMIUM` | `median + (max - median) * 0.6` |
| `PENETRATION` | `median - (median - min) * 0.6` |

بدون داده رقیب، لنگر = کف بهای تمام‌شده.

## مدل کشش قیمتی
```
%ΔQuantity = elasticity * %ΔPrice
```

## قوانین هشدار ریسک
- `price < trueCost` → `LOSS_MAKING` (CRITICAL)
- `marginPct < minMarginPct` → `LOW_MARGIN` (WARNING)
- `price > max * 1.15` → `UNCOMPETITIVE_HIGH`
- `price < min * 0.85` و حاشیه نزدیک کف → `PRICE_WAR_RISK`

این ریسک‌ها یکی از ورودی‌های [[Wisdom Engine|Wisdom-Engine]] هستند.

## منابع کد
- `src/services/priceSuggestionEngine.ts`, `scenarioSimulator.ts`, `riskAlertEngine.ts`

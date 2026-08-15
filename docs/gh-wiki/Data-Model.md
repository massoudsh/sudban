# Data Model (Prisma / PostgreSQL)

> mirror از `docs/wiki/entities/data-model.md` — منبع حقیقت همان‌جاست.

## مدل‌ها
| مدل | نقش | نکته کلیدی |
|---|---|---|
| `Seller` | فروشنده (صاحب حساب) | `email` یکتا |
| `Product` | محصول یک فروشنده | `@@unique([sellerId, sku])`؛ `currentPrice` برای محاسبه سریع |
| `CostProfile` | بهای تمام‌شده **نسخه‌بندی‌شده** | چون اقتصاد ایران نوسان هزینه سریع دارد؛ رکورد جدید اضافه می‌شود، `isActive=true` روی جدیدترین |
| `PricingRule` | قاعده قیمت‌گذاری هر محصول (۱به۱) | `minMarginPct`, `floorPrice`/`ceilingPrice` دستی، `strategy`, `priceElasticity` اختیاری |
| `CompetitorPrice` | قیمت رقیب در یک کانال/زمان | `channel` مثل digikala/basalam/torob |
| `SalesRecord` | تراکنش/دوره فروش واقعی | ورودی مدل کشش قیمتی در شبیه‌سازی و [[Wisdom Engine|Wisdom-Engine]] |
| `PriceSuggestion` | خروجی ذخیره‌شده موتور پیشنهاد قیمت | `rationale` به‌صورت آرایه JSON از دلایل |
| `Alert` | هشدار ریسک صادرشده روی یک محصول | `type` (LOSS_MAKING/LOW_MARGIN/UNCOMPETITIVE_HIGH/PRICE_WAR_RISK), `severity` |

## قراردادها / Edge cases
- `CostProfile` هرگز update نمی‌شود؛ برای تغییر هزینه، رکورد جدید با `isActive=true` اضافه می‌شود.
- تمام مبالغ به ریال (`IRR` پیش‌فرض) و از نوع `Float` هستند.
- حذف `Seller` یا `Product` به‌صورت Cascade روی فرزندان اثر می‌گذارد.

## منابع کد
- `prisma/schema.prisma:31-170`
- `docs/ARCHITECTURE.md` بخش ۲-۳

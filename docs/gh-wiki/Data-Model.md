# Data Model (Prisma / PostgreSQL)

> mirror از `docs/wiki/entities/data-model.md` — منبع حقیقت همان‌جاست.

## مدل‌ها
| مدل | نقش | نکته کلیدی |
|---|---|---|
| `Seller` | فروشنده (صاحب حساب) | `email` یکتا؛ `passwordHash`، `role`، `lastDigestAt` |
| `Product` | محصول یک فروشنده | `@@unique([sellerId, sku])`؛ `currentPrice` + `stockQuantity`/`reorderPoint`/`handlingTimeDays` |
| `CostProfile` | بهای تمام‌شده **نسخه‌بندی‌شده** | چون اقتصاد ایران نوسان هزینه سریع دارد؛ رکورد جدید اضافه می‌شود، `isActive=true` روی جدیدترین |
| `PricingRule` | قاعده قیمت‌گذاری هر محصول (۱به۱) | `minMarginPct`, `floorPrice`/`ceilingPrice` دستی، `mapPrice` (حداقل قیمت تبلیغ‌شده)، `strategy`, `priceElasticity` اختیاری |
| `CompetitorPrice` | قیمت رقیب در یک کانال/زمان | `channel` مثل digikala/basalam/torob؛ `inStock` و `matchConfidence` |
| `SalesRecord` | تراکنش/دوره فروش واقعی | `unitCostSnapshot` (nullable) + پنج ستون کسورات واقعی؛ بدون snapshot سود `null` |
| `PriceSuggestion` | خروجی ذخیره‌شده موتور پیشنهاد قیمت | `rationale` به‌صورت آرایه JSON از دلایل |
| `Alert` | هشدار ریسک صادرشده روی یک محصول | `type` (LOSS_MAKING/LOW_MARGIN/UNCOMPETITIVE_HIGH/PRICE_WAR_RISK), `severity` |
| `SellerTeamMember` | عضو تیم فروشنده | نقش RBAC + کلید API مستقل عضو |
| `SellerSession` | نشست حساب | `tokenHash` (SHA256، یکتا) + `expiresAt`؛ توکن خام ذخیره نمی‌شود |
| `PriceApproval` | چرخه تأیید قیمت | `previousPrice`/`proposedPrice`/`expectedMarginPct`/`reason` + `status` |
| `IntegrationJob` | صف sync رقیب و price-push | نوع، وضعیت، کانال، payload/result/error |
| `EconomicSignal` | سیگنال نرخ ارز/تورم | ورودی پیشنهاد تعدیل CostProfile |
| `UsageEvent` | رخداد مصرف برای metering | type + quantity + metadata |
| `Subscription` | اشتراک فعال/تاریخی | پلن، سقف SKU، درخواست‌های included و قیمت overage |

## قراردادها / Edge cases
- `CostProfile` هرگز update نمی‌شود؛ برای تغییر هزینه، رکورد جدید با `isActive=true` اضافه می‌شود.
- تمام مبالغ به ریال (`IRR` پیش‌فرض) و از نوع `Float` هستند.
- حذف `Seller` یا `Product` به‌صورت Cascade روی فرزندان اثر می‌گذارد.
- `PriceApproval.status` رشته است: `RECOMMENDED → APPROVED|REJECTED → APPLIED → ROLLED_BACK`.
- migration پایه `20260101000000_init` برای دیتابیس تازه اضافه شد؛ دیتابیس قدیمی باید با `prisma migrate resolve --applied` علامت بخورد.

## منابع کد
- `prisma/schema.prisma`
- `prisma/migrations/` — baseline + دو migration بعدی
- `docs/ARCHITECTURE.md` بخش ۲-۳

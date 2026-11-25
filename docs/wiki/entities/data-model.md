# Data Model (Prisma / PostgreSQL)

> همه‌ی مدل‌های اصلی دیتابیس سودبان، یک‌جا (چون همگی یک اسکیمای واحد و به‌شدت به‌هم‌مرتبط‌اند).

## مسئولیت‌ها
- نگهداری فروشندگان، تیم/نقش‌ها، محصولات، بهای تمام‌شده نسخه‌بندی‌شده، قواعد قیمت‌گذاری، قیمت رقبا،
  تاریخچه فروش، پیشنهادهای قیمت، هشدارهای ریسک، jobهای integration، سیگنال‌های اقتصادی و مصرف billing.

## مدل‌ها
| مدل | نقش | نکته کلیدی |
|---|---|---|
| `Seller` | فروشنده (صاحب حساب) | `email` یکتا؛ `passwordHash` و `role` از commit `33638fd`؛ `lastDigestAt` برای خلاصه روزانه |
| `Product` | محصول یک فروشنده | `@@unique([sellerId, sku])`؛ `currentPrice`، و از `ef28008` سه فیلد `stockQuantity`/`reorderPoint`/`handlingTimeDays` |
| `CostProfile` | بهای تمام‌شده **نسخه‌بندی‌شده** | چون اقتصاد ایران نوسان هزینه سریع دارد؛ رکورد جدید اضافه می‌شود، `isActive=true` روی جدیدترین |
| `PricingRule` | قاعده قیمت‌گذاری هر محصول (۱به۱) | `minMarginPct`, `floorPrice`/`ceilingPrice` دستی، `mapPrice` (حداقل قیمت تبلیغ‌شده)، `strategy`, `priceElasticity` اختیاری |
| `CompetitorPrice` | قیمت رقیب در یک کانال/زمان | `channel` مثل digikala/basalam/torob؛ `inStock` و `matchConfidence` (پیش‌فرض ۱) از `33638fd` |
| `SalesRecord` | تراکنش/دوره فروش واقعی | `unitCostSnapshot` (nullable) + پنج ستون کسورات واقعی؛ بدون snapshot سود `null` می‌ماند |
| `PriceSuggestion` | خروجی ذخیره‌شده موتور پیشنهاد قیمت | `rationale` به‌صورت آرایه JSON از دلایل |
| `Alert` | هشدار ریسک صادرشده روی یک محصول | `type` (LOSS_MAKING/LOW_MARGIN/UNCOMPETITIVE_HIGH/PRICE_WAR_RISK), `severity` |
| `SellerTeamMember` | عضو/دعوت سازمانی فروشنده | نقش RBAC + کلید API مستقل (`apiKeyPrefix`/`apiKeyHash`) برای login عضو |
| `SellerSession` | نشست حساب | `tokenHash` (SHA256، یونیک) + `expiresAt`؛ توکن خام ذخیره نمی‌شود |
| `PriceApproval` | چرخه تأیید قیمت | `previousPrice`/`proposedPrice`/`expectedMarginPct`/`reason` + `status` رشته‌ای |
| `IntegrationJob` | صف job برای sync رقیب و price-push | نوع job، وضعیت، کانال، payload/result/error |
| `EconomicSignal` | سیگنال نرخ ارز/تورم فروشنده | ورودی پیشنهاد تعدیل CostProfile |
| `UsageEvent` | رخداد مصرف برای metering | type + quantity + metadata |
| `Subscription` | اشتراک فعال/تاریخی فروشنده | پلن، سقف SKU، درخواست‌های included و قیمت overage |

## وابستگی‌ها
- [[entities/pricing-engines]] — این مدل‌ها ورودی/خروجی مستقیم پنج موتور هستند
- [[entities/api-routes]] — هر route روی یک یا چند مدل CRUD انجام می‌دهد
- [[concepts/deployment]] — زنجیره migration و baseline برای دیتابیس تازه

## قراردادها / Edge cases
- `CostProfile` هرگز update نمی‌شود؛ برای تغییر هزینه، رکورد جدید با `isActive=true` اضافه و
  قبلی `isActive=false` می‌شود (تاریخچه حفظ می‌شود).
- تمام مبالغ به ریال (`IRR` پیش‌فرض) و از نوع `Float` هستند.
- حذف `Seller` یا `Product` به‌صورت Cascade روی فرزندان اثر می‌گذارد (`onDelete: Cascade`).
- `PriceApproval.status` عمداً `String` است نه enum: `RECOMMENDED → APPROVED|REJECTED → APPLIED → ROLLED_BACK`.
- migration پایه `20260101000000_init` پس از pull اضافه شد؛ دیتابیس‌های قدیمی باید با `prisma migrate resolve --applied` علامت بخورند.

## منابع کد
- `prisma/schema.prisma:31-317` — تعریف مدل‌ها و enumهای فروشنده، محصول، pricing، integration و billing
- `docs/ARCHITECTURE.md` بخش ۲-۳ — توضیح تصمیم‌های طراحی اسکیما

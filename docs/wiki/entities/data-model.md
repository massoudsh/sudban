# Data Model (Prisma / PostgreSQL)

> همه‌ی مدل‌های اصلی دیتابیس سودبان، یک‌جا (چون همگی یک اسکیمای واحد و به‌شدت به‌هم‌مرتبط‌اند).

## مسئولیت‌ها
- نگهداری فروشندگان، تیم/نقش‌ها، محصولات، بهای تمام‌شده نسخه‌بندی‌شده، قواعد قیمت‌گذاری، قیمت رقبا،
  تاریخچه فروش، پیشنهادهای قیمت، هشدارهای ریسک، jobهای integration، سیگنال‌های اقتصادی و مصرف billing.

## مدل‌ها
| مدل | نقش | نکته کلیدی |
|---|---|---|
| `Seller` | فروشنده (صاحب حساب) | `email` یکتا |
| `Product` | محصول یک فروشنده | `@@unique([sellerId, sku])`؛ `currentPrice` برای محاسبه سریع |
| `CostProfile` | بهای تمام‌شده **نسخه‌بندی‌شده** | چون اقتصاد ایران نوسان هزینه سریع دارد؛ رکورد جدید اضافه می‌شود، `isActive=true` روی جدیدترین |
| `PricingRule` | قاعده قیمت‌گذاری هر محصول (۱به۱) | `minMarginPct`, `floorPrice`/`ceilingPrice` دستی، `strategy`, `priceElasticity` اختیاری |
| `CompetitorPrice` | قیمت رقیب در یک کانال/زمان | `channel` مثل digikala/basalam/torob |
| `SalesRecord` | تراکنش/دوره فروش واقعی | ورودی مدل کشش قیمتی در شبیه‌سازی |
| `PriceSuggestion` | خروجی ذخیره‌شده موتور پیشنهاد قیمت | `rationale` به‌صورت آرایه JSON از دلایل |
| `Alert` | هشدار ریسک صادرشده روی یک محصول | `type` (LOSS_MAKING/LOW_MARGIN/UNCOMPETITIVE_HIGH/PRICE_WAR_RISK), `severity` |
| `SellerTeamMember` | عضو/دعوت سازمانی فروشنده | نقش‌های `OWNER`/`MANAGER`/`ANALYST`/`VIEWER` برای RBAC |
| `IntegrationJob` | صف job برای sync رقیب و price-push | نوع job، وضعیت، کانال، payload/result/error |
| `EconomicSignal` | سیگنال نرخ ارز/تورم فروشنده | ورودی پیشنهاد تعدیل CostProfile |
| `UsageEvent` | رخداد مصرف برای metering | type + quantity + metadata |
| `Subscription` | اشتراک فعال/تاریخی فروشنده | پلن، سقف SKU، درخواست‌های included و قیمت overage |

## وابستگی‌ها
- [[entities/pricing-engines]] — این مدل‌ها ورودی/خروجی مستقیم پنج موتور هستند
- [[entities/api-routes]] — هر route روی یک یا چند مدل CRUD انجام می‌دهد

## قراردادها / Edge cases
- `CostProfile` هرگز update نمی‌شود؛ برای تغییر هزینه، رکورد جدید با `isActive=true` اضافه و
  قبلی `isActive=false` می‌شود (تاریخچه حفظ می‌شود).
- تمام مبالغ به ریال (`IRR` پیش‌فرض) و از نوع `Float` هستند.
- حذف `Seller` یا `Product` به‌صورت Cascade روی فرزندان اثر می‌گذارد (`onDelete: Cascade`).

## منابع کد
- `prisma/schema.prisma:31-317` — تعریف مدل‌ها و enumهای فروشنده، محصول، pricing، integration و billing
- `docs/ARCHITECTURE.md` بخش ۲-۳ — توضیح تصمیم‌های طراحی اسکیما

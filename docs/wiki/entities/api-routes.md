# API Routes (`src/routes/*` + `src/server.ts`)

> هفت روتر Express؛ همه به‌جز `sellers` زیر پیشوند `/products/:id/...` mount شده‌اند.

## مسئولیت‌ها
| روتر | مسیر پایه | عملیات |
|---|---|---|
| `sellersRouter` | `/sellers` | ساخت فروشنده، لیست محصولات فروشنده |
| `productsRouter` | `/products` | CRUD محصول |
| `costsRouter` | `/products/:id/costs` | ثبت/تاریخچه `CostProfile` |
| `pricingRulesRouter` | `/products/:id/pricing-rule` | تعیین/دریافت `PricingRule` |
| `competitorsRouter` | `/products/:id/competitor-prices` | ثبت/دریافت `CompetitorPrice` |
| `salesRouter` | `/products/:id/sales` | ثبت/دریافت `SalesRecord` |
| `pricingRouter` | `/products/:id/margin`, `/suggestion`, `/simulate`, `/alerts` | صدا زدن موتورهای قیمت‌گذاری |

## وابستگی‌ها
- [[entities/pricing-engines]] — `pricingRouter` مستقیماً این موتورها را فراخوانی می‌کند
- [[entities/data-model]] — همه روترها روی مدل‌های Prisma عمل می‌کنند
- `src/lib/productContext.ts` — helper مشترک برای بارگذاری محصول + آخرین CostProfile فعال + PricingRule

## قراردادها / Edge cases
- خطاهای مدیریت‌نشده در هندلر مرکزی `server.ts:26` گرفته می‌شوند و پیام فارسی عمومی برمی‌گردانند.
- چهار روتر (`costs`, `pricingRules`, `competitors`, `sales`, `pricing`) همگی زیر `/products` mount
  شده‌اند و مسیر داخلی خودشان را با `/:id/...` تعریف می‌کنند (`server.ts:19-23`).

## منابع کد
- `src/server.ts:16-23` — نقطه mount همه روترها
- `src/routes/*.ts` — پیاده‌سازی هر روتر
- نمونه جریان کامل curl: `README.md`

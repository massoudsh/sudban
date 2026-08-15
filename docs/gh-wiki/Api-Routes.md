# API Routes (`src/routes/*` + `src/server.ts`)

> mirror از `docs/wiki/entities/api-routes.md` — منبع حقیقت همان‌جاست.

هفت روتر Express؛ همه به‌جز `sellers` زیر پیشوند `/products/:id/...` mount شده‌اند.

| روتر | مسیر پایه | عملیات |
|---|---|---|
| `sellersRouter` | `/sellers` | ساخت فروشنده، لیست محصولات فروشنده |
| `productsRouter` | `/products` | CRUD محصول |
| `costsRouter` | `/products/:id/costs` | ثبت/تاریخچه `CostProfile` |
| `pricingRulesRouter` | `/products/:id/pricing-rule` | تعیین/دریافت `PricingRule` |
| `competitorsRouter` | `/products/:id/competitor-prices` | ثبت/دریافت `CompetitorPrice` |
| `salesRouter` | `/products/:id/sales` | ثبت/دریافت `SalesRecord` |
| `pricingRouter` | `/products/:id/margin`, `/suggestion`, `/simulate`, `/alerts`, `/wisdom` | صدا زدن موتورهای قیمت‌گذاری |

## قراردادها / Edge cases
- خطاهای مدیریت‌نشده در هندلر مرکزی `server.ts` گرفته می‌شوند.
- `GET /:id/wisdom` نتیجه را persist نمی‌کند — جزئیات: [[Wisdom Engine|Wisdom-Engine]].

## منابع کد
- `src/server.ts` — نقطه mount همه روترها
- `src/routes/*.ts` — پیاده‌سازی هر روتر

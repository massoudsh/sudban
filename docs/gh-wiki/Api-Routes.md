# API Routes (`src/routes/*` + `src/server.ts`)

> mirror از `docs/wiki/entities/api-routes.md` — منبع حقیقت همان‌جاست.

هشت روتر Express؛ همه به‌جز `sellers` زیر پیشوند `/products` mount شده‌اند و مسیر داخلی خودشان را
با `/:id/...` تعریف می‌کنند.

| روتر | مسیر پایه | عملیات |
|---|---|---|
| `sellersRouter` | `/sellers` | ساخت فروشنده + صدور کلید API، اطلاعات فروشنده، تنظیم کانال هشدار، لیست محصولات فروشنده |
| `productsRouter` | `/products` | CRUD محصول |
| `costsRouter` | `/products/:id/costs` | ثبت/تاریخچه `CostProfile` |
| `pricingRulesRouter` | `/products/:id/pricing-rule` | تعیین/دریافت `PricingRule` |
| `competitorsRouter` | `/products/:id/competitor-prices` | ثبت/دریافت `CompetitorPrice` |
| `salesRouter` | `/products/:id/sales` | ثبت/دریافت `SalesRecord` |
| `pricingRouter` | `/products/:id/margin`, `/suggestion`, `/simulate`, `/alerts`, `/wisdom` | صدا زدن موتورهای قیمت‌گذاری |
| `bulkImportRouter` | `/products/bulk-import?type=...` | import دسته‌ای CSV/JSON برای سه مدل |

## قراردادها / Edge cases
- **زنجیره میان‌افزار:** `helmet` → `cors` (allowlist از `CORS_ORIGINS`) → `rateLimit` سراسری →
  `express.json({ limit: JSON_BODY_LIMIT })` → routeها. هیچ route ای اعتبارسنجی دستی ورودی ندارد؛
  اعتبارسنجی فقط از طریق `validate(schema, source)` در `src/lib/validate.ts` انجام می‌شود (#2).
- **پاسخ خطای اعتبارسنجی:** `400 { error: "ورودی نامعتبر است", details: [{ path, message }] }` —
  شکل یکسان در همه routeها. خطاهای business-logic همان `400 { error: "<پیام فارسی>" }` بدون
  `details` باقی مانده‌اند.
- خطاهای سطح کلاینت body-parser (JSON نامعتبر `400`، بدنه بزرگ `413`، محتوای ناپشتیبانی‌شده `415`)
  در هندلر مرکزی `server.ts` به همان کد وضعیت نگاشت می‌شوند و به `500` تبدیل نمی‌شوند.
- سایر خطاهای مدیریت‌نشده در هندلر مرکزی `server.ts` گرفته می‌شوند.
- **محدودیت‌های محافظتی (#5):** rate limit سراسری، سقف اندازه بدنه، و تایم‌اوت‌های سرور — همه از env
  قابل تنظیم با پیش‌فرض مستندشده در `README.md`؛ مقدار خالی/نامعتبر/غیرمثبت به پیش‌فرض برمی‌گردد.
- `POST /products/bulk-import`: `type` با `bulkImportQuerySchema` اعتبارسنجی می‌شود؛ سپس بدنه یا
  `text/csv` خام یا JSON `{ rows: [...] }`؛ حداکثر ۵۰۰۰ ردیف؛ خطای هر ردیف جداگانه گزارش می‌شود.
- `GET /:id/wisdom` نتیجه را persist نمی‌کند — جزئیات: [[Wisdom Engine|Wisdom-Engine]].

## منابع کد
- `src/server.ts` — نمونه‌سازی اپ، زنجیره میان‌افزار، mount روترها، هندلر خطا، تایم‌اوت‌ها
- `src/routes/*.ts` — پیاده‌سازی هر روتر
- `src/lib/validate.ts` — میان‌افزار اعتبارسنجی zod

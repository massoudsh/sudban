# API Routes (`src/routes/*` + `src/server.ts`)

> دوازده روتر Express؛ routeهای محصول زیر `/products`، routeهای فروشنده زیر `/sellers` و dashboard/billing/economic در سطح ریشه mount شده‌اند.

## مسئولیت‌ها
| روتر | مسیر پایه | عملیات |
|---|---|---|
| `sellersRouter` | `/sellers` | ساخت فروشنده + صدور کلید API، اطلاعات فروشنده، تنظیم کانال هشدار، مدیریت team/subscription/usage |
| `productsRouter` | `/products` | CRUD محصول |
| `costsRouter` | `/products/:id/costs` | ثبت/تاریخچه `CostProfile` |
| `pricingRulesRouter` | `/products/:id/pricing-rule` | تعیین/دریافت `PricingRule` |
| `competitorsRouter` | `/products/:id/competitor-prices` | ثبت/دریافت `CompetitorPrice` |
| `salesRouter` | `/products/:id/sales` | ثبت/دریافت `SalesRecord` |
| `pricingRouter` | `/products/:id/margin`, `/suggestion`, `/ml-suggestion`, `/simulate`, `/alerts`, `/wisdom` | صدا زدن موتورهای قیمت‌گذاری |
| `bulkImportRouter` | `/products/bulk-import?type=...` | import دسته‌ای CSV/JSON برای سه مدل |
| `integrationsRouter` | `/products/:id/competitor-sync-jobs`, `/price-push-jobs`, `/products/integration-jobs` | صف integration و price-push |
| `economicSignalsRouter` | `/economic-signals`, `/products/:id/cost-adjustment-proposal` | ثبت سیگنال اقتصادی و پیشنهاد تعدیل هزینه |
| `dashboardRouter` | `/dashboard/wisdom` | کارت‌های Wisdom برای dashboard |
| `billingRouter` | `/billing/plans`, `/billing/usage-events` | پلن‌ها و رخدادهای مصرف |

## وابستگی‌ها
- [[entities/pricing-engines]] — `pricingRouter` مستقیماً این موتورها را فراخوانی می‌کند
- [[concepts/wisdom-engine]] — منطق endpoint `GET /:id/wisdom`
- [[entities/data-model]] — همه روترها روی مدل‌های Prisma عمل می‌کنند
- `src/lib/productContext.ts` — helper مشترک برای بارگذاری محصول + آخرین CostProfile فعال + PricingRule
- `src/lib/auth.ts` — `requireAuth` (کلید API)، `requireOwnedProduct` (مالکیت) و `requireRole` (RBAC): روی routeهای
  محافظت‌شده اعمال می‌شود
- `src/lib/validate.ts` — میان‌افزار اعتبارسنجی zod روی `body`/`query`؛ اسکیماها در `src/lib/schemas.ts`

## قراردادها / Edge cases
- **زنجیره میان‌افزار:** `helmet` → `cors` (allowlist از `CORS_ORIGINS`) → `rateLimit` سراسری →
  `express.json({ limit: JSON_BODY_LIMIT })` → routeها. هیچ route ای اعتبارسنجی دستی ورودی ندارد؛
  اعتبارسنجی فقط از طریق `validate(schema, source)` انجام می‌شود (#2).
- **پاسخ خطای اعتبارسنجی:** `400 { error: "ورودی نامعتبر است", details: [{ path, message }] }` —
  شکل یکسان در همه routeها. خطاهای business-logic (مثل نبودِ `currentPrice`) همان
  `400 { error: "<پیام فارسی>" }` بدون `details` باقی مانده‌اند.
- خطاهای سطح کلاینت body-parser (JSON نامعتبر `400`، بدنه بزرگ `413`، محتوای ناپشتیبانی‌شده `415`)
  در هندلر مرکزی `server.ts` به همان کد وضعیت نگاشت می‌شوند و به `500` تبدیل نمی‌شوند.
- سایر خطاهای مدیریت‌نشده در هندلر مرکزی `server.ts` گرفته می‌شوند و `500` با پیام فارسی عمومی
  برمی‌گردانند.
- **محدودیت‌های محافظتی (#5):** rate limit سراسری (`RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`)،
  محدودیت اندازه بدنه (`JSON_BODY_LIMIT` / `BULK_IMPORT_BODY_LIMIT`)، و تایم‌اوت‌های سرور
  (`REQUEST_TIMEOUT_MS` / `HEADERS_TIMEOUT_MS` / `KEEP_ALIVE_TIMEOUT_MS`). همه از env قابل تنظیم‌اند و
  مقدار خالی/نامعتبر/غیرمثبت به پیش‌فرض برمی‌گردد (`envInt`). جدول پیش‌فرض‌ها: `README.md`.
- `POST /products/bulk-import`: `type` با `bulkImportQuerySchema` اعتبارسنجی می‌شود؛ سپس بدنه یا
  `text/csv` خام یا JSON `{ rows: [...] }`؛ حداکثر ۵۰۰۰ ردیف؛ خطای هر ردیف جداگانه گزارش می‌شود و
  پاسخ `{ successCount, errorCount, errors }` است (اگر هیچ ردیفی موفق نشود، وضعیت `400`).
- `GET /:id/wisdom` نتیجه را persist نمی‌کند و `checkRisks`/`suggestPrice` را مستقیم (بدون DB
  side-effect) فراخوانی می‌کند؛ در مقابل `GET /:id/suggestion` یک `PriceSuggestion` ذخیره می‌کند.
- `GET /:id/ml-suggestion` با داده فروش تاریخی مدل کشش قیمت را اجرا می‌کند، خروجی را در `PriceSuggestion` و مصرف را در `UsageEvent` ذخیره می‌کند.
- routeهای integration فقط job ثبت/به‌روزرسانی می‌کنند؛ اتصال واقعی marketplace یا worker بیرون از request path است.
- `public/dashboard.html` فایل استاتیک است؛ داده‌های dashboard فقط با `GET /dashboard/wisdom` و API key برمی‌گردد.

## منابع کد
- `src/server.ts:15-111` — نمونه‌سازی اپ، زنجیره میان‌افزار، mount روترها، هندلر خطا، تایم‌اوت‌ها
- `src/routes/*.ts` — پیاده‌سازی هر روتر
- `src/lib/validate.ts` — میان‌افزار اعتبارسنجی zod
- نمونه جریان کامل curl: `README.md`

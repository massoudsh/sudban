# API Routes (`src/routes/*` + `src/server.ts`)

> پانزده روتر Express. از commit `33638fd` mount ها **scoped** شده‌اند (هر روتر زیر پیشوند خودش) تا
> روترهای احرازشده مسیر ثبت‌نام عمومی `POST /sellers` را نگیرند.

## مسئولیت‌ها
| روتر | مسیر پایه | عملیات |
|---|---|---|
| `sellersRouter` | `/sellers` | ساخت فروشنده + صدور کلید API، `GET /me`، تنظیم کانال هشدار، team/subscription/usage |
| `accountsRouter` | `/accounts` | ثبت‌نام/ورود/خروج حساب با نشست ۸ ساعته و `POST /demo` (فقط با `DEMO_MODE=true`) |
| `merchantRouter` | `/merchant` | onboarding، محصولات و جزئیات، سود SKU/کانال، تأیید قیمت، هزینه جایگزینی، موجودی، پیش‌بررسی گروهی قیمت، گزارش VAT، فید کانال، WooCommerce و بینش‌ها (`map-violations`، `stock-forecast`، `price-position`، `price-history`، `promotion-plan`) |
| `importsRouter` | `/imports` | `POST /file` (CSV/XLSX خام) و `POST /catalog` (نگاشت + preview/commit) |
| `productsRouter` | `/products` | CRUD محصول |
| `costsRouter` | `/products/:id/costs` | ثبت/تاریخچه `CostProfile` |
| `pricingRulesRouter` | `/products/:id/pricing-rule` | تعیین/دریافت `PricingRule` |
| `competitorsRouter` | `/products/:id/competitor-prices` | ثبت/دریافت `CompetitorPrice` (با `inStock` و `matchConfidence`) |
| `salesRouter` | `/products/:id/sales` | ثبت/دریافت `SalesRecord` با snapshot هزینه و کسورات واقعی |
| `pricingRouter` | `/products/:id/margin`, `/suggestion`, `/ml-suggestion`, `/simulate`, `/alerts`, `/wisdom` | صدا زدن موتورهای قیمت‌گذاری |
| `bulkImportRouter` | `/products/bulk-import?type=...` | import دسته‌ای CSV/JSON برای سه مدل |
| `integrationsRouter` | `/integrations/:id/competitor-sync-jobs`, `/price-push-jobs`, `/integrations/integration-jobs` | صف integration؛ `executionReady:false` و فقط QUEUED→CANCELLED |
| `economicSignalsRouter` | `/economic/economic-signals`, `/economic/products/:id/cost-adjustment-proposal` | ثبت سیگنال اقتصادی و پیشنهاد تعدیل هزینه |
| `dashboardRouter` | `/dashboard/wisdom` | کارت‌های Wisdom برای dashboard |
| `billingRouter` | `/billing/plans`, `/billing/estimate` | پلن‌های کنترل‌شده سرور و برآورد مصرف (`billing/usage-events` حذف شد) |

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
- `public/` شامل `dashboard.html` + `dashboard.css` + `dashboard.js` + `workflows.js` است (CSP سخت‌گیرانه: بدون inline script).
- routeهای `merchant` و `imports` فقط OWNER/MANAGER را برای نوشتن می‌پذیرند؛ گزارش‌های خواندنی برای همه نقش‌ها.
- `POST /merchant/approvals/:id/:action` در تراکنش Serializable با کنترل وضعیت و قیمت موردانتظار اجرا می‌شود و خروجی آن `scope:"LOCAL_CATALOG", marketplaceApplied:false` است.
- `GET /imports` مسیر ندارد؛ فایل XLSX ابتدا با `workbookGuard` (۲۰۰ entry، ۸MB بازشده) بررسی می‌شود.
- `GET /merchant/feeds/:channel` فقط `torob|emalls|basalam|store` را می‌پذیرد و XML escape‌شده برمی‌گرداند.

## منابع کد
- `src/server.ts` — نمونه‌سازی اپ، زنجیره میان‌افزار، mount روترها، هندلر خطا، تایم‌اوت‌ها
- `src/routes/*.ts` — پیاده‌سازی هر روتر
- `src/lib/validate.ts` — میان‌افزار اعتبارسنجی zod
- نمونه جریان کامل curl: `README.md`

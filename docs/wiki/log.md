# Log

> تاریخچه append-only — هر ورود با `## [YYYY-MM-DD] <type> | <خلاصه>` شروع می‌شود.

## [2026-08-15] update | راه‌اندازی اولیه ویکی دانش پروژه (docs/wiki/) و AGENTS.md برای رشد خودکار مستندات هم‌زمان با رشد کد
## [2026-08-15] feature | افزوده شدن Wisdom Engine (موتور خرد، wisdomEngine.ts + salesTrend.ts) + route GET /:id/wisdom؛ تحقیق بازار رقبای بین‌المللی (docs/MARKET_RESEARCH.md)؛ بک‌لاگ آماده issue (docs/ISSUES.md)؛ mirror ویکی برای GitHub Wiki در docs/gh-wiki/
## [2026-08-15] update | commit eb11e4a به main پوش شد؛ docs/gh-wiki/ روی GitHub Wiki واقعی (sudban.wiki.git) پوش شد؛ همه ۱۳ آیتم docs/ISSUES.md به‌صورت GitHub Issue واقعی (#1 تا #13) ساخته شدند
## [2026-09-19] test | تکمیل تست‌های مرزی هر هفت موتور (#1): بلوک‌های «مقادیر مرزی» به salesTrend و wisdomEngine هم اضافه شد (پیش‌تر به پنج موتور دیگر اضافه شده بود) + تست price منفی در marginCalculator؛ پوشش کامل: مرز تعداد رکورد، آستانه دقیق ۱۰٪ روند، مرزهای ۵٪/۱۵٪ اختلاف قیمت، مرزهای حاشیه سود، بازه percentile ۳۵..۶۵ و نگاشت توصیه هر نوع هشدار
## [2026-09-19] fix | اعتبارسنجی ساخت‌یافته query در bulk-import (#2): `bulkImportQuerySchema` در `src/lib/schemas.ts` و استفاده از `validate(..., "query")` به‌جای بررسی دستی `type` در route — پاسخ خطای آن endpoint از `{ error: "<پیام type>" }` به شکل یکسان `{ error: "ورودی نامعتبر است", details: [...] }` تغییر کرد (کد وضعیت همان ۴۰۰ ماند)
## [2026-09-19] security | محافظت پایه قابل‌تنظیم با env (#5): `RATE_LIMIT_WINDOW_MS`، `JSON_BODY_LIMIT`، `BULK_IMPORT_BODY_LIMIT`، `REQUEST_TIMEOUT_MS`، `HEADERS_TIMEOUT_MS`، `KEEP_ALIVE_TIMEOUT_MS` + `envInt` با fallback ایمن؛ نگاشت خطاهای body-parser (۴۰۰/۴۱۳/۴۱۵) در هندلر مرکزی به‌جای ۵۰۰؛ جدول پیش‌فرض‌ها در README.md و .env.example
## [2026-09-19] test | اجرای واقعی تست‌ها روی ماشین توسعه (پیش‌تر فقط نوشته شده بودند و اجرا نشده بودند): `vitest run` → ۹۸ تست در ۷ فایل، همه پاس (۰ خطا، ۰ skip)؛ `tsc -p tsconfig.json --noEmit` بدون خطا؛ وضعیت در [[overview]] به‌روز شد
## [2026-09-19] update | sync دو صفحه mirror در `docs/gh-wiki/` با منبع حقیقت `docs/wiki/` طبق AGENTS.md: `Pricing-Engines.md` (edge caseهای جدید موتورها + بخش «تست‌های واحد (#1)») و `Home.md` (لایه API + وضعیت واقعی تست‌ها + اشاره به برنچ `fix/open-issues-batch`)
## [2026-09-26] update | پیاده‌سازی issueهای #7 تا #13: ML pricing v2، integration jobs، price-push کنترل‌شده، economic signals، dashboard، RBAC و billing metering

# سودبان (Sudban) — Wiki

> این صفحات از `docs/wiki/` در ریپوی اصلی mirror شده‌اند (منبع حقیقت همان‌جاست). هر تغییر معنایی
> کد ابتدا در `docs/wiki/` ثبت می‌شود و سپس اینجا sync می‌شود — طبق `AGENTS.md`.

دستیار هوشمند تصمیم‌گیری قیمت و مدیریت حاشیه سود برای فروشندگان ایرانی (دیجی‌کالا، باسلام، ترب و
فروشگاه‌های مستقل).

## مسئله
فروشندگان معمولاً قیمت را حسی یا فقط بر اساس رقبا تعیین می‌کنند، بدون در نظر گرفتن دقیق بهای
تمام‌شده واقعی (کمیسیون مارکت‌پلیس، نرخ مرجوعی، هزینه ارسال/بسته‌بندی).

## راه‌حل (MVP) — شش موتور منطق مستقل
1. **Margin Calculator** — بهای تمام‌شده واقعی و کف قیمت.
2. **Competitive Position** — باند قیمتی رقبا.
3. **Price Suggestion Engine** — پیشنهاد قیمت با ۳ استراتژی (MATCH/PREMIUM/PENETRATION).
4. **Scenario Simulator** — شبیه‌سازی اثر تغییر قیمت.
5. **Risk Alert Engine** — تشخیص فروش زیان‌ده، حاشیه بحرانی، ریسک جنگ قیمتی.
6. **Wisdom Engine** — لایه ترکیبی: بینش اولویت‌بندی‌شده + یک توصیه محوری. جزئیات: [[Wisdom Engine|Wisdom-Engine]].

## صفحات
- [[Data Model|Data-Model]] — همه مدل‌های Prisma
- [[Pricing Engines|Pricing-Engines]] — شش موتور منطق قیمت‌گذاری
- [[Api Routes|Api-Routes]] — همه route های Express
- [[Merchant Workflows|Merchant-Workflows]] — ورود حساب، ورود کاتالوگ، سود واقعی، تأیید قیمت و موجودی
- [[Deployment|Deployment]] — ایمیج Docker، migration و Compose
- [[Pricing Strategy|Pricing-Strategy]] — منطق سه استراتژی قیمت‌گذاری و کشش قیمتی
- [[Wisdom Engine|Wisdom-Engine]] — منطق ترکیب بینش‌ها
- [[Market Research|Market-Research]] — رقبای بین‌المللی مشابه و جایگاه تمایز

## لایه API
پانزده روتر Express؛ از commit `33638fd` mount ها scoped شده‌اند (`/sellers`, `/accounts`, `/merchant`,
`/imports`, `/products/...`, `/integrations`, `/economic`, `/dashboard`, `/billing`). دو روش احراز
هویت وجود دارد: کلید API (`Authorization: Bearer` یا `x-api-key`) و نشست حساب (`sb_session_`، هش
SHA256، ۸ ساعت). اعتبارسنجی با zod در `src/lib/validate.ts` و محافظت پایه (helmet + CORS allowlist +
rate limit + سقف بدنه + تایم‌اوت سرور) از env قابل تنظیم است. جزئیات: [[Api Routes|Api-Routes]].

## وضعیت فعلی
کد MVP کامل (routes + services + schema) و type-safe است. سه migration شامل baseline
`20260101000000_init` وجود دارد که با اسکیمای فعلی (۱۵ جدول) مطابقت دارد.

**آخرین اجرای واقعی تست‌ها (محلی، ۲۰۲۶-۱۱-۱۶):** `vitest run` → **۱۳۸ تست در ۱۲ فایل، همه پاس**؛
`tsc --noEmit` و `prisma validate` بدون خطا.

Docker اضافه شده (`Dockerfile` سه‌مرحله‌ای + `docker-compose.yml` با Postgres، migrate و app)؛ جزئیات:
[[Deployment|Deployment]]. ساخت ایمیج و migration روی دیتابیس واقعی هنوز در این محیط اجرا نشده و
باید روی سرور انجام شود. بک‌لاگ نزدیک‌مدت: `docs/ISSUES.md` (همه ۱۳ مورد GitHub Issue واقعی دارند).

## پشته فناوری
Node.js, TypeScript, Express, Prisma ORM, PostgreSQL.

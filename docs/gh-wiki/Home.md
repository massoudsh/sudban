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
- [[Pricing Strategy|Pricing-Strategy]] — منطق سه استراتژی قیمت‌گذاری و کشش قیمتی
- [[Wisdom Engine|Wisdom-Engine]] — منطق ترکیب بینش‌ها
- [[Market Research|Market-Research]] — رقبای بین‌المللی مشابه و جایگاه تمایز

## لایه API
هشت گروه route روی پیشوند `/sellers` و `/products/...`. احراز هویت با کلید API (`Authorization:
Bearer` یا `x-api-key`)، اعتبارسنجی ورودی با zod در `src/lib/validate.ts`، و محافظت پایه (helmet +
CORS allowlist + rate limit + سقف اندازه بدنه + تایم‌اوت سرور) که همه از env قابل تنظیم‌اند.
جزئیات: [[Api Routes|Api-Routes]].

## وضعیت فعلی
کد MVP نوشته شده (routes + services + schema)، از نظر type-safe. تست واحد هر هفت موتور با Vitest
نوشته شده (`npm test`)؛ جزئیات پوشش: [[Pricing Engines|Pricing-Engines]].

**نتیجه اجرای واقعی تست‌ها (محلی، ۲۰۲۶-۰۹-۱۹):** `vitest run` → **۹۸ تست در ۷ فایل، همه پاس (۰ خطا)**؛
`tsc -p tsconfig.json --noEmit` بدون خطا.

`prisma generate` / `prisma migrate` هنوز روی سرور واقعی استقرار اجرا نشده؛ نصب پکیج‌ها و اجرای
تست فقط توسعه‌ای/محلی بوده است. بک‌لاگ نزدیک‌مدت و نقشه راه آینده: `docs/ISSUES.md` (همه ۱۳ مورد
GitHub Issue واقعی دارند). کارهای حل issue های #1/#2/#5 روی برنچ `fix/open-issues-batch` ارائه شده است.

## پشته فناوری
Node.js, TypeScript, Express, Prisma ORM, PostgreSQL.

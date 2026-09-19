# Overview

سودبان (Sudban) — دستیار هوشمند تصمیم‌گیری قیمت و مدیریت حاشیه سود برای فروشندگان ایرانی
(مارکت‌پلیس‌هایی مثل دیجی‌کالا، باسلام، ترب و فروشگاه‌های مستقل).

## مسئله
فروشندگان معمولاً قیمت را حسی یا فقط بر اساس رقبا تعیین می‌کنند، بدون در نظر گرفتن دقیق بهای
تمام‌شده واقعی (کمیسیون مارکت‌پلیس، نرخ مرجوعی، هزینه ارسال/بسته‌بندی) — نتیجه: فروش زیان‌ده
پنهان یا از دست دادن رقابت‌پذیری.

## راه‌حل (MVP)
یک API بک‌اند (Node.js + TypeScript + Express + Prisma/PostgreSQL) با شش موتور منطق مستقل:
1. **Margin Calculator** — بهای تمام‌شده واقعی و کف قیمت بر اساس حداقل حاشیه سود.
2. **Competitive Position** — باند قیمتی رقبا (min/max/median/percentile).
3. **Price Suggestion Engine** — پیشنهاد قیمت با ۳ استراتژی (MATCH/PREMIUM/PENETRATION).
4. **Scenario Simulator** — شبیه‌سازی اثر تغییر قیمت با مدل کشش قیمتی ثابت.
5. **Risk Alert Engine** — تشخیص فروش زیان‌ده، حاشیه بحرانی، عدم‌رقابت‌پذیری، ریسک جنگ قیمتی.
6. **Wisdom Engine** — لایه ترکیبی که خروجی پنج موتور بالا + روند فروش را در یک لیست بینش
   اولویت‌بندی‌شده و یک توصیه محوری خلاصه می‌کند. جزئیات: [[concepts/wisdom-engine]].

جزئیات کامل فرمول‌ها: `docs/ARCHITECTURE.md`. سند محصول: `docs/PRD.md`. تحلیل رقبای بین‌المللی
مشابه: `docs/MARKET_RESEARCH.md`.

## مدل دیتا (خلاصه)
`Seller` → `Product` → (`CostProfile` نسخه‌بندی‌شده، `PricingRule`، `CompetitorPrice[]`،
`SalesRecord[]`، `PriceSuggestion[]`، `Alert[]`). جزئیات: [[entities/data-model]].

## لایه API
هشت گروه route روی پیشوند `/sellers` و `/products/...`. احراز هویت با کلید API (`Authorization:
Bearer` یا `x-api-key`)، اعتبارسنجی ورودی با zod در `src/lib/validate.ts`، و محافظت پایه (helmet +
CORS allowlist + rate limit + سقف اندازه بدنه + تایم‌اوت سرور) همه از env قابل تنظیم‌اند.
جزئیات: [[entities/api-routes]].

## وضعیت فعلی
- کد MVP نوشته شده (routes + services + schema)، از نظر type-safe.
- تست واحد هر شش موتور + Sales Trend با Vitest نوشته شده (`npm test`)؛ جزئیات پوشش:
  [[entities/pricing-engines]].
- **نتیجه اجرای واقعی تست‌ها (محلی، ۲۰۲۶-۰۹-۱۹):** `vitest run` → **۹۸ تست در ۷ فایل، همه پاس
  (۰ خطا)**؛ `tsc -p tsconfig.json --noEmit` بدون خطا.
- `prisma generate` / `prisma migrate` هنوز روی سرور واقعی استقرار اجرا نشده (طبق قانون پلتفرم،
  بیلد سنگین داخل کانتینر ایجنت انجام نمی‌شود)؛ نصب پکیج‌ها و اجرای تست، فقط توسعه‌ای/محلی بوده است.
- بک‌لاگ نزدیک‌مدت و نقشه راه آینده: `docs/ISSUES.md`؛ همه ۱۳ مورد GitHub Issue واقعی دارند.
- ریپوی گیت‌هاب: `github.com/massoudsh/sudban` — کارهای حل #1/#2/#5 روی برنچ `fix/open-issues-batch`
  و در قالب PR ارائه شده است.

## پشته فناوری
Node.js, TypeScript, Express, Prisma ORM, PostgreSQL.

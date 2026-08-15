# Overview

سودبان (Sudban) — دستیار هوشمند تصمیم‌گیری قیمت و مدیریت حاشیه سود برای فروشندگان ایرانی
(مارکت‌پلیس‌هایی مثل دیجی‌کالا، باسلام، ترب و فروشگاه‌های مستقل).

## مسئله
فروشندگان معمولاً قیمت را حسی یا فقط بر اساس رقبا تعیین می‌کنند، بدون در نظر گرفتن دقیق بهای
تمام‌شده واقعی (کمیسیون مارکت‌پلیس، نرخ مرجوعی، هزینه ارسال/بسته‌بندی) — نتیجه: فروش زیان‌ده
پنهان یا از دست دادن رقابت‌پذیری.

## راه‌حل (MVP)
یک API بک‌اند (Node.js + TypeScript + Express + Prisma/PostgreSQL) با پنج موتور منطق مستقل:
1. **Margin Calculator** — بهای تمام‌شده واقعی و کف قیمت بر اساس حداقل حاشیه سود.
2. **Competitive Position** — باند قیمتی رقبا (min/max/median/percentile).
3. **Price Suggestion Engine** — پیشنهاد قیمت با ۳ استراتژی (MATCH/PREMIUM/PENETRATION).
4. **Scenario Simulator** — شبیه‌سازی اثر تغییر قیمت با مدل کشش قیمتی ثابت.
5. **Risk Alert Engine** — تشخیص فروش زیان‌ده، حاشیه بحرانی، عدم‌رقابت‌پذیری، ریسک جنگ قیمتی.

جزئیات کامل فرمول‌ها: `docs/ARCHITECTURE.md`. سند محصول: `docs/PRD.md`.

## مدل دیتا (خلاصه)
`Seller` → `Product` → (`CostProfile` نسخه‌بندی‌شده، `PricingRule`، `CompetitorPrice[]`،
`SalesRecord[]`، `PriceSuggestion[]`، `Alert[]`). جزئیات: [[entities/data-model]].

## لایه API
هفت گروه route روی پیشوند `/sellers` و `/products/:id/...`. جزئیات: [[entities/api-routes]].

## وضعیت فعلی
- کد MVP نوشته شده (routes + services + schema)، از نظر type-safe.
- `npm install` / `prisma generate` / `prisma migrate` هنوز روی سرور واقعی اجرا نشده (طبق قانون
  پلتفرم، بیلد سنگین داخل کانتینر ایجنت انجام نمی‌شود).
- تست واحد هنوز نوشته نشده.
- ریپوی گیت‌هاب: `github.com/massoudsh/sudban` (push شده تا کامیت `87a1713`).

## پشته فناوری
Node.js, TypeScript, Express, Prisma ORM, PostgreSQL.

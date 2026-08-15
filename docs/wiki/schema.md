# Wiki Schema — قوانین این پایگاه دانش

> این فایل را ایجنت خودش می‌خواند و می‌نویسد. هرگاه عمیق‌تر پروژه را فهمید، همین فایل را
> به‌روزرسانی می‌کند. دستورالعمل کامل و بالادستی در `AGENTS.md` (ریشه ریپو) آمده است.

## ساختار صفحات
- `overview.md` — یک‌نگاه کلی پروژه (≤۴۰۰ کلمه)
- `index.md` — کاتالوگ همه صفحات، گروه‌بندی‌شده
- `log.md` — تاریخچه append-only (جدیدترین در پایین)
- `entities/` — هر entity مهم یک صفحه (مدل دیتا، engine، router)
- `concepts/` — patternها، flowها، قراردادها، تصمیم‌های معماری
- `sources/` — (اختیاری) خلاصه فایل‌های خام کد پرارجاع

## قانون رشد ("مثل اختاپوس")
پروژه سودبان قرار است رشد کند: مدل‌های دیتابیس بیشتر، engineهای قیمت‌گذاری بیشتر، routeهای بیشتر.
هر بار یک شاخک جدید (entity/concept جدید) اضافه شد، یک صفحه‌ی جدید در `entities/` یا `concepts/`
بساز و در `index.md` لینک بده — بدون بازنویسی صفحات قبلی، فقط رشد افزایشی (append-friendly).

## چه وقت صفحه جدید بساز
- فقط اگر ≥۳ جای دیگر به آن لینک می‌دهند، یا concept مستقلی با حجم قابل‌توجه است.
- در ۹۰٪ موارد به‌جای فایل جدید، صفحه موجود را آپدیت کن.
- هرگز صفحه‌ی trivial نساز.

## لینک‌گذاری (Obsidian-style)
- `[[entities/data-model]]` بدون پسوند `.md`.
- نام فایل: lowercase + hyphen.

## فهرست فعلی entity/concept
- `entities/data-model.md` — همه‌ی مدل‌های Prisma (Seller, Product, CostProfile, PricingRule, ...)
- `entities/pricing-engines.md` — پنج موتور منطق قیمت‌گذاری (`src/services/*`)
- `entities/api-routes.md` — همه‌ی route های Express (`src/routes/*`, `src/server.ts`)
- `concepts/pricing-strategy.md` — منطق استراتژی قیمت‌گذاری و مدل کشش قیمتی

## Lint دوره‌ای
وقتی کاربر گفت «ویکی رو بازبینی کن»: orphan pages، broken link، تناقض بین صفحات، صفحات کهنه —
طبق `AGENTS.md` بخش Lint عمل کن.

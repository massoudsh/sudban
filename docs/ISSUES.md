# بک‌لاگ Issue

> همه ۱۳ مورد این فایل به‌صورت GitHub Issue واقعی روی [massoudsh/sudban](https://github.com/massoudsh/sudban/issues) ساخته شده‌اند (Issue #1 تا #13، به همان ترتیب زیر). این فایل همچنان به‌عنوان مرجع خلاصه/آفلاین نگه داشته می‌شود.

## نزدیک‌مدت (Near-term — توسعه بعدی مستقیم روی MVP فعلی)

### 1. تست واحد برای پنج+۱ موتور منطق قیمت‌گذاری — [Issue #1](https://github.com/massoudsh/sudban/issues/1)
labels: `test`, `priority:high`
```
پنج+۱ موتور src/services/*.ts (marginCalculator, competitivePosition, priceSuggestionEngine,
scenarioSimulator, riskAlertEngine, wisdomEngine, salesTrend) هیچ تست واحدی ندارند. چون این
منطق مستقیماً مالی/تصمیم‌ساز است، نبود تست ریسک رگرسیون بالایی دارد.

قابل قبول وقتی:
- Jest/Vitest راه‌اندازی شود (package.json آماده نیست هنوز)
- هر تابع خالص حداقل ۳-۴ سناریوی edge case (کف قیمت، بدون داده رقیب، returnRate>=1، ...) پوشش داده شود
```

### 2. اعتبارسنجی ورودی ساخت‌یافته (به‌جای بررسی دستی در route) — [Issue #2](https://github.com/massoudsh/sudban/issues/2)
labels: `enhancement`, `priority:medium`
```
اعتبارسنجی فعلی در لایه route دستی و پراکنده است (مثلاً بررسی price>0 در pricing.ts).
با رشد endpointها این الگو مقیاس‌پذیر نیست.

پیشنهاد: افزودن zod (یا مشابه) برای schema validation روی body/query هر route، با پیام خطای فارسی یکسان.
```

### 3. احراز هویت و مجوز سطح فروشنده (Auth) — [Issue #3](https://github.com/massoudsh/sudban/issues/3)
labels: `enhancement`, `security`, `priority:high`
```
فعلاً هیچ لایه احراز هویتی روی API نیست — هر کلاینتی به هر sellerId دسترسی دارد.
قبل از هر استقرار عمومی باید API key یا JWT per-seller اضافه شود و همه routeها بر اساس sellerId
مالک محدود شوند (در حال حاضر schema.prisma این رابطه را دارد ولی در لایه route enforce نمی‌شود).
```

### 4. Import دسته‌ای CSV برای CostProfile / SalesRecord / CompetitorPrice — [Issue #4](https://github.com/massoudsh/sudban/issues/4)
labels: `enhancement`, `priority:medium`
```
فروشندگانی با کاتالوگ متوسط/بزرگ نمی‌توانند هزار محصول را یکی‌یکی از طریق API ثبت کنند.
یک endpoint POST /products/bulk-import (CSV یا JSON آرایه‌ای) برای هر سه مدل بالا لازم است،
با گزارش ردیف‌های خطادار.

مرتبط با ابزارهای بین‌المللی مشابه (Prisync/Sellerboard) که همگی import دسته‌ای دارند —
جزئیات رقبا: docs/MARKET_RESEARCH.md
```

### 5. Rate limiting و محافظت پایه API — [Issue #5](https://github.com/massoudsh/sudban/issues/5)
labels: `security`, `priority:medium`
```
سرور Express فعلی هیچ rate limit یا محافظت پایه (helmet, cors محدود) ندارد.
قبل از استقرار عمومی باید express-rate-limit + helmet + cors allowlist اضافه شود.
```

### 6. کانال هشدار خارج از API (تلگرام/ایمیل/پیامک) — [Issue #6](https://github.com/massoudsh/sudban/issues/6)
labels: `enhancement`, `priority:medium`
```
Alert و Wisdom Engine فقط از طریق GET قابل دریافت‌اند؛ فروشنده باید فعالانه poll کند.
برای بازار ایران، اعلان تلگرامی (پرکاربردترین کانال فروشندگان آنلاین ایرانی) اولویت دارد؛
ایمیل/SMS به‌عنوان fallback.
```

---

## نقشه راه آینده (Future — خارج از محدوده نسخه فعلی)

### 7. موتور پیشنهاد قیمت مبتنی بر یادگیری ماشین (v2) — [Issue #7](https://github.com/massoudsh/sudban/issues/7)
labels: `future`, `ml`
```
معماری فعلی (docs/ARCHITECTURE.md بخش ۲.۳) عمداً rule-based طراحی شده تا بدون تغییر API عمومی
با یک مدل رگرسیون کشش قیمتی روی SalesRecord تاریخی جایگزین/ترکیب شود. نیازمند حجم داده فروش
کافی برای هر seller/product قبل از شروع.
```

### 8. اسکرپینگ خودکار قیمت رقبا (دیجی‌کالا/باسلام/ترب) — [Issue #8](https://github.com/massoudsh/sudban/issues/8)
labels: `future`, `integration`
```
در حال حاضر CompetitorPrice فقط دستی/نیمه‌خودکار ثبت می‌شود. یکپارچه‌سازی per-channel
(رسمی در صورت وجود API، وگرنه scraping قانونی) بزرگ‌ترین تفاوت با رقبای بین‌المللی مثل
Prisync/Intelligence Node خواهد بود. نیازمند صف پیام (queue) + workerهای مجزا (طبق
docs/ARCHITECTURE.md بخش ۵).
```

### 9. اتصال مستقیم به درگاه فروش برای اعمال خودکار قیمت (auto price-push) — [Issue #9](https://github.com/massoudsh/sudban/issues/9)
labels: `future`, `integration`
```
فعلاً سودبان فقط پیشنهاد می‌دهد؛ فروشنده باید دستی قیمت را در مارکت‌پلیس اعمال کند.
اتصال دوطرفه (push قیمت پیشنهادی به دیجی‌کالا/باسلام/فروشگاه مستقل) ارزش پیشنهادی را از
"توصیه‌گر" به "اتوپایلوت قیمت" ارتقا می‌دهد — اما ریسک عملیاتی بالایی دارد (قیمت اشتباه خودکار).
```

### 10. سیگنال نرخ ارز/تورم به‌عنوان ورودی خودکار CostProfile — [Issue #10](https://github.com/massoudsh/sudban/issues/10)
labels: `future`, `data`
```
docs/PRD.md این را به‌صراحت خارج از MVP گذاشته. اتصال به یک منبع نرخ ارز (رسمی/بازار آزاد) برای
پیشنهاد خودکار به‌روزرسانی CostProfile وقتی نوسان معناداری رخ می‌دهد — مرتبط مستقیم با فرضیه
"حساسیت اقتصاد ایران" در docs/PRD.md بخش ۱۱.
```

### 11. داشبورد وب (فرانت‌اند) — [Issue #11](https://github.com/massoudsh/sudban/issues/11)
labels: `future`, `frontend`
```
MVP فعلی فقط API است. برای فروشندگان غیرفنی، داشبورد وب لازم است — نمایش بصری Wisdom Engine
(اولویت‌بندی بینش‌ها) اولین صفحه منطقی برای شروع است چون بیشترین ارزش را در کمترین کلیک نشان می‌دهد.
```

### 12. چندمستأجری با سطوح دسترسی سازمانی — [Issue #12](https://github.com/massoudsh/sudban/issues/12)
labels: `future`, `enterprise`
```
schema.prisma از ابتدا sellerId روی مدل‌ها دارد (multi-tenant-ready) اما نقش‌های سازمانی
(مدیر/تحلیل‌گر/فقط-مشاهده) طراحی نشده. برای فروش B2B به تیم‌های بزرگ‌تر لازم می‌شود.
```

### 13. مدل قیمت‌گذاری اشتراکی + متری usage-based — [Issue #13](https://github.com/massoudsh/sudban/issues/13)
labels: `future`, `billing`
```
docs/PRD.md بخش ۷ مدل درآمدی را تعریف کرده (SKU فعال + usage) اما پیاده‌سازی صورتحساب/متر
مصرف هنوز شروع نشده. نیازمند تصمیم درباره درگاه پرداخت ایرانی.
```

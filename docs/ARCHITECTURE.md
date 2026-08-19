# معماری فنی — سودبان (Sudban)

## ۱. نمای کلی سرویس‌ها

```
                         ┌─────────────────────────┐
                         │      Sudban API          │
                         │   (Express + TS)         │
                         └────────────┬─────────────┘
                                      │
      ┌────────────┬──────────────┬──┴───────────┬───────────────┐
      │             │              │              │               │
┌─────▼─────┐ ┌─────▼──────┐ ┌────▼─────┐ ┌───────▼──────┐ ┌──────▼──────┐
│  Margin    │ │  Price     │ │ Scenario │ │  Competitive │ │  Risk Alert │
│ Calculator │ │ Suggestion │ │Simulator │ │  Position    │ │  Engine     │
│  Service   │ │  Engine    │ │ Service  │ │  Service     │ │             │
└─────┬─────┘ └─────┬──────┘ └────┬─────┘ └───────┬──────┘ └──────┬──────┘
      │             │              │               │               │
      └─────────────┴──────┬───────┴───────────────┴───────────────┘
                            │
                    ┌───────▼────────┐
                    │  Wisdom Engine  │  ← لایه ترکیبی؛ خروجی پنج سرویس بالا + روند فروش را
                    │  (موتور خرد)    │    می‌گیرد و بینش اولویت‌بندی‌شده تولید می‌کند
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │  Prisma ORM     │
                    │  (PostgreSQL)   │
                    └────────────────┘
```

هر سرویس یک ماژول مستقل در `src/services/` است؛ در MVP همه در یک پروسه (monolith) اجرا می‌شوند تا پیچیدگی عملیاتی غیرضروری اضافه نشود. جداسازی به میکروسرویس در صورت نیاز مقیاس (مثلاً رصد رقبا با حجم بالای درخواست) در نسخه‌های بعدی انجام می‌شود.

## ۲. سرویس‌ها

### ۲.۱ Margin Calculator Service
ورودی: `productId`, `price` فرضی
خروجی: `trueCost`, `profit`, `marginPct`

فرمول بهای تمام‌شده واقعی:
```
effectiveUnitCost = unitCost / (1 - returnRate)   // جبران هزینه کالای مرجوعی
trueCost = effectiveUnitCost + packagingCost + shippingCost + otherFixedCost
         + (price * commissionRate)                // کمیسیون کانال فروش وابسته به قیمت فروش است
profit    = price - trueCost
marginPct = profit / price
```

### ۲.۲ Competitive Position Service
ورودی: `productId`
خروجی: `min`, `max`, `median`, `avg` قیمت رقبا (از آخرین قیمت‌های ثبت‌شده هر رقیب) + جایگاه قیمت فعلی فروشنده نسبت به این باند (percentile).

### ۲.۳ Price Suggestion Engine (v1 — rule-based)
ورودی: `productId`, `strategy` (`MATCH` | `PREMIUM` | `PENETRATION`)
خروجی: `suggestedPrice`, `expectedMarginPct`, `competitivenessScore`, `rationale[]`

منطق:
1. `costFloor` = قیمتی که در آن `marginPct == minMarginPct` (حل معادله بالا برای price)
2. باند رقابتی از Competitive Position Service گرفته می‌شود
3. بسته به استراتژی:
   - `MATCH`: نزدیک به میانه بازار (median رقبا)، مشروط به رعایت `costFloor`
   - `PREMIUM`: بالاتر از میانه (مثلاً percentile ۷۵) تا زمانی که در سقف `ceilingPrice` بماند
   - `PENETRATION`: نزدیک به کف بازار، اما هرگز پایین‌تر از `costFloor`
4. قیمت نهایی همیشه به `[costFloor, ceilingPrice]` کلمپ می‌شود
5. `rationale` بندهای متنی توضیح تصمیم را برمی‌گرداند (شفافیت تصمیم برای فروشنده)

> این موتور در v1 rule-based است. معماری آن (ورودی/خروجی مشخص + جداسازی از HTTP layer) به‌گونه‌ای طراحی شده که در نسخه بعدی بتوان آن را با یک مدل یادگیری‌ماشین (مثلاً رگرسیون کشش قیمتی بر پایه `SalesRecord` تاریخی) جایگزین یا ترکیب کرد، بدون تغییر در API عمومی.

### ۲.۴ Scenario Simulator
ورودی: `productId`, `hypotheticalPrice`, `elasticity؟` (اختیاری، وگرنه پیش‌فرض `PricingRule.priceElasticity` یا مقدار سیستمی)
خروجی: تغییر برآوردی تقاضا، درآمد، سود نسبت به baseline (میانگین فروش اخیر)

مدل کشش قیمتی ساده (constant elasticity):
```
%ΔQuantity = elasticity * %ΔPrice
```

### ۲.۵ Risk Alert Engine
قوانین (اجرا روی هر تغییر قیمت پیشنهادی/ثبت‌شده):
- `LOSS_MAKING` (بحرانی): `price < trueCost`
- `LOW_MARGIN` (هشدار): `marginPct < minMarginPct`
- `UNCOMPETITIVE_HIGH` (هشدار): `price` بیش از آستانه٪ بالاتر از `max` رقبا
- `PRICE_WAR_RISK` (هشدار): `price` بیش از آستانه٪ پایین‌تر از `min` رقبا **و** `marginPct` نزدیک کف مجاز

### ۲.۶ Wisdom Engine (موتور خرد)
ورودی: `productId`, `strategy؟` (اختیاری، وگرنه از `PricingRule.strategy`)
خروجی: `insights[]` (اولویت‌بندی‌شده HIGH/MEDIUM/LOW با دسته RISK/MARGIN/COMPETITIVE/TREND/OPPORTUNITY) + `topRecommendation`

لایه ترکیبی (synthesis) است، نه یک محاسبه مستقل جدید؛ خروجی Margin Calculator، Price Suggestion
Engine، Risk Alert Engine و Competitive Position را با یک سیگنال تازه — **روند فروش** (میانگین
دو نیمه اخیر/قبلی تاریخچه `SalesRecord`) — ترکیب می‌کند تا به‌جای چند عدد پراکنده، یک لیست
بینش قابل‌اقدام و یک توصیه محوری واحد به فروشنده بدهد. منطق کامل و جدول قوانین هر بینش در
`docs/wiki/concepts/wisdom-engine.md` مستند است. بر خلاف `/suggestion`، نتیجه در دیتابیس
persist نمی‌شود (صرفاً محاسبه لحظه‌ای، مثل `/margin`).

## ۳. جریان داده اصلی (Core Flow)

```
1. فروشنده محصول + اجزای هزینه (CostProfile) را ثبت می‌کند
2. فروشنده PricingRule (حداقل حاشیه سود، استراتژی، کف/سقف) تعیین می‌کند
3. قیمت رقبا از طریق API/ورود دستی جمع می‌شود (CompetitorPrice)
4. تاریخچه فروش وارد می‌شود (SalesRecord) — اختیاری اما برای دقت بیشتر
5. فروشنده Price Suggestion را فراخوانی می‌کند → Margin Calculator + Competitive
   Position ترکیب می‌شوند → پیشنهاد + rationale برمی‌گردد
6. فروشنده می‌تواند سناریوهای دلخواه را با Scenario Simulator بررسی کند
7. Risk Alert Engine به‌صورت مداوم (روی هر ورودی قیمت رقیب/فروش/قیمت واقعی)
   بررسی می‌کند و Alert می‌سازد
8. فروشنده در هر لحظه می‌تواند Wisdom Engine را فراخوانی کند تا به‌جای بررسی جداگانه چهار
   endpoint بالا، یک خلاصه اولویت‌بندی‌شده و توصیه محوری بگیرد
```

## ۴. پشته فناوری MVP

| لایه | انتخاب | دلیل |
|---|---|---|
| زبان/ران‌تایم | Node.js + TypeScript | type-safety برای منطق مالی حساس |
| وب فریم‌ورک | Express | ساده، بدون overhead غیرضروری برای MVP |
| ORM / دیتابیس | Prisma + PostgreSQL | schema اعلانی، migration امن، مناسب داده رابطه‌ای مالی |
| اعتبارسنجی ورودی | zod schema-based (`src/lib/schemas.ts` + `src/lib/validate.ts`) | یکدست، پیام خطای ساختاریافته، به‌جای بررسی پراکنده در هر route |
| تست | Vitest | تست واحد سریع بدون نیاز به ts-jest/babel جدا |

## ۵. احراز هویت، مجوز و محافظت API (Auth & Security)

- **احراز هویت**: کلید API به ازای هر Seller. در پاسخ `POST /sellers` یک‌بار نمایش داده می‌شود
  (`sk_live_...`)؛ در دیتابیس فقط `apiKeyPrefix` (غیرمحرمانه، برای جست‌وجو) و `apiKeyHash`
  (bcrypt) ذخیره می‌شود — خود کلید هرگز persist نمی‌شود. کلاینت باید هدر
  `Authorization: Bearer <apiKey>` یا `x-api-key: <apiKey>` بفرستد (`src/lib/apiKey.ts`, `src/lib/auth.ts`).
- **مجوز سطح فروشنده**: میان‌افزار `requireOwnedProduct` تضمین می‌کند هر `productId` در مسیر
  متعلق به `req.seller` احرازشده باشد؛ در غیر این صورت ۴۰۴ برمی‌گردد (نه ۴۰۳، برای جلوگیری از
  enumeration). `POST /products` مقدار `sellerId` را همیشه از هویت احرازشده می‌گیرد، نه از body.
- **Rate limiting**: `express-rate-limit` سراسری (پیش‌فرض ۳۰۰ درخواست/۱۵ دقیقه، با
  `RATE_LIMIT_MAX` قابل تنظیم).
- **هدرهای امنیتی + CORS**: `helmet()` فعال است؛ CORS فقط برای origin های داخل `CORS_ORIGINS`
  (لیست جدا با کاما در env) مجاز است؛ بدون تنظیم، فقط دسترسی سرور-به-سرور (بدون origin مرورگر) کار می‌کند.
- **محدودیت اندازه بدنه**: `express.json({ limit: "1mb" })` برای جلوگیری از payload های حجیم.

## ۶. Import دسته‌ای (Bulk Import)

`POST /products/bulk-import?type=cost-profiles|sales|competitor-prices` — دو نوع بدنه پشتیبانی می‌شود:
- `Content-Type: application/json` با `{ rows: [...] }`
- `Content-Type: text/csv` با متن خام CSV (سطر اول = نام ستون‌ها)

هر ردیف باید `productId` یا `sku` داشته باشد (برای map شدن به محصول متعلق به فروشنده احرازشده).
پاسخ شامل `successCount`, `errorCount` و `errors[]` (شماره ردیف + پیام خطا) است تا ردیف‌های
معتبر با وجود چند ردیف خطادار همچنان import شوند. حداکثر ۵۰۰۰ ردیف در هر درخواست.

## ۷. کانال هشدار خارج از API (Notifications)

`src/services/notifier.ts` یک registry از کانال‌های pluggable است (تلگرام/ایمیل/پیامک). هر
کانال مستقل پیکربندی می‌شود و خطای یک کانال باعث توقف بقیه یا بلاک‌شدن پاسخ API نمی‌شود
(best-effort، fire-and-forget از `GET /products/:id/alerts`).

| کانال | نیازمند env سراسری | نیازمند تنظیم فروشنده |
|---|---|---|
| تلگرام (اولویت اول برای بازار ایران) | `TELEGRAM_BOT_TOKEN` | `telegramChatId` (از `PATCH /sellers/me/notifications`) |
| ایمیل (fallback) | `EMAIL_WEBHOOK_URL`, `EMAIL_WEBHOOK_TOKEN؟` | `notifyEmail` (یا همان `email` ثبت‌نامی) |
| پیامک (fallback) | `SMS_WEBHOOK_URL`, `SMS_WEBHOOK_TOKEN؟` | `notifyPhone` |

کانال‌های ایمیل/پیامک به‌صورت آداپتور webhook عمومی (`POST { to, text }`) پیاده شده‌اند تا با هر
سرویس‌دهنده‌ای (مثلاً یک پروکسی نازک روی Kavenegar/Melipayamak یا هر ارائه‌دهنده ایمیل ترنزکشنال)
قابل اتصال باشند، بدون قفل‌شدن روی یک vendor خاص.

## ۸. نکات مقیاس‌پذیری (برای نسخه‌های بعدی، نه MVP فعلی)

- رصد قیمت رقبا با حجم بالا → صف پیام (queue) + workerهای جداگانه per-channel
- موتور پیشنهاد قیمت مبتنی بر ML → سرویس جدا با feature store روی `SalesRecord` + `CompetitorPrice` تاریخی
- چندمستأجری (multi-tenant) در سطح دیتابیس با `sellerId` روی همه جداول (در schema فعلی از ابتدا لحاظ شده)

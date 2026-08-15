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
| اعتبارسنجی ورودی | بررسی دستی سبک در لایه route | حجم فعلی endpointها اعتبارسنجی سبک را توجیه می‌کند |

## ۵. نکات مقیاس‌پذیری (برای نسخه‌های بعدی، نه MVP)

- رصد قیمت رقبا با حجم بالا → صف پیام (queue) + workerهای جداگانه per-channel
- موتور پیشنهاد قیمت مبتنی بر ML → سرویس جدا با feature store روی `SalesRecord` + `CompetitorPrice` تاریخی
- چندمستأجری (multi-tenant) در سطح دیتابیس با `sellerId` روی همه جداول (در schema فعلی از ابتدا لحاظ شده)

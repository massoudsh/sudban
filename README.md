# سودبان (Sudban)

دستیار هوشمند تصمیم‌گیری قیمت و مدیریت حاشیه سود برای فروشندگان ایرانی.

مستندات کامل:
- `docs/PRD.md` — سند محصول (مسئله، راه‌حل، محدوده MVP، معیارهای موفقیت)
- `docs/ARCHITECTURE.md` — معماری فنی سرویس‌ها و جریان داده
- `prisma/schema.prisma` — اسکیمای کامل دیتابیس
- `docs/wiki/` — ویکی دانش زنده پروژه (entity/concept ها)؛ با رشد پروژه رشد می‌کند — قوانین در `AGENTS.md`
- `docs/MARKET_RESEARCH.md` — رقبای بین‌المللی مشابه و جایگاه تمایز سودبان
- `docs/ISSUES.md` — بک‌لاگ Issueها؛ همه ۱۳ مورد روی گیت‌هاب هم ساخته شده‌اند (Issue #1 تا #13)
- `docs/gh-wiki/` — نسخه mirror ویکی برای GitHub Wiki native؛ روی [sudban wiki](https://github.com/massoudsh/sudban/wiki) هم push شده؛ منبع حقیقت همچنان `docs/wiki/` است

## اجرا (روی سرور، نه داخل این کانتینر)

```bash
npm install
cp .env.example .env   # و DATABASE_URL را تنظیم کن (کانال‌های هشدار/CORS/rate-limit اختیاری‌اند)
npx prisma generate
# پایگاه موجودِ دارای baseline معتبر:
npx prisma migrate deploy
npm run dev             # اجرای dev با هات‌ریلود
npm test                 # اجرای تست‌های واحد موتورهای قیمت‌گذاری (Vitest)
# یا برای production:
npm run build && npm start
```

## متغیرهای محیطی

| متغیر | پیش‌فرض | شرح |
|---|---|---|
| `DATABASE_URL` | — | رشته اتصال PostgreSQL (الزامی) |
| `PORT` | `3000` | پورت سرور |
| `CORS_ORIGINS` | خالی | لیست origin های مجاز مرورگر، جدا با کاما (خالی = فقط سرور-به-سرور) |
| `RATE_LIMIT_MAX` | `300` | حداکثر درخواست هر IP در هر پنجره |
| `RATE_LIMIT_WINDOW_MS` | `900000` | طول پنجره rate limit (۱۵ دقیقه) |
| `JSON_BODY_LIMIT` | `1mb` | حداکثر اندازه بدنه JSON (فرمت express) |
| `BULK_IMPORT_BODY_LIMIT` | `2mb` | حداکثر اندازه بدنه CSV در bulk-import (فرمت express) |
| `REQUEST_TIMEOUT_MS` | `120000` | تایم‌اوت کل درخواست (برای bulk-import طولانی سخاوتمندانه است) |
| `HEADERS_TIMEOUT_MS` | `15000` | تایم‌اوت دریافت هدرهای درخواست |
| `KEEP_ALIVE_TIMEOUT_MS` | `5000` | تایم‌اوت اتصال بیکار |
| `TELEGRAM_BOT_TOKEN` / `EMAIL_WEBHOOK_*` / `SMS_WEBHOOK_*` | خالی | کانال‌های هشدار (اختیاری) |

مقدار خالی/نامعتبر/غیرمثبت هر متغیر عددی نادیده گرفته می‌شود و پیش‌فرض بالا اعمال می‌گردد.
بدنه بزرگ‌تر از حد مجاز با `413` و JSON نامعتبر با `400` رد می‌شود (نه `500`).

## احراز هویت

همه endpoint های زیر `/products` و `/sellers/me*` نیازمند کلید API هستند. کلید فقط یک‌بار در
پاسخ `POST /sellers` نمایش داده می‌شود؛ آن را در هدر بفرستید:

```
Authorization: Bearer sk_live_...
```
(یا معادل آن: هدر `x-api-key`)

## نقشه API

| متد | مسیر | احراز هویت | شرح |
|---|---|---|---|
| POST | `/sellers` | خیر | ساخت فروشنده + صدور کلید API |
| GET | `/sellers/me` | بله | اطلاعات فروشنده احرازشده |
| PATCH | `/sellers/me/notifications` | بله | تنظیم کانال هشدار (تلگرام/ایمیل/پیامک) |
| GET | `/sellers/:id/products` | بله | لیست محصولات فروشنده |
| POST | `/products` | بله | ساخت محصول |
| GET/PATCH | `/products/:id` | بله | دریافت/به‌روزرسانی محصول |
| POST/GET | `/products/:id/costs` | بله | ثبت/تاریخچه بهای تمام‌شده |
| PUT/GET | `/products/:id/pricing-rule` | بله | تعیین/دریافت قاعده قیمت‌گذاری |
| POST/GET | `/products/:id/competitor-prices` | بله | ثبت/دریافت قیمت رقبا |
| POST/GET | `/products/:id/sales` | بله | ثبت/دریافت تاریخچه فروش |
| POST | `/products/bulk-import?type=cost-profiles\|sales\|competitor-prices` | بله | import دسته‌ای CSV/JSON |
| GET | `/products/:id/margin?price=X` | بله | محاسبه حاشیه سود برای قیمت فرضی |
| GET | `/products/:id/suggestion?strategy=MATCH` | بله | قیمت پیشنهادی موتور |
| GET | `/products/:id/ml-suggestion?strategy=MATCH` | بله | قیمت پیشنهادی v2 مبتنی بر کشش فروش تاریخی |
| POST | `/products/:id/simulate` | بله | شبیه‌سازی سناریوی تغییر قیمت |
| GET | `/products/:id/alerts` | بله | هشدارهای فعال ریسک قیمت (+ اطلاع‌رسانی هشدار تازه) |
| GET | `/products/:id/wisdom?strategy=MATCH` | بله | بینش‌های ترکیبی اولویت‌بندی‌شده + یک توصیه محوری (موتور خرد) |
| GET | `/dashboard/wisdom` | بله | کارت‌های داشبورد Wisdom برای همه محصولات فروشنده |
| GET | `/dashboard.html` | بله* | داشبورد HTML سبک؛ API key را در فرم می‌گیرد |
| GET/POST/PATCH | `/sellers/me/team` و `/sellers/me/team/:memberId` | بله | مدیریت اعضای تیم و نقش‌ها |
| PUT/GET | `/sellers/me/subscription` | بله | تنظیم و دریافت اشتراک فعال |
| GET | `/sellers/me/billing/usage` | بله | خلاصه مصرف ماهانه و SKU فعال |
| GET | `/billing/plans` | بله | پلن‌های نمونه billing |
| GET | `/billing/estimate` | بله | برآورد ماه جاری با تعرفه کنترل‌شده سرور |
| POST/GET | `/economic/economic-signals` | بله | ثبت/دریافت سیگنال نرخ ارز یا تورم |
| GET | `/economic/products/:id/cost-adjustment-proposal` | بله | پیشنهاد تعدیل CostProfile |
| POST | `/integrations/:id/competitor-sync-jobs` | بله | صف درخواست sync؛ بدون آداپتور اجرایی |
| POST | `/integrations/:id/price-push-jobs` | بله | صف درخواست قیمت با کنترل کف هزینه |
| GET/PATCH | `/integrations/integration-jobs` و `/integrations/integration-jobs/:jobId` | بله | مشاهده؛ فقط لغو job در صف مجاز است |

*خود فایل HTML عمومی است؛ داده‌های خصوصی به کلید API یا نشست معتبر نیاز دارند.

## گردش‌کارهای فروشنده

| متد | مسیر | کاربرد |
|---|---|---|
| POST | `/accounts/register` و `/accounts/login` | ثبت‌نام/ورود ایمیل و رمز حداقل ۱۲ کاراکتری؛ نشست ۸ ساعته |
| POST | `/accounts/logout` | ابطال نشست؛ توکن داشبورد فقط در حافظه نگهداری می‌شود |
| POST | `/merchant/onboarding` | ساخت اتمیک محصول، هزینه و قاعده |
| GET | `/merchant/products` و `/merchant/products/:id/detail` | فهرست و جزئیات محصول با تاریخچه |
| GET | `/merchant/profit` | سود SKU/کانال برای حداکثر ۱۰۰۰۰ رکورد آخر؛ داده ناقص جدا گزارش می‌شود |
| GET | `/merchant/approvals` | فهرست درخواست‌های قیمت |
| POST | `/merchant/products/:id/approvals` | پیشنهاد قیمت با دلیل و کنترل کف هزینه |
| POST | `/merchant/approvals/:approvalId/:action` | `approve`، `reject`، `apply` یا `rollback` |
| GET | `/merchant/products/:id/replacement` | برآورد هزینه جایگزینی با نرخ هم‌منبع از زمان هزینه |
| POST | `/imports/file` | CSV/XLSX خام، حداکثر ۱ مگابایت و ۵۰۰ ردیف |
| POST | `/imports/catalog` | نگاشت ستون‌ها، `unit: IRR/IRT` و پیش‌نمایش؛ `commit:true` ورود اتمیک |
| POST | `/merchant/woocommerce/catalog` | همگام‌سازی یک‌طرفه حداکثر ۱۰۰ محصول در هر درخواست |

فروش: `unitCostSnapshot` هزینه واحد در زمان فروش است؛ `commissionAmount`، `shippingSubsidy`، `discountAmount`، `returnCost` و `settlementDeduction` مبالغ کل همان تراکنش‌اند و یک‌بار کم می‌شوند. بدون snapshot، سود نامعلوم می‌ماند؛ زیان واقعی حذف نمی‌شود. قیمت‌ها در دیتابیس ریال‌اند؛ ورودی تومان یک‌بار ×۱۰ می‌شود.

رقبا: فقط قیمت ریالی موجود، با `matchConfidence >= 0.9` و ثبت‌شده طی ۲۴ ساعت گذشته وارد محاسبه می‌شود. قیمت پیشنهادی و برگشت قیمت داخل تراکنش با هزینه زنده و قیمت موردانتظار کنترل می‌شوند. **اعمال/برگشت فقط کاتالوگ محلی را تغییر می‌دهد، نه مارکت‌پلیس.** اعضای تیم کلید مستقل و قابل غیرفعال‌سازی دارند؛ هش‌ها در پاسخ پروفایل/تیم نیستند.

### WooCommerce و خلاصه روزانه

پوشه `integrations/woocommerce` را به پوشه افزونه‌های WordPress منتقل و افزونه را فعال کنید. در زیرمنوی WooCommerce، مدیر مجاز آدرس HTTPS سرویس، کلید API، واحد پول و صفحه را وارد می‌کند؛ کلید در تنظیمات افزونه ذخیره نمی‌شود. هر اجرا دستی و حداکثر ۱۰۰ محصول منتشرشده است؛ هزینه یا تغییر قیمت فروشگاه خارجی ارسال نمی‌شود.

پس از کامپایل روی سرور، `npm run digest` پیش‌نمایش بدون ارسال و `npm run digest -- --send` ارسال به کانال تنظیم‌شده است. زمان‌بندی باید روی سرور و بدون اجرای هم‌زمان worker تنظیم شود؛ زمان موفقیت فقط پس از ارسال موفق همه کانال‌های انتخاب‌شده ذخیره می‌شود. بدون پیکربندی ارائه‌دهنده هیچ ارسالی انجام نمی‌شود.

### استقرار و محدودیت‌های تأییدشده

- migration جدید: `prisma/migrations/20261018000000_merchant_workflows/migration.sql`. تاریخچه migration فاقد baseline اولیه جداول پایه است؛ نصب تازه نیازمند baseline بازبینی‌شده پیش از `migrate deploy` است. روی دیتابیس موجود ابتدا backup و staging لازم است.
- پرداخت واقعی متصل نیست؛ فعال‌سازی پلن پولی تا تأیید پرداخت رد می‌شود. تعرفه و سهمیه را کاربر تعیین نمی‌کند؛ برآورد صورتحساب به‌معنای برداشت وجه یا اجرای سهمیه نیست.
- آداپتور اجرای sync رقبا/قیمت خارجی هنوز متصل نیست؛ job صرفاً صف درخواست است و نمی‌توان موفقیت جعلی ثبت کرد.
- ۱۳۶ تست واحد/HTTP/DOM بدون مرورگر، typecheck و بررسی نحوی JavaScript اجرا شده‌اند. دیتابیس واقعی، ارسال اعلان، WordPress و بررسی بصری مرورگری آزمایش نشده‌اند؛ PHP در محیط موجود نیست.
- `npm audit --omit=dev` بدون آسیب‌پذیری است؛ ابزار توسعه `ts-node-dev` همچنان advisory وابستگی غیرمستقیم دارد. برای production از بسته‌های توسعه استفاده نکنید.

## نمونه جریان کامل

```bash
# ۱) ساخت فروشنده — کلید API را ذخیره کن (فقط همین یک‌بار نمایش داده می‌شود)
RESP=$(curl -s -X POST localhost:3000/sellers -H 'Content-Type: application/json' \
  -d '{"name":"فروشگاه نمونه","email":"shop@example.com"}')
API_KEY=$(echo "$RESP" | jq -r .apiKey)
AUTH="Authorization: Bearer $API_KEY"

# ۲) ساخت محصول (sellerId خودکار از کلید API گرفته می‌شود)
PRODUCT_ID=$(curl -s -X POST localhost:3000/products -H 'Content-Type: application/json' -H "$AUTH" \
  -d '{"sku":"SKU-1","name":"محصول تستی","currentPrice":250000}' | jq -r .id)

# ۳) ثبت بهای تمام‌شده
curl -X POST localhost:3000/products/$PRODUCT_ID/costs -H 'Content-Type: application/json' -H "$AUTH" \
  -d '{"unitCost":150000,"packagingCost":5000,"shippingCost":15000,"commissionRate":0.08,"returnRate":0.03}'

# ۴) تعیین قاعده قیمت‌گذاری
curl -X PUT localhost:3000/products/$PRODUCT_ID/pricing-rule -H 'Content-Type: application/json' -H "$AUTH" \
  -d '{"minMarginPct":0.15,"strategy":"MATCH"}'

# ۵) ثبت قیمت رقبا
curl -X POST localhost:3000/products/$PRODUCT_ID/competitor-prices -H 'Content-Type: application/json' -H "$AUTH" \
  -d '{"competitorName":"رقیب الف","channel":"digikala","price":260000}'

# ۶) دریافت پیشنهاد قیمت
curl localhost:3000/products/$PRODUCT_ID/suggestion -H "$AUTH"

# ۷) بررسی هشدارهای ریسک روی قیمت فعلی
curl localhost:3000/products/$PRODUCT_ID/alerts -H "$AUTH"

# ۸) گرفتن توصیه ترکیبی و اولویت‌بندی‌شده (موتور خرد)
curl localhost:3000/products/$PRODUCT_ID/wisdom -H "$AUTH"
```

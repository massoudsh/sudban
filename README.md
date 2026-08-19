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
npx prisma migrate dev --name init
npm run dev             # اجرای dev با هات‌ریلود
npm test                 # اجرای تست‌های واحد موتورهای قیمت‌گذاری (Vitest)
# یا برای production:
npm run build && npm start
```

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
| POST | `/products/:id/simulate` | بله | شبیه‌سازی سناریوی تغییر قیمت |
| GET | `/products/:id/alerts` | بله | هشدارهای فعال ریسک قیمت (+ اطلاع‌رسانی هشدار تازه) |
| GET | `/products/:id/wisdom?strategy=MATCH` | بله | بینش‌های ترکیبی اولویت‌بندی‌شده + یک توصیه محوری (موتور خرد) |

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

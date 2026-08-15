# سودبان (Sudban)

دستیار هوشمند تصمیم‌گیری قیمت و مدیریت حاشیه سود برای فروشندگان ایرانی.

مستندات کامل:
- `docs/PRD.md` — سند محصول (مسئله، راه‌حل، محدوده MVP، معیارهای موفقیت)
- `docs/ARCHITECTURE.md` — معماری فنی سرویس‌ها و جریان داده
- `prisma/schema.prisma` — اسکیمای کامل دیتابیس
- `docs/wiki/` — ویکی دانش زنده پروژه (entity/concept ها)؛ با رشد پروژه رشد می‌کند — قوانین در `AGENTS.md`
- `docs/MARKET_RESEARCH.md` — رقبای بین‌المللی مشابه و جایگاه تمایز سودبان
- `docs/ISSUES.md` — بک‌لاگ آماده برای ساخت issue در گیت‌هاب (نزدیک‌مدت + نقشه راه آینده)
- `docs/gh-wiki/` — نسخه mirror ویکی برای GitHub Wiki native (`sudban.wiki.git`)؛ منبع حقیقت همچنان `docs/wiki/` است

## اجرا (روی سرور، نه داخل این کانتینر)

```bash
npm install
cp .env.example .env   # و DATABASE_URL را تنظیم کن
npx prisma migrate dev --name init
npm run dev             # اجرای dev با هات‌ریلود
# یا برای production:
npm run build && npm start
```

## نقشه API

| متد | مسیر | شرح |
|---|---|---|
| POST | `/sellers` | ساخت فروشنده |
| GET | `/sellers/:id/products` | لیست محصولات فروشنده |
| POST | `/products` | ساخت محصول |
| GET/PATCH | `/products/:id` | دریافت/به‌روزرسانی محصول |
| POST/GET | `/products/:id/costs` | ثبت/تاریخچه بهای تمام‌شده |
| PUT/GET | `/products/:id/pricing-rule` | تعیین/دریافت قاعده قیمت‌گذاری |
| POST/GET | `/products/:id/competitor-prices` | ثبت/دریافت قیمت رقبا |
| POST/GET | `/products/:id/sales` | ثبت/دریافت تاریخچه فروش |
| GET | `/products/:id/margin?price=X` | محاسبه حاشیه سود برای قیمت فرضی |
| GET | `/products/:id/suggestion?strategy=MATCH` | قیمت پیشنهادی موتور |
| POST | `/products/:id/simulate` | شبیه‌سازی سناریوی تغییر قیمت |
| GET | `/products/:id/alerts` | هشدارهای فعال ریسک قیمت |
| GET | `/products/:id/wisdom?strategy=MATCH` | بینش‌های ترکیبی اولویت‌بندی‌شده + یک توصیه محوری (موتور خرد) |

## نمونه جریان کامل

```bash
# ۱) ساخت فروشنده و محصول
SELLER_ID=$(curl -s -X POST localhost:3000/sellers -H 'Content-Type: application/json' \
  -d '{"name":"فروشگاه نمونه","email":"shop@example.com"}' | jq -r .id)

PRODUCT_ID=$(curl -s -X POST localhost:3000/products -H 'Content-Type: application/json' \
  -d "{\"sellerId\":\"$SELLER_ID\",\"sku\":\"SKU-1\",\"name\":\"محصول تستی\",\"currentPrice\":250000}" | jq -r .id)

# ۲) ثبت بهای تمام‌شده
curl -X POST localhost:3000/products/$PRODUCT_ID/costs -H 'Content-Type: application/json' \
  -d '{"unitCost":150000,"packagingCost":5000,"shippingCost":15000,"commissionRate":0.08,"returnRate":0.03}'

# ۳) تعیین قاعده قیمت‌گذاری
curl -X PUT localhost:3000/products/$PRODUCT_ID/pricing-rule -H 'Content-Type: application/json' \
  -d '{"minMarginPct":0.15,"strategy":"MATCH"}'

# ۴) ثبت قیمت رقبا
curl -X POST localhost:3000/products/$PRODUCT_ID/competitor-prices -H 'Content-Type: application/json' \
  -d '{"competitorName":"رقیب الف","channel":"digikala","price":260000}'

# ۵) دریافت پیشنهاد قیمت
curl localhost:3000/products/$PRODUCT_ID/suggestion

# ۶) بررسی هشدارهای ریسک روی قیمت فعلی
curl localhost:3000/products/$PRODUCT_ID/alerts

# ۷) گرفتن توصیه ترکیبی و اولویت‌بندی‌شده (موتور خرد)
curl localhost:3000/products/$PRODUCT_ID/wisdom
```

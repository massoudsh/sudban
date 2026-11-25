# Merchant Workflows

> گردش‌کارهای فروشنده از commit `33638fd` به بعد: ورود حساب، ورود کاتالوگ، سود واقعی، تأیید قیمت و موجودی.

## مسئولیت‌ها
- **ورود:** `POST /accounts/register|login` رمز bcrypt و نشست ۸ ساعته (`SellerSession.tokenHash`) می‌سازد؛ توکن در UI فقط حافظه‌ای است. اعضای تیم کلید مستقل دارند و `actorRole` آن‌ها (نه نقش مالک) در RBAC سنجیده می‌شود.
- **دمو:** `POST /accounts/demo` فقط با `DEMO_MODE=true` یک فروشنده OWNER نمونه ایجاد/بازیابی می‌کند؛ پیش‌فرض `404`.
- **ورود کاتالوگ:** `POST /imports/file` CSV/XLSX خام (≤۱MB، ≤۵۰۰ ردیف، هدر تکراری رد) و `POST /imports/catalog` نگاشت ستون، ارقام فارسی/عربی و `IRR|IRT`؛ preview بدون نوشتن و commit اتمیک.
- **سود واقعی:** `SalesRecord.unitCostSnapshot` هزینه زمان فروش است؛ پنج ستون کسورات (`commissionAmount`, `shippingSubsidy`, `discountAmount`, `returnCost`, `settlementDeduction`) برای کل تراکنش یک‌بار کم می‌شوند. بدون snapshot سود `null` می‌ماند (حدس زده نمی‌شود).
- **تأیید قیمت:** `PriceApproval` چرخه `RECOMMENDED → APPROVED|REJECTED → APPLIED → ROLLED_BACK`؛ apply/rollback در تراکنش Serializable با کنترل وضعیت و قیمت موردانتظار و بررسی مجدد کف هزینه انجام می‌شود.
- **گزارش‌ها:** `GET /merchant/profit` (SKU/کانال)، `/channel-performance`، `/tax-report` (برآورد VAT با `estimateOnly:true`).
- **کانال‌ها:** `GET /merchant/feeds/:channel` XML برای `torob|emalls|basalam|store`؛ افزونه دستی WooCommerce در `integrations/woocommerce/`.

- **بینش بازار:** MAP، پیش‌بینی اتمام موجودی از فروش ۳۰ روز اخیر، جایگاه قیمت در باند رقبا، تاریخچه زمانی قیمت و بیشترین تخفیف ایمن. همه فقط خواندنی‌اند و قیمت را خودکار تغییر نمی‌دهند.

## وابستگی‌ها
- [[concepts/auth]] — نشست، نقش عضو و کلید API
- [[entities/api-routes]] — مسیرهای `/merchant`, `/accounts`, `/imports`
- [[entities/data-model]] — `SellerSession`, `PriceApproval`, فیلدهای `SalesRecord` و `Product`

## قراردادها / Edge cases
- apply/rollback فقط `scope:"LOCAL_CATALOG"` را تغییر می‌دهد؛ `marketplaceApplied:false` و هیچ ادعای اجرای خارجی وجود ندارد.
- قیمت رقیب فقط وقتی در محاسبه می‌آید که موجود، ریالی، `matchConfidence >= 0.9` و کمتر از ۲۴ ساعت عمر داشته باشد.
- ورودی تومان فقط یک‌بار ×۱۰ می‌شود؛ هزینه خالی صفر فرض نمی‌شود.
- `workbookGuard` پیش از پارس XLSX اجرا می‌شود (۲۰۰ entry، ۸MB بازشده، فقط stored/deflate).
- پرداخت و آداپتور مارکت‌پلیس متصل نیست؛ پلن پولی بدون تأیید پرداخت `409` می‌گیرد.

## منابع کد
- `src/routes/accounts.ts`, `src/routes/merchant.ts`, `src/routes/imports.ts`
- `src/services/merchantInsights.ts` — MAP، پیش‌بینی موجودی، جایگاه قیمت، تاریخچه و تخفیف
- `src/services/merchantFinance.ts`, `src/services/catalogImport.ts`, `src/services/workbookGuard.ts`, `src/services/billingPlans.ts`
- `public/dashboard.js`, `public/workflows.js`, `public/dashboard.css`

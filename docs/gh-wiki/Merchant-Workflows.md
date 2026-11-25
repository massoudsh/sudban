# Merchant Workflows

> mirror از `docs/wiki/concepts/merchant-workflows.md` — منبع حقیقت همان‌جاست.

گردش‌کارهای فروشنده از commit `33638fd` به بعد: ورود حساب، ورود کاتالوگ، سود واقعی، تأیید قیمت و موجودی.

## مسئولیت‌ها
- **ورود:** `POST /accounts/register|login` رمز bcrypt و نشست ۸ ساعته (`SellerSession.tokenHash`) می‌سازد؛ توکن در UI فقط حافظه‌ای است. اعضای تیم کلید مستقل دارند و نقش عضو (نه مالک) در RBAC سنجیده می‌شود.
- **دمو:** `POST /accounts/demo` فقط با `DEMO_MODE=true` فروشنده OWNER نمونه می‌دهد؛ پیش‌فرض `404`.
- **ورود کاتالوگ:** `POST /imports/file` (CSV/XLSX، ≤۱MB، ≤۵۰۰ ردیف) و `POST /imports/catalog` (نگاشت، ارقام فارسی/عربی، `IRR|IRT`، preview بدون نوشتن و commit اتمیک).
- **سود واقعی:** `unitCostSnapshot` هزینه زمان فروش است؛ کسورات (`commissionAmount`, `shippingSubsidy`, `discountAmount`, `returnCost`, `settlementDeduction`) یک‌بار کم می‌شوند؛ بدون snapshot سود `null` است.
- **تأیید قیمت:** `RECOMMENDED → APPROVED|REJECTED → APPLIED → ROLLED_BACK`، در تراکنش Serializable با کنترل وضعیت/قیمت و بررسی مجدد کف هزینه.
- **گزارش‌ها:** `/merchant/profit`, `/channel-performance`, `/tax-report` (برآورد VAT با `estimateOnly:true`).
- **کانال‌ها:** فید XML برای `torob|emalls|basalam|store`؛ افزونه دستی WooCommerce.

- **بینش بازار:** MAP، پیش‌بینی اتمام موجودی، جایگاه قیمت، تاریخچه قیمت و تخفیف ایمن — همه خواندنی و بدون تغییر خودکار قیمت.

## قراردادها / Edge cases
- apply/rollback فقط `scope:"LOCAL_CATALOG"` را تغییر می‌دهد؛ `marketplaceApplied:false`.
- قیمت رقیب فقط اگر موجود، ریالی، `matchConfidence >= 0.9` و کمتر از ۲۴ ساعت عمر داشته باشد.
- ورودی تومان فقط یک‌بار ×۱۰؛ هزینه خالی صفر فرض نمی‌شود.
- پرداخت و آداپتور مارکت‌پلیس متصل نیست؛ پلن پولی بدون تأیید پرداخت `409` می‌گیرد.

## منابع کد
- `src/routes/accounts.ts`, `src/routes/merchant.ts`, `src/routes/imports.ts`
- `src/services/merchantFinance.ts`, `src/services/catalogImport.ts`, `src/services/workbookGuard.ts`
- `public/dashboard.js`, `public/workflows.js`

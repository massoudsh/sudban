# Auth & RBAC

> دو مسیر ورود به API: کلید API (فروشنده یا عضو تیم) و نشست حساب (`sb_session_`).

## مسئولیت‌ها
- `requireAuth` هدر `Authorization: Bearer` یا `x-api-key` را می‌خواند. اگر توکن با `sb_session_` شروع شود، digest SHA256 در `SellerSession` جست‌وجو و انقضای آن بررسی می‌شود؛ در غیر این صورت کلید API فروشنده و سپس کلید فعال عضو تیم امتحان می‌شود.
- `req.actorRole/actorId/sessionId` پر می‌شود تا `requireRole` نقش **عضو** را بسنجد نه نقش مالک.
- `requireOwnedProduct` مالکیت را تضمین می‌کند و در صورت عدم تطابق `404` می‌دهد (جلوگیری از enumeration).
- هر درخواست احرازشده فقط یک بار `UsageEvent` نوع `API_REQUEST` ثبت می‌کند؛ `requireAuth` اگر `req.seller` از قبل پر باشد دوباره احراز هویت نمی‌کند.
- `POST /accounts/logout` نشست جاری را حذف می‌کند؛ `POST /accounts/demo` فقط با `DEMO_MODE=true` نشست مالک نمونه می‌دهد.

## وابستگی‌ها
- [[concepts/merchant-workflows]] — ورود حساب، نشست و نقش‌ها در UI
- [[entities/api-routes]] — mount شدن روترها و scope آن‌ها

## قراردادها / Edge cases
- کلید API فقط یک‌بار در پاسخ ساخت نمایش داده می‌شود؛ در دیتابیس فقط `apiKeyPrefix` و `apiKeyHash` (bcrypt) می‌ماند.
- توکن نشست خام ذخیره نمی‌شود؛ فقط `tokenHash` (SHA256، یکتا) با `expiresAt`.
- پاسخ‌های پروفایل و تیم هرگز `passwordHash`/`apiKeyHash` را برنمی‌گردانند.
- خطای نبود/نقص کلید همیشه `401` با پیام فارسی است؛ عضو غیرفعال هم `401` می‌گیرد.
- توکن دمو در production وجود ندارد؛ مسیر بدون `DEMO_MODE=true` مقدار `404` برمی‌گرداند.

## منابع کد
- `src/lib/auth.ts` — `requireAuth`, `requireRole`, `requireOwnedProduct`
- `src/lib/apiKey.ts` — تولید/هش/verify کلید
- `src/routes/accounts.ts` — register/login/logout/demo
- `src/routes/sellers.ts` — پروفایل امن، تیم، اشتراک

# Deployment (Docker)

> ساخت ایمیج چندمرحله‌ای، اجرای migration و استقرار API با Docker Compose.

## مسئولیت‌ها
- `Dockerfile` سه stage دارد: `build` (dependency کامل + `prisma generate` + `tsc`)، `migrate` (همان build با Prisma CLI برای `migrate deploy`) و `runtime` (فقط dependencyهای production، کاربر غیر روت `node`، healthcheck روی `/health`).
- `docker/entrypoint.sh` نبود `DATABASE_URL` را سریع گزارش می‌کند و با `WAIT_FOR_DB=true` تا آمادگی TCP دیتابیس صبر می‌کند.
- `docker-compose.yml` سه سرویس دارد: `db` (postgres:16-alpine با healthcheck)، `migrate` (یک‌بار، `restart: "no"`) و `app` که فقط بعد از `service_healthy` و `service_completed_successfully` بالا می‌آید.
- `DATABASE_URL` صریح از `.env` خوانده می‌شود (بدون interpolation تو در تو) تا رفتار قابل پیش‌بینی بماند.

## وابستگی‌ها
- [[entities/data-model]] — baseline و زنجیره migration روی همین مدل‌ها اعمال می‌شود
- [[entities/api-routes]] — healthcheck و پورت از `src/server.ts` می‌آید

## قراردادها / Edge cases
- baseline `prisma/migrations/20260101000000_init/migration.sql` از اسکیمای اولیه (`ce577e6`) تولید شده تا دیتابیس تازه کامل بالا بیاید؛ زنجیره سه migration با اسکیمای فعلی (۱۵ جدول) مطابقت دارد.
- دیتابیس قدیمیِ بدون baseline باید با `npx prisma migrate resolve --applied 20260101000000_init` علامت بخورد.
- پس از `npm prune --omit=dev`، Prisma CLI به‌عنوان optional peer باقی می‌ماند؛ به همین دلیل stage `migrate` جدا نگه داشته شد.
- `.dockerignore` مسیرهای `node_modules`، `dist`، `.env`، `uploads` و `.noqte` را از build context حذف می‌کند.
- ساخت ایمیج در کانتینر توسعه ممنوع است؛ روی سرور یا ماشین محلی اجرا شود.

## منابع کد
- `Dockerfile` — stage ها و healthcheck
- `docker-compose.yml` — سرویس‌ها و شرط‌های `depends_on`
- `docker/entrypoint.sh` — گارد env و انتظار دیتابیس
- `.dockerignore`
- `prisma/migrations/20260101000000_init/migration.sql`

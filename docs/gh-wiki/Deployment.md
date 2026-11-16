# Deployment

> mirror از `docs/wiki/concepts/deployment.md` — منبع حقیقت همان‌جاست.

## مسئولیت‌ها
- `Dockerfile` سه stage: `build` (dependency کامل + `prisma generate` + `tsc`)، `migrate` (Prisma CLI برای `migrate deploy`) و `runtime` (فقط dependencyهای production، کاربر غیر روت `node`، healthcheck روی `/health`).
- `docker/entrypoint.sh`: بررسی `DATABASE_URL` و انتظار TCP برای دیتابیس با `WAIT_FOR_DB=true`.
- `docker-compose.yml`: `db` (postgres:16-alpine)، `migrate` (یک‌بار، `restart: "no"`) و `app` با `depends_on` شرطی.

## قراردادها / Edge cases
- baseline `prisma/migrations/20260101000000_init/migration.sql` از اسکیمای اولیه تولید شده؛ زنجیره سه migration با اسکیمای فعلی (۱۵ جدول) مطابقت دارد.
- دیتابیس قدیمی بدون baseline: `npx prisma migrate resolve --applied 20260101000000_init`.
- `.dockerignore` شامل `node_modules`, `dist`, `.env`, `uploads`, `.noqte` است.
- ساخت ایمیج در کانتینر توسعه ممنوع است؛ روی سرور یا ماشین محلی اجرا شود.

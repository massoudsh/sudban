import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { sellersRouter } from "./routes/sellers";
import { productsRouter } from "./routes/products";
import { costsRouter } from "./routes/costs";
import { pricingRulesRouter } from "./routes/pricingRules";
import { competitorsRouter } from "./routes/competitors";
import { salesRouter } from "./routes/sales";
import { pricingRouter } from "./routes/pricing";
import { bulkImportRouter } from "./routes/bulkImport";

/** خواندن مقدار عددی از env؛ مقدار خالی/نامعتبر/غیرمثبت نادیده گرفته می‌شود و fallback برمی‌گردد. */
function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const app = express();

app.set("trust proxy", 1);
app.use(helmet());

// اجازه دسترسی فقط به origin های صراحتاً مجاز (CORS_ORIGINS در env، جدا با کاما). خالی = بدون CORS مرورگری (فقط سرور-به-سرور).
const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("این origin توسط CORS مجاز نیست"));
      }
    },
  })
);

// محافظت پایه در برابر بار زیاد/brute-force؛ اعداد از env قابل تنظیم‌اند
const globalLimiter = rateLimit({
  windowMs: envInt("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  limit: envInt("RATE_LIMIT_MAX", 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "تعداد درخواست‌ها بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید" },
});
app.use(globalLimiter);

// محدودیت اندازه بدنه (پیش‌فرض ۱ مگابایت)؛ بدنه بزرگ‌تر از حد، پیش از رسیدن به route با ۴۱۳ رد می‌شود
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "1mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok", service: "sudban" }));

app.use("/sellers", sellersRouter);
app.use("/products", productsRouter);
// این روترها همگی زیر پیشوند /products هستند و مسیر خودشان را با /:id/... تعریف می‌کنند
app.use("/products", costsRouter);
app.use("/products", pricingRulesRouter);
app.use("/products", competitorsRouter);
app.use("/products", salesRouter);
app.use("/products", pricingRouter);
app.use("/products", bulkImportRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "مسیر یافت نشد" });
});

// خطاهای سطح کلاینت (JSON نامعتبر، بدنه بزرگ‌تر از حد مجاز، محتوای ناپشتیبان‌شده) توسط
// body-parser با کد وضعیت همراه می‌شوند؛ این‌ها نباید به ۵۰۰ تبدیل شوند.
const CLIENT_ERROR_MESSAGES: Record<number, string> = {
  400: "بدنه درخواست نامعتبر است (JSON نامعتبر)",
  413: "حجم بدنه درخواست بیش از حد مجاز است",
  415: "نوع محتوای درخواست پشتیبانی نمی‌شود",
};

function clientErrorStatus(err: unknown): number | null {
  if (typeof err !== "object" || err === null) return null;
  const { status, statusCode } = err as { status?: unknown; statusCode?: unknown };
  const code = typeof status === "number" ? status : typeof statusCode === "number" ? statusCode : null;
  return code !== null && CLIENT_ERROR_MESSAGES[code] ? code : null;
}

// هندلر خطای مرکزی
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);

  const status = clientErrorStatus(err);
  if (status !== null) {
    res.status(status).json({ error: CLIENT_ERROR_MESSAGES[status] });
    return;
  }

  res.status(500).json({ error: "خطای داخلی سرور" });
});

const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, () => {
  console.log(`سودبان API روی پورت ${port} در حال اجراست`);
});

// تایم‌اوت‌های محافظتی: جلوگیری از اشغال اتصال توسط کلاینت کند/ناتمام (مقادیر از env قابل تنظیم‌اند)
// requestTimeout عمداً سخاوتمندانه است چون bulk-import تا ۵۰۰۰ ردیف را در یک درخواست پردازش می‌کند؛
// headersTimeout سخت‌گیرانه می‌ماند چون هدرهای درخواست باید سریع برسند (محافظت پایه در برابر slowloris).
server.requestTimeout = envInt("REQUEST_TIMEOUT_MS", 120_000);
server.headersTimeout = envInt("HEADERS_TIMEOUT_MS", 15_000);
server.keepAliveTimeout = envInt("KEEP_ALIVE_TIMEOUT_MS", 5_000);

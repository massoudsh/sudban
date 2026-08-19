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
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_MAX) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "تعداد درخواست‌ها بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید" },
});
app.use(globalLimiter);

app.use(express.json({ limit: "1mb" }));

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

// هندلر خطای مرکزی
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "خطای داخلی سرور" });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`سودبان API روی پورت ${port} در حال اجراست`);
});

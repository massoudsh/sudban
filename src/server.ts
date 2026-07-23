import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import { sellersRouter } from "./routes/sellers";
import { productsRouter } from "./routes/products";
import { costsRouter } from "./routes/costs";
import { pricingRulesRouter } from "./routes/pricingRules";
import { competitorsRouter } from "./routes/competitors";
import { salesRouter } from "./routes/sales";
import { pricingRouter } from "./routes/pricing";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok", service: "sudban" }));

app.use("/sellers", sellersRouter);
app.use("/products", productsRouter);
// این چهار روتر همگی زیر پیشوند /products هستند و مسیر خودشان را با /:id/... تعریف می‌کنند
app.use("/products", costsRouter);
app.use("/products", pricingRulesRouter);
app.use("/products", competitorsRouter);
app.use("/products", salesRouter);
app.use("/products", pricingRouter);

// هندلر خطای مرکزی
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "خطای داخلی سرور" });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`سودبان API روی پورت ${port} در حال اجراست`);
});

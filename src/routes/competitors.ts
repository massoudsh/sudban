import { Router } from "express";
import { prisma } from "../lib/prisma";

export const competitorsRouter = Router();

// POST /products/:id/competitor-prices — ثبت قیمت رقیب (دستی یا از منبع خارجی)
competitorsRouter.post("/:id/competitor-prices", async (req, res) => {
  const productId = req.params.id;
  const { competitorName, channel, price, currency = "IRR", capturedAt } = req.body ?? {};

  if (!competitorName || !channel || price == null || price <= 0) {
    return res.status(400).json({ error: "competitorName، channel و price (مثبت) الزامی هستند" });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return res.status(404).json({ error: "محصول یافت نشد" });

  const competitorPrice = await prisma.competitorPrice.create({
    data: {
      productId,
      competitorName,
      channel,
      price,
      currency,
      capturedAt: capturedAt ? new Date(capturedAt) : undefined,
    },
  });

  res.status(201).json(competitorPrice);
});

competitorsRouter.get("/:id/competitor-prices", async (req, res) => {
  const prices = await prisma.competitorPrice.findMany({
    where: { productId: req.params.id },
    orderBy: { capturedAt: "desc" },
  });
  res.json(prices);
});

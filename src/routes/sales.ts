import { Router } from "express";
import { prisma } from "../lib/prisma";

export const salesRouter = Router();

// POST /products/:id/sales — ثبت رکورد فروش تاریخی
salesRouter.post("/:id/sales", async (req, res) => {
  const productId = req.params.id;
  const { price, quantity, channel, soldAt } = req.body ?? {};

  if (price == null || price <= 0 || quantity == null || quantity <= 0) {
    return res.status(400).json({ error: "price و quantity (هر دو مثبت) الزامی هستند" });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return res.status(404).json({ error: "محصول یافت نشد" });

  const record = await prisma.salesRecord.create({
    data: {
      productId,
      price,
      quantity,
      channel: channel ?? null,
      soldAt: soldAt ? new Date(soldAt) : new Date(),
    },
  });

  res.status(201).json(record);
});

salesRouter.get("/:id/sales", async (req, res) => {
  const records = await prisma.salesRecord.findMany({
    where: { productId: req.params.id },
    orderBy: { soldAt: "desc" },
  });
  res.json(records);
});

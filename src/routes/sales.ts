import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireOwnedProduct } from "../lib/auth";
import { validate } from "../lib/validate";
import { salesRecordSchema } from "../lib/schemas";

export const salesRouter = Router();

salesRouter.use(requireAuth);

// POST /products/:id/sales — ثبت رکورد فروش تاریخی
salesRouter.post("/:id/sales", requireOwnedProduct, validate(salesRecordSchema), async (req, res) => {
  const productId = req.params.id;
  const { price, quantity, channel, soldAt } = req.body;

  const record = await prisma.salesRecord.create({
    data: {
      productId,
      price,
      quantity,
      channel: channel ?? null,
      soldAt: soldAt ?? new Date(),
    },
  });

  res.status(201).json(record);
});

salesRouter.get("/:id/sales", requireOwnedProduct, async (req, res) => {
  const records = await prisma.salesRecord.findMany({
    where: { productId: req.params.id },
    orderBy: { soldAt: "desc" },
  });
  res.json(records);
});

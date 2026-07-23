import { Router } from "express";
import { prisma } from "../lib/prisma";

export const costsRouter = Router();

// POST /products/:id/costs — ثبت نسخه جدید بهای تمام‌شده (نسخه قبلی غیرفعال می‌شود)
costsRouter.post("/:id/costs", async (req, res) => {
  const productId = req.params.id;
  const {
    unitCost,
    packagingCost = 0,
    shippingCost = 0,
    otherFixedCost = 0,
    commissionRate = 0,
    returnRate = 0,
  } = req.body ?? {};

  if (unitCost == null || unitCost < 0) {
    return res.status(400).json({ error: "unitCost الزامی و باید غیرمنفی باشد" });
  }
  if (commissionRate < 0 || commissionRate >= 1 || returnRate < 0 || returnRate >= 1) {
    return res.status(400).json({ error: "commissionRate و returnRate باید بین ۰ و ۱ باشند" });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return res.status(404).json({ error: "محصول یافت نشد" });

  const costProfile = await prisma.$transaction(async (tx) => {
    await tx.costProfile.updateMany({
      where: { productId, isActive: true },
      data: { isActive: false },
    });

    return tx.costProfile.create({
      data: {
        productId,
        unitCost,
        packagingCost,
        shippingCost,
        otherFixedCost,
        commissionRate,
        returnRate,
        isActive: true,
      },
    });
  });

  res.status(201).json(costProfile);
});

// GET /products/:id/costs — تاریخچه بهای تمام‌شده
costsRouter.get("/:id/costs", async (req, res) => {
  const costProfiles = await prisma.costProfile.findMany({
    where: { productId: req.params.id },
    orderBy: { effectiveFrom: "desc" },
  });
  res.json(costProfiles);
});

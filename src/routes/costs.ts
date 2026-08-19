import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireOwnedProduct } from "../lib/auth";
import { validate } from "../lib/validate";
import { createCostProfileSchema } from "../lib/schemas";

export const costsRouter = Router();

costsRouter.use(requireAuth);

// POST /products/:id/costs — ثبت نسخه جدید بهای تمام‌شده (نسخه قبلی غیرفعال می‌شود)
costsRouter.post(
  "/:id/costs",
  requireOwnedProduct,
  validate(createCostProfileSchema),
  async (req, res) => {
    const productId = req.params.id;
    const { unitCost, packagingCost, shippingCost, otherFixedCost, commissionRate, returnRate } = req.body;

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
  }
);

// GET /products/:id/costs — تاریخچه بهای تمام‌شده
costsRouter.get("/:id/costs", requireOwnedProduct, async (req, res) => {
  const costProfiles = await prisma.costProfile.findMany({
    where: { productId: req.params.id },
    orderBy: { effectiveFrom: "desc" },
  });
  res.json(costProfiles);
});

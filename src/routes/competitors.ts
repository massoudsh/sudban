import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireOwnedProduct } from "../lib/auth";
import { validate } from "../lib/validate";
import { competitorPriceSchema } from "../lib/schemas";

export const competitorsRouter = Router();

competitorsRouter.use(requireAuth);

// POST /products/:id/competitor-prices — ثبت قیمت رقیب (دستی یا از منبع خارجی)
competitorsRouter.post(
  "/:id/competitor-prices",
  requireOwnedProduct,
  validate(competitorPriceSchema),
  async (req, res) => {
    const productId = req.params.id;
    const { competitorName, channel, price, currency, capturedAt } = req.body;

    const competitorPrice = await prisma.competitorPrice.create({
      data: { productId, competitorName, channel, price, currency, capturedAt },
    });

    res.status(201).json(competitorPrice);
  }
);

competitorsRouter.get("/:id/competitor-prices", requireOwnedProduct, async (req, res) => {
  const prices = await prisma.competitorPrice.findMany({
    where: { productId: req.params.id },
    orderBy: { capturedAt: "desc" },
  });
  res.json(prices);
});

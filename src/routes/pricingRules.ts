import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireOwnedProduct } from "../lib/auth";
import { validate } from "../lib/validate";
import { pricingRuleSchema } from "../lib/schemas";

export const pricingRulesRouter = Router();

pricingRulesRouter.use(requireAuth);

// PUT /products/:id/pricing-rule — تعیین/به‌روزرسانی قاعده قیمت‌گذاری
pricingRulesRouter.put(
  "/:id/pricing-rule",
  requireOwnedProduct,
  validate(pricingRuleSchema),
  async (req, res) => {
    const productId = req.params.id;
    const { minMarginPct, targetMarginPct, floorPrice, ceilingPrice, strategy, priceElasticity } = req.body;

    const rule = await prisma.pricingRule.upsert({
      where: { productId },
      update: { minMarginPct, targetMarginPct, floorPrice, ceilingPrice, strategy, priceElasticity },
      create: { productId, minMarginPct, targetMarginPct, floorPrice, ceilingPrice, strategy, priceElasticity },
    });

    res.json(rule);
  }
);

pricingRulesRouter.get("/:id/pricing-rule", requireOwnedProduct, async (req, res) => {
  const rule = await prisma.pricingRule.findUnique({ where: { productId: req.params.id } });
  if (!rule) return res.status(404).json({ error: "قاعده قیمت‌گذاری برای این محصول ثبت نشده" });
  res.json(rule);
});

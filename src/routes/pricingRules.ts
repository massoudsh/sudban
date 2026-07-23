import { Router } from "express";
import { prisma } from "../lib/prisma";

export const pricingRulesRouter = Router();

const VALID_STRATEGIES = ["MATCH", "PREMIUM", "PENETRATION"];

// PUT /products/:id/pricing-rule — تعیین/به‌روزرسانی قاعده قیمت‌گذاری
pricingRulesRouter.put("/:id/pricing-rule", async (req, res) => {
  const productId = req.params.id;
  const {
    minMarginPct,
    targetMarginPct,
    floorPrice,
    ceilingPrice,
    strategy = "MATCH",
    priceElasticity,
  } = req.body ?? {};

  if (minMarginPct == null || minMarginPct < 0 || minMarginPct >= 1) {
    return res.status(400).json({ error: "minMarginPct الزامی و باید بین ۰ و ۱ باشد" });
  }
  if (!VALID_STRATEGIES.includes(strategy)) {
    return res.status(400).json({ error: `strategy باید یکی از ${VALID_STRATEGIES.join(", ")} باشد` });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return res.status(404).json({ error: "محصول یافت نشد" });

  const rule = await prisma.pricingRule.upsert({
    where: { productId },
    update: { minMarginPct, targetMarginPct, floorPrice, ceilingPrice, strategy, priceElasticity },
    create: { productId, minMarginPct, targetMarginPct, floorPrice, ceilingPrice, strategy, priceElasticity },
  });

  res.json(rule);
});

pricingRulesRouter.get("/:id/pricing-rule", async (req, res) => {
  const rule = await prisma.pricingRule.findUnique({ where: { productId: req.params.id } });
  if (!rule) return res.status(404).json({ error: "قاعده قیمت‌گذاری برای این محصول ثبت نشده" });
  res.json(rule);
});

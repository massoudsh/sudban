import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import { loadProductPricingContext } from "../lib/productContext";
import { suggestPrice } from "../services/priceSuggestionEngine";
import { checkRisks } from "../services/riskAlertEngine";
import { computeSalesTrend } from "../services/salesTrend";
import { generateWisdom } from "../services/wisdomEngine";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get("/dashboard/wisdom", async (req, res) => {
  const products = await prisma.product.findMany({
    where: { sellerId: req.seller!.id },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const cards = [];
  for (const product of products) {
    if (!product.currentPrice) continue;
    try {
      const { costs, pricingRule, competitivePosition } = await loadProductPricingContext(product.id);
      const suggestion = suggestPrice({
        costs,
        minMarginPct: pricingRule.minMarginPct,
        floorPrice: pricingRule.floorPrice,
        ceilingPrice: pricingRule.ceilingPrice,
        strategy: pricingRule.strategy,
        competitivePosition,
      });
      const risks = checkRisks({
        price: product.currentPrice,
        costs,
        minMarginPct: pricingRule.minMarginPct,
        competitivePosition,
      });
      const salesRecords = await prisma.salesRecord.findMany({ where: { productId: product.id } });
      const salesTrend = computeSalesTrend(salesRecords);
      const wisdom = generateWisdom({
        currentPrice: product.currentPrice,
        costs,
        minMarginPct: pricingRule.minMarginPct,
        competitivePosition,
        suggestion,
        risks,
        salesTrend,
      });
      cards.push({ product, suggestion, risks, salesTrend, wisdom });
    } catch {
      cards.push({ product, setupRequired: true });
    }
  }

  res.json({ count: cards.length, cards });
});

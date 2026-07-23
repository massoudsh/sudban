import { Router } from "express";
import { prisma } from "../lib/prisma";
import { loadProductPricingContext, NotFoundError } from "../lib/productContext";
import { calculateMargin } from "../services/marginCalculator";
import { suggestPrice } from "../services/priceSuggestionEngine";
import { simulateScenario } from "../services/scenarioSimulator";
import { checkRisks } from "../services/riskAlertEngine";
import { Strategy } from "../types";

export const pricingRouter = Router();

function handleContextError(err: unknown, res: import("express").Response) {
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
    return true;
  }
  return false;
}

// GET /products/:id/margin?price=123000
pricingRouter.get("/:id/margin", async (req, res) => {
  const price = Number(req.query.price);
  if (!price || price <= 0) {
    return res.status(400).json({ error: "query param عددی price الزامی است" });
  }

  try {
    const { costs } = await loadProductPricingContext(req.params.id);
    res.json(calculateMargin(costs, price));
  } catch (err) {
    if (!handleContextError(err, res)) throw err;
  }
});

// GET /products/:id/suggestion?strategy=MATCH
pricingRouter.get("/:id/suggestion", async (req, res) => {
  const strategyParam = (req.query.strategy as string) || undefined;

  try {
    const { costs, pricingRule, competitivePosition } = await loadProductPricingContext(req.params.id);
    const strategy: Strategy = (strategyParam as Strategy) || pricingRule.strategy;

    const result = suggestPrice({
      costs,
      minMarginPct: pricingRule.minMarginPct,
      floorPrice: pricingRule.floorPrice,
      ceilingPrice: pricingRule.ceilingPrice,
      strategy,
      competitivePosition,
    });

    await prisma.priceSuggestion.create({
      data: {
        productId: req.params.id,
        suggestedPrice: result.suggestedPrice,
        expectedMarginPct: result.expectedMarginPct,
        competitivenessScore: result.competitivenessScore,
        strategy,
        rationale: result.rationale,
      },
    });

    res.json(result);
  } catch (err) {
    if (!handleContextError(err, res)) throw err;
  }
});

// POST /products/:id/simulate { hypotheticalPrice, baselinePrice?, baselineAvgQuantity?, elasticity? }
pricingRouter.post("/:id/simulate", async (req, res) => {
  const { hypotheticalPrice, baselinePrice, baselineAvgQuantity, elasticity } = req.body ?? {};

  if (!hypotheticalPrice || hypotheticalPrice <= 0) {
    return res.status(400).json({ error: "hypotheticalPrice (مثبت) الزامی است" });
  }

  try {
    const { product, costs, pricingRule } = await loadProductPricingContext(req.params.id);

    const resolvedBaselinePrice = baselinePrice ?? product.currentPrice;
    if (!resolvedBaselinePrice) {
      return res
        .status(400)
        .json({ error: "baselinePrice الزامی است چون قیمت فعلی محصول (currentPrice) ثبت نشده" });
    }

    let resolvedBaselineQuantity = baselineAvgQuantity;
    if (resolvedBaselineQuantity == null) {
      const salesRecords = await prisma.salesRecord.findMany({ where: { productId: req.params.id } });
      resolvedBaselineQuantity =
        salesRecords.length > 0
          ? salesRecords.reduce((sum, r) => sum + r.quantity, 0) / salesRecords.length
          : 1; // بدون داده فروش، فرض خنثی ۱ واحد برای نمایش نسبت‌ها
    }

    const result = simulateScenario({
      costs,
      hypotheticalPrice,
      baselinePrice: resolvedBaselinePrice,
      baselineAvgQuantity: resolvedBaselineQuantity,
      elasticity: elasticity ?? pricingRule.priceElasticity ?? undefined,
    });

    res.json(result);
  } catch (err) {
    if (!handleContextError(err, res)) throw err;
  }
});

// GET /products/:id/alerts — بررسی وضعیت فعلی و برگرداندن هشدارهای فعال (حل‌نشده)
pricingRouter.get("/:id/alerts", async (req, res) => {
  try {
    const { product, costs, pricingRule, competitivePosition } = await loadProductPricingContext(
      req.params.id
    );

    if (!product.currentPrice) {
      return res.status(400).json({ error: "currentPrice برای این محصول ثبت نشده؛ ابتدا آن را تنظیم کنید" });
    }

    const candidates = checkRisks({
      price: product.currentPrice,
      costs,
      minMarginPct: pricingRule.minMarginPct,
      competitivePosition,
    });

    const candidateTypes = candidates.map((c) => c.type);

    // هشدارهایی که دیگر مصداق ندارند را resolve کن
    await prisma.alert.updateMany({
      where: { productId: req.params.id, resolvedAt: null, type: { notIn: candidateTypes } },
      data: { resolvedAt: new Date() },
    });

    // برای هر هشدار جدید که از قبل رکورد باز مشابه ندارد، رکورد بساز
    const openAlerts = await prisma.alert.findMany({
      where: { productId: req.params.id, resolvedAt: null },
    });
    const openTypes = new Set(openAlerts.map((a) => a.type));

    for (const candidate of candidates) {
      if (!openTypes.has(candidate.type)) {
        await prisma.alert.create({
          data: {
            productId: req.params.id,
            type: candidate.type,
            severity: candidate.severity,
            message: candidate.message,
            context: candidate.context,
          },
        });
      }
    }

    const activeAlerts = await prisma.alert.findMany({
      where: { productId: req.params.id, resolvedAt: null },
      orderBy: { createdAt: "desc" },
    });

    res.json(activeAlerts);
  } catch (err) {
    if (!handleContextError(err, res)) throw err;
  }
});

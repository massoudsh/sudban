import { Router } from "express";
import { prisma } from "../lib/prisma";
import { loadProductPricingContext, NotFoundError } from "../lib/productContext";
import { requireAuth, requireOwnedProduct } from "../lib/auth";
import { validate } from "../lib/validate";
import { marginQuerySchema, strategyQuerySchema, simulateScenarioSchema } from "../lib/schemas";
import { calculateMargin } from "../services/marginCalculator";
import { suggestPrice } from "../services/priceSuggestionEngine";
import { simulateScenario } from "../services/scenarioSimulator";
import { checkRisks } from "../services/riskAlertEngine";
import { computeSalesTrend } from "../services/salesTrend";
import { generateWisdom } from "../services/wisdomEngine";
import { notifyNewAlerts } from "../services/notifier";
import { Strategy } from "../types";

export const pricingRouter = Router();

pricingRouter.use(requireAuth);

function handleContextError(err: unknown, res: import("express").Response) {
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
    return true;
  }
  return false;
}

// GET /products/:id/margin?price=123000
pricingRouter.get(
  "/:id/margin",
  requireOwnedProduct,
  validate(marginQuerySchema, "query"),
  async (req, res) => {
    const price = Number(req.query.price);

    try {
      const { costs } = await loadProductPricingContext(req.params.id);
      res.json(calculateMargin(costs, price));
    } catch (err) {
      if (!handleContextError(err, res)) throw err;
    }
  }
);

// GET /products/:id/suggestion?strategy=MATCH
pricingRouter.get(
  "/:id/suggestion",
  requireOwnedProduct,
  validate(strategyQuerySchema, "query"),
  async (req, res) => {
    const strategyParam = req.query.strategy as Strategy | undefined;

    try {
      const { costs, pricingRule, competitivePosition } = await loadProductPricingContext(req.params.id);
      const strategy: Strategy = strategyParam || pricingRule.strategy;

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
  }
);

// POST /products/:id/simulate { hypotheticalPrice, baselinePrice?, baselineAvgQuantity?, elasticity? }
pricingRouter.post(
  "/:id/simulate",
  requireOwnedProduct,
  validate(simulateScenarioSchema),
  async (req, res) => {
    const { hypotheticalPrice, baselinePrice, baselineAvgQuantity, elasticity } = req.body;

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
  }
);

// GET /products/:id/alerts — بررسی وضعیت فعلی، برگرداندن هشدارهای فعال و اطلاع‌رسانی هشدارهای تازه (#6)
pricingRouter.get("/:id/alerts", requireOwnedProduct, async (req, res) => {
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

    // برای هر هشدار جدید که از قبل رکورد باز مشابه ندارد، رکورد بساز و اطلاع‌رسانی کن
    const openAlerts = await prisma.alert.findMany({
      where: { productId: req.params.id, resolvedAt: null },
    });
    const openTypes = new Set(openAlerts.map((a) => a.type));

    const freshCandidates = candidates.filter((c) => !openTypes.has(c.type));

    for (const candidate of freshCandidates) {
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

    if (freshCandidates.length > 0) {
      // best-effort، بدون بلاک کردن پاسخ API در صورت کندی/خطای کانال بیرونی
      void notifyNewAlerts({
        seller: req.seller!,
        productName: product.name,
        productSku: product.sku,
        alerts: freshCandidates,
      });
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

// GET /products/:id/wisdom?strategy=MATCH — بینش‌های ترکیبی و توصیه اولویت‌بندی‌شده (موتور خرد)
pricingRouter.get(
  "/:id/wisdom",
  requireOwnedProduct,
  validate(strategyQuerySchema, "query"),
  async (req, res) => {
    try {
      const { product, costs, pricingRule, competitivePosition } = await loadProductPricingContext(
        req.params.id
      );

      if (!product.currentPrice) {
        return res.status(400).json({ error: "currentPrice برای این محصول ثبت نشده؛ ابتدا آن را تنظیم کنید" });
      }

      const strategyParam = req.query.strategy as Strategy | undefined;
      const strategy: Strategy = strategyParam || pricingRule.strategy;

      const suggestion = suggestPrice({
        costs,
        minMarginPct: pricingRule.minMarginPct,
        floorPrice: pricingRule.floorPrice,
        ceilingPrice: pricingRule.ceilingPrice,
        strategy,
        competitivePosition,
      });

      const risks = checkRisks({
        price: product.currentPrice,
        costs,
        minMarginPct: pricingRule.minMarginPct,
        competitivePosition,
      });

      const salesRecords = await prisma.salesRecord.findMany({ where: { productId: req.params.id } });
      const salesTrend = computeSalesTrend(salesRecords);

      const report = generateWisdom({
        currentPrice: product.currentPrice,
        costs,
        minMarginPct: pricingRule.minMarginPct,
        competitivePosition,
        suggestion,
        risks,
        salesTrend,
      });

      res.json(report);
    } catch (err) {
      if (!handleContextError(err, res)) throw err;
    }
  }
);

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireOwnedProduct, requireRole } from "../lib/auth";
import { validate } from "../lib/validate";
import { createProductSchema, createCostProfileSchema, pricingRuleSchema } from "../lib/schemas";
import { loadProductPricingContext } from "../lib/productContext";
import { calculateMargin, calculatePriceFloor } from "../services/marginCalculator";
import { netProfit, priceSafety, replacementProtection } from "../services/merchantFinance";

export const merchantRouter = Router();
merchantRouter.use(requireAuth);
const writer = requireRole("OWNER", "MANAGER");
const onboarding = z.object({ product: createProductSchema, costs: createCostProfileSchema, rule: pricingRuleSchema })
  .refine(d => d.costs.commissionRate + d.rule.minMarginPct < 1, "کمیسیون و حاشیه سود ناسازگار است")
  .refine(d => d.rule.ceilingPrice == null || d.rule.floorPrice == null || d.rule.ceilingPrice >= d.rule.floorPrice, "سقف کمتر از کف است");

merchantRouter.post("/onboarding", writer, validate(onboarding), async (req, res) => {
  const product = await prisma.product.create({ data: { sellerId: req.seller!.id, ...req.body.product,
    costProfiles: { create: req.body.costs }, pricingRule: { create: req.body.rule } } });
  res.status(201).json(product);
});
merchantRouter.post("/woocommerce/catalog", writer, validate(z.object({ unit: z.enum(["IRR", "IRT"]), products: z.array(z.object({ sku: z.string().min(1), name: z.string().min(1), price: z.number().nonnegative() })).max(100) })), async (req, res) => {
  const products = req.body.products as { sku: string; name: string; price: number }[];
  const multiplier = req.body.unit === "IRT" ? 10 : 1;
  await prisma.$transaction(products.map(p => prisma.product.upsert({ where: { sellerId_sku: { sellerId: req.seller!.id, sku: p.sku } },
    create: { sellerId: req.seller!.id, sku: p.sku, name: p.name, currentPrice: p.price * multiplier || null },
    update: { name: p.name, currentPrice: p.price * multiplier || null } })));
  res.json({ imported: products.length, currency: "IRR" });
});

merchantRouter.get("/products", async (req, res) => {
  res.json(await prisma.product.findMany({ where: { sellerId: req.seller!.id }, orderBy: { updatedAt: "desc" }, take: 500 }));
});
merchantRouter.get("/products/:id/detail", requireOwnedProduct, async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id }, include: {
    costProfiles: { orderBy: { effectiveFrom: "desc" }, take: 20 }, pricingRule: true,
    competitorPrices: { orderBy: { capturedAt: "desc" }, take: 100 },
    suggestions: { orderBy: { createdAt: "desc" }, take: 50 },
    salesRecords: { orderBy: { soldAt: "desc" }, take: 100 }, approvals: { orderBy: { createdAt: "desc" }, take: 30 },
  } });
  res.json(product);
});
merchantRouter.get("/profit", async (req, res) => {
  const records = await prisma.salesRecord.findMany({ where: { product: { sellerId: req.seller!.id } }, include: { product: { select: { sku: true, name: true } } }, orderBy: { soldAt: "desc" }, take: 10000 });
  const groups = new Map<string, { sku: string; channel: string; revenue: number; netProfit: number; incompleteRecords: number }>();
  for (const sale of records) {
    const key = JSON.stringify([sale.product.sku, sale.channel]);
    const group = groups.get(key) ?? { sku: sale.product.sku, channel: sale.channel ?? "direct", revenue: 0, netProfit: 0, incompleteRecords: 0 };
    const profit = netProfit(sale); group.revenue += profit.revenue;
    if (profit.netProfit === null) group.incompleteRecords++; else group.netProfit += profit.netProfit;
    groups.set(key, group);
  }
  res.json({ currency: "IRR", groups: [...groups.values()], sampleLimit: 10000, sampledRecords: records.length });
});
merchantRouter.get("/approvals", async (req, res) => res.json(await prisma.priceApproval.findMany({ where: { sellerId: req.seller!.id }, include: { product: { select: { name: true, sku: true } } }, orderBy: { createdAt: "desc" }, take: 100 })));
merchantRouter.post("/products/:id/approvals", requireOwnedProduct, writer, validate(z.object({ price: z.number().positive(), reason: z.string().trim().min(1).max(2000) })), async (req, res) => {
  const { product, costs, pricingRule } = await loadProductPricingContext(req.params.id);
  if (!product.currentPrice) return res.status(409).json({ error: "قیمت فعلی لازم است" });
  const error = priceSafety(req.body.price, calculatePriceFloor(costs, pricingRule.minMarginPct), pricingRule.floorPrice, pricingRule.ceilingPrice);
  if (error) return res.status(422).json({ error });
  res.status(201).json(await prisma.priceApproval.create({ data: { sellerId: req.seller!.id, productId: product.id,
    previousPrice: product.currentPrice, proposedPrice: req.body.price, expectedMarginPct: calculateMargin(costs, req.body.price).marginPct, reason: req.body.reason } }));
});
merchantRouter.post("/approvals/:approvalId/:action", writer, validate(z.object({}).strict()), async (req, res) => {
  const action = req.params.action;
  if (!["approve", "apply", "rollback", "reject"].includes(action)) return res.status(400).json({ error: "عملیات نامعتبر است" });
  const approval = await prisma.priceApproval.findFirst({ where: { id: req.params.approvalId, sellerId: req.seller!.id } });
  if (!approval) return res.status(404).json({ error: "پیشنهاد یافت نشد" });
  const expected = action === "approve" || action === "reject" ? "RECOMMENDED" : action === "apply" ? "APPROVED" : "APPLIED";
  if (approval.status !== expected) return res.status(409).json({ error: "وضعیت پیشنهاد تغییر کرده است" });
  const nextStatus = { approve: "APPROVED", apply: "APPLIED", rollback: "ROLLED_BACK", reject: "REJECTED" }[action]!;
  if (action === "apply" || action === "rollback") {
    const { costs, pricingRule } = await loadProductPricingContext(approval.productId);
    const price = action === "apply" ? approval.proposedPrice : approval.previousPrice;
    const error = priceSafety(price, calculatePriceFloor(costs, pricingRule.minMarginPct), pricingRule.floorPrice, pricingRule.ceilingPrice);
    if (error) return res.status(422).json({ error });
  }
  try {
    await prisma.$transaction(async tx => {
      if (action === "apply" || action === "rollback") {
        const { costs, pricingRule } = await loadProductPricingContext(approval.productId, tx);
        const error = priceSafety(action === "apply" ? approval.proposedPrice : approval.previousPrice,
          calculatePriceFloor(costs, pricingRule.minMarginPct), pricingRule.floorPrice, pricingRule.ceilingPrice);
        if (error) throw new Error(`UNSAFE:${error}`);
      }
      const updated = await tx.priceApproval.updateMany({ where: { id: approval.id, status: expected }, data: {
        status: nextStatus, ...(action === "approve" ? { approvedBy: req.actorId } : {}),
        ...(action === "apply" ? { appliedAt: new Date() } : {}), ...(action === "rollback" ? { rolledBackAt: new Date() } : {}),
      } });
      if (!updated.count) throw new Error("CONFLICT");
      if (action === "apply" || action === "rollback") {
        const changed = await tx.product.updateMany({ where: { id: approval.productId, sellerId: req.seller!.id,
          currentPrice: action === "apply" ? approval.previousPrice : approval.proposedPrice },
          data: { currentPrice: action === "apply" ? approval.proposedPrice : approval.previousPrice } });
        if (!changed.count) throw new Error("CONFLICT");
      }
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if ((error as Error).message.startsWith("UNSAFE:")) return res.status(422).json({ error: (error as Error).message.slice(7) });
    if ((error as Error).message === "CONFLICT" || (error as { code?: string }).code === "P2034") return res.status(409).json({ error: "قیمت یا وضعیت تغییر کرده است؛ صفحه را تازه کنید" });
    throw error;
  }
  res.json({ status: nextStatus, scope: "LOCAL_CATALOG", marketplaceApplied: false });
});
merchantRouter.get("/products/:id/replacement", requireOwnedProduct, async (req, res) => {
  const { product, costs, costEffectiveFrom } = await loadProductPricingContext(req.params.id);
  const latest = await prisma.economicSignal.findFirst({ where: { sellerId: req.seller!.id, rate: { not: null }, capturedAt: { lte: new Date() } }, orderBy: { capturedAt: "desc" } });
  if (!latest?.rate || !product.currentPrice) return res.status(409).json({ error: "قیمت و نرخ معتبر لازم است" });
  const baseline = await prisma.economicSignal.findFirst({ where: { sellerId: req.seller!.id, source: latest.source, currency: latest.currency, rate: { not: null }, capturedAt: { lte: costEffectiveFrom } }, orderBy: { capturedAt: "desc" } });
  if (!baseline?.rate) return res.status(409).json({ error: "نرخ هم‌منبع در تاریخ ثبت بهای خرید لازم است" });
  res.json({ ...replacementProtection(costs.unitCost, baseline.rate, latest.rate, product.currentPrice), source: latest.source, currency: latest.currency, baselineAt: baseline.capturedAt, latestAt: latest.capturedAt, estimateOnly: true });
});

import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireOwnedProduct, requireRole } from "../lib/auth";
import { validate } from "../lib/validate";
import { economicSignalSchema } from "../lib/schemas";

export const economicSignalsRouter = Router();

economicSignalsRouter.use(requireAuth);

economicSignalsRouter.post(
  "/economic-signals",
  requireRole("OWNER", "MANAGER", "ANALYST"),
  validate(economicSignalSchema),
  async (req, res) => {
    const signal = await prisma.economicSignal.create({
      data: {
        sellerId: req.seller!.id,
        source: req.body.source,
        currency: req.body.currency,
        rate: req.body.rate ?? null,
        inflationPct: req.body.inflationPct ?? null,
        capturedAt: req.body.capturedAt ?? new Date(),
        note: req.body.note ?? null,
      },
    });
    res.status(201).json(signal);
  }
);

economicSignalsRouter.get("/economic-signals", requireRole("OWNER", "MANAGER", "ANALYST", "VIEWER"), async (req, res) => {
  const signals = await prisma.economicSignal.findMany({
    where: { sellerId: req.seller!.id },
    orderBy: { capturedAt: "desc" },
    take: 50,
  });
  res.json(signals);
});

economicSignalsRouter.get(
  "/products/:id/cost-adjustment-proposal",
  requireOwnedProduct,
  requireRole("OWNER", "MANAGER", "ANALYST"),
  async (req, res) => {
    const latestSignal = await prisma.economicSignal.findFirst({
      where: { sellerId: req.seller!.id },
      orderBy: { capturedAt: "desc" },
    });
    if (!latestSignal) return res.status(404).json({ error: "هیچ سیگنال اقتصادی ثبت نشده است" });

    const activeCost = await prisma.costProfile.findFirst({
      where: { productId: req.params.id, isActive: true },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!activeCost) return res.status(404).json({ error: "CostProfile فعال برای محصول ثبت نشده است" });

    const adjustmentPct = Math.max(-0.5, Math.min(1, latestSignal.inflationPct ?? 0));
    const multiplier = 1 + adjustmentPct;
    res.json({
      signal: latestSignal,
      adjustmentPct,
      currentUnitCost: activeCost.unitCost,
      proposedUnitCost: Math.round(activeCost.unitCost * multiplier),
      currentPackagingCost: activeCost.packagingCost,
      proposedPackagingCost: Math.round(activeCost.packagingCost * multiplier),
      currentShippingCost: activeCost.shippingCost,
      proposedShippingCost: Math.round(activeCost.shippingCost * multiplier),
    });
  }
);

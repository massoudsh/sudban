import { Router } from "express";
import { requireAuth, requireRole } from "../lib/auth";
import { BILLING_PLANS, estimateBill } from "../services/billingPlans";
import { prisma } from "../lib/prisma";

export const billingRouter = Router();
billingRouter.use(requireAuth);
billingRouter.get("/plans", (_req, res) => res.json({ currency: "IRR", paymentConfigured: false, plans: BILLING_PLANS }));
billingRouter.get("/estimate", requireRole("OWNER", "MANAGER"), async (req, res) => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const events = await prisma.usageEvent.aggregate({ where: { sellerId: req.seller!.id, type: "API_REQUEST", occurredAt: { gte: start } }, _sum: { quantity: true } });
  const subscription = await prisma.subscription.findFirst({ where: { sellerId: req.seller!.id, endsAt: null }, orderBy: { startsAt: "desc" } });
  const plan = subscription?.plan && subscription.plan in BILLING_PLANS ? subscription.plan as keyof typeof BILLING_PLANS : "starter";
  res.json({ plan, requests: events._sum.quantity ?? 0, ...estimateBill(plan, events._sum.quantity ?? 0) });
});

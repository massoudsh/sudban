import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../lib/auth";
import { validate } from "../lib/validate";
import { usageEventSchema } from "../lib/schemas";

export const billingRouter = Router();

billingRouter.use(requireAuth);

billingRouter.post("/billing/usage-events", requireRole("OWNER", "MANAGER"), validate(usageEventSchema), async (req, res) => {
  const event = await prisma.usageEvent.create({
    data: {
      sellerId: req.seller!.id,
      type: req.body.type,
      quantity: req.body.quantity,
      metadata: req.body.metadata ?? undefined,
    },
  });
  res.status(201).json(event);
});

billingRouter.get("/billing/plans", (_req, res) => {
  res.json([
    { plan: "starter", activeSkuLimit: 100, includedApiRequests: 10000, monthlyBasePrice: 0, overageUnitPrice: 0.0005 },
    { plan: "growth", activeSkuLimit: 1000, includedApiRequests: 100000, monthlyBasePrice: 49, overageUnitPrice: 0.0002 },
    { plan: "scale", activeSkuLimit: 10000, includedApiRequests: 1000000, monthlyBasePrice: 199, overageUnitPrice: 0.0001 },
  ]);
});

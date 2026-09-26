import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireOwnedProduct, requireRole } from "../lib/auth";
import { validate } from "../lib/validate";
import { competitorSyncJobSchema, integrationJobStatusSchema, pricePushJobSchema } from "../lib/schemas";

export const integrationsRouter = Router();

integrationsRouter.use(requireAuth);

integrationsRouter.post(
  "/:id/competitor-sync-jobs",
  requireOwnedProduct,
  requireRole("OWNER", "MANAGER", "ANALYST"),
  validate(competitorSyncJobSchema),
  async (req, res) => {
    const job = await prisma.integrationJob.create({
      data: {
        sellerId: req.seller!.id,
        productId: req.params.id,
        type: "COMPETITOR_PRICE_SYNC",
        channel: req.body.channel,
        payload: { source: req.body.source ?? null, metadata: req.body.metadata ?? {} },
      },
    });
    res.status(202).json(job);
  }
);

integrationsRouter.post(
  "/:id/price-push-jobs",
  requireOwnedProduct,
  requireRole("OWNER", "MANAGER"),
  validate(pricePushJobSchema),
  async (req, res) => {
    const job = await prisma.integrationJob.create({
      data: {
        sellerId: req.seller!.id,
        productId: req.params.id,
        type: "PRICE_PUSH",
        channel: req.body.channel,
        payload: {
          targetPrice: req.body.targetPrice,
          externalProductId: req.body.externalProductId ?? null,
          riskAcknowledged: true,
        },
      },
    });

    await prisma.usageEvent.create({
      data: { sellerId: req.seller!.id, type: "PRICE_PUSH_JOB", quantity: 1, metadata: { jobId: job.id } },
    });

    res.status(202).json(job);
  }
);

integrationsRouter.get("/integration-jobs", requireRole("OWNER", "MANAGER", "ANALYST"), async (req, res) => {
  const jobs = await prisma.integrationJob.findMany({
    where: { sellerId: req.seller!.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(jobs);
});

integrationsRouter.patch(
  "/integration-jobs/:jobId",
  requireRole("OWNER"),
  validate(integrationJobStatusSchema),
  async (req, res) => {
    const existing = await prisma.integrationJob.findFirst({ where: { id: req.params.jobId, sellerId: req.seller!.id } });
    if (!existing) return res.status(404).json({ error: "job یافت نشد" });

    const job = await prisma.integrationJob.update({
      where: { id: existing.id },
      data: { status: req.body.status, result: req.body.result ?? undefined, error: req.body.error ?? undefined },
    });
    res.json(job);
  }
);

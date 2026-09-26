import { Router } from "express";
import { prisma } from "../lib/prisma";
import { validate } from "../lib/validate";
import { createSellerSchema, createTeamMemberSchema, notificationSettingsSchema, subscriptionSchema, updateTeamMemberSchema } from "../lib/schemas";
import { generateApiKey } from "../lib/apiKey";
import { requireAuth, requireRole } from "../lib/auth";

export const sellersRouter = Router();

// POST /sellers — ساخت فروشنده (تنانت) + صدور کلید API (فقط همین یک‌بار در پاسخ نمایش داده می‌شود)
sellersRouter.post("/", validate(createSellerSchema), async (req, res) => {
  const { name, email } = req.body;

  const { apiKey, apiKeyPrefix, apiKeyHash } = await generateApiKey();

  try {
    const seller = await prisma.seller.create({
      data: { name, email, apiKeyPrefix, apiKeyHash, role: "OWNER" },
    });

    res.status(201).json({
      id: seller.id,
      name: seller.name,
      email: seller.email,
      createdAt: seller.createdAt,
      apiKey,
      warning: "این کلید فقط همین یک‌بار نمایش داده می‌شود و در سرور ذخیره نمی‌شود — آن را امن نگه دارید.",
    });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
      res.status(409).json({ error: "فروشنده‌ای با این email از قبل ثبت شده است" });
      return;
    }
    throw err;
  }
});

// GET /sellers/me — اطلاعات فروشنده احرازشده
sellersRouter.get("/me", requireAuth, async (req, res) => {
  const { apiKeyHash: _apiKeyHash, ...safe } = req.seller!;
  res.json(safe);
});

sellersRouter.get("/me/team", requireAuth, requireRole("OWNER", "MANAGER"), async (req, res) => {
  const members = await prisma.sellerTeamMember.findMany({
    where: { sellerId: req.seller!.id },
    orderBy: { createdAt: "desc" },
  });
  res.json(members);
});

sellersRouter.post("/me/team", requireAuth, requireRole("OWNER"), validate(createTeamMemberSchema), async (req, res) => {
  const member = await prisma.sellerTeamMember.create({
    data: { sellerId: req.seller!.id, email: req.body.email, name: req.body.name ?? null, role: req.body.role },
  });
  res.status(201).json(member);
});

sellersRouter.patch(
  "/me/team/:memberId",
  requireAuth,
  requireRole("OWNER"),
  validate(updateTeamMemberSchema),
  async (req, res) => {
    const existing = await prisma.sellerTeamMember.findFirst({
      where: { id: req.params.memberId, sellerId: req.seller!.id },
    });
    if (!existing) return res.status(404).json({ error: "عضو تیم یافت نشد" });

    const member = await prisma.sellerTeamMember.update({ where: { id: existing.id }, data: req.body });
    res.json(member);
  }
);

sellersRouter.get("/me/subscription", requireAuth, requireRole("OWNER", "MANAGER"), async (req, res) => {
  const subscription = await prisma.subscription.findFirst({
    where: { sellerId: req.seller!.id, endsAt: null },
    orderBy: { startsAt: "desc" },
  });
  res.json(subscription);
});

sellersRouter.put(
  "/me/subscription",
  requireAuth,
  requireRole("OWNER"),
  validate(subscriptionSchema),
  async (req, res) => {
    await prisma.subscription.updateMany({
      where: { sellerId: req.seller!.id, endsAt: null },
      data: { endsAt: new Date() },
    });
    const subscription = await prisma.subscription.create({
      data: { sellerId: req.seller!.id, ...req.body },
    });
    res.status(201).json(subscription);
  }
);

sellersRouter.get("/me/billing/usage", requireAuth, requireRole("OWNER", "MANAGER"), async (req, res) => {
  const since = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const events = await prisma.usageEvent.groupBy({
    by: ["type"],
    where: { sellerId: req.seller!.id, occurredAt: { gte: since } },
    _sum: { quantity: true },
  });
  const activeSkuCount = await prisma.product.count({ where: { sellerId: req.seller!.id } });
  const subscription = await prisma.subscription.findFirst({
    where: { sellerId: req.seller!.id, endsAt: null },
    orderBy: { startsAt: "desc" },
  });
  res.json({ periodStart: since, activeSkuCount, subscription, usage: events });
});

// PATCH /sellers/me/notifications — تنظیم کانال‌های دریافت هشدار (#6)
sellersRouter.patch(
  "/me/notifications",
  requireAuth,
  validate(notificationSettingsSchema),
  async (req, res) => {
    const seller = await prisma.seller.update({
      where: { id: req.seller!.id },
      data: req.body,
    });
    const { apiKeyHash: _apiKeyHash, ...safe } = seller;
    res.json(safe);
  }
);

// GET /sellers/:id/products — فقط محصولات خود فروشنده احرازشده
sellersRouter.get("/:id/products", requireAuth, async (req, res) => {
  if (req.params.id !== req.seller!.id) {
    res.status(404).json({ error: "فروشنده یافت نشد" });
    return;
  }
  const products = await prisma.product.findMany({ where: { sellerId: req.seller!.id } });
  res.json(products);
});

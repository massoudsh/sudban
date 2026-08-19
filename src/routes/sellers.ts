import { Router } from "express";
import { prisma } from "../lib/prisma";
import { validate } from "../lib/validate";
import { createSellerSchema, notificationSettingsSchema } from "../lib/schemas";
import { generateApiKey } from "../lib/apiKey";
import { requireAuth } from "../lib/auth";

export const sellersRouter = Router();

// POST /sellers — ساخت فروشنده (تنانت) + صدور کلید API (فقط همین یک‌بار در پاسخ نمایش داده می‌شود)
sellersRouter.post("/", validate(createSellerSchema), async (req, res) => {
  const { name, email } = req.body;

  const { apiKey, apiKeyPrefix, apiKeyHash } = await generateApiKey();

  try {
    const seller = await prisma.seller.create({
      data: { name, email, apiKeyPrefix, apiKeyHash },
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

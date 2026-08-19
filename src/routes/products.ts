import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireOwnedProduct } from "../lib/auth";
import { validate } from "../lib/validate";
import { createProductSchema, updateProductSchema } from "../lib/schemas";

export const productsRouter = Router();

productsRouter.use(requireAuth);

// POST /products — ساخت محصول جدید (sellerId از فروشنده احرازشده گرفته می‌شود، نه از body)
productsRouter.post("/", validate(createProductSchema), async (req, res) => {
  const { sku, name, category, currentPrice } = req.body;

  try {
    const product = await prisma.product.create({
      data: {
        sellerId: req.seller!.id,
        sku,
        name,
        category: category ?? null,
        currentPrice: currentPrice ?? null,
      },
    });
    res.status(201).json(product);
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
      res.status(409).json({ error: "محصولی با این sku برای این فروشنده از قبل ثبت شده است" });
      return;
    }
    throw err;
  }
});

// GET /products/:id
productsRouter.get("/:id", requireOwnedProduct, async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  res.json(product);
});

// PATCH /products/:id — عمدتاً برای به‌روزرسانی currentPrice
productsRouter.patch("/:id", requireOwnedProduct, validate(updateProductSchema), async (req, res) => {
  const { currentPrice, name, category } = req.body;

  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      ...(currentPrice !== undefined ? { currentPrice } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(category !== undefined ? { category } : {}),
    },
  });
  res.json(product);
});

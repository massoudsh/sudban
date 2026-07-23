import { Router } from "express";
import { prisma } from "../lib/prisma";

export const productsRouter = Router();

// POST /products — ساخت محصول جدید
productsRouter.post("/", async (req, res) => {
  const { sellerId, sku, name, category, currentPrice } = req.body ?? {};

  if (!sellerId || !sku || !name) {
    return res.status(400).json({ error: "sellerId، sku و name الزامی هستند" });
  }

  const product = await prisma.product.create({
    data: { sellerId, sku, name, category: category ?? null, currentPrice: currentPrice ?? null },
  });

  res.status(201).json(product);
});

// GET /products/:id
productsRouter.get("/:id", async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ error: "محصول یافت نشد" });
  res.json(product);
});

// PATCH /products/:id — عمدتاً برای به‌روزرسانی currentPrice
productsRouter.patch("/:id", async (req, res) => {
  const { currentPrice, name, category } = req.body ?? {};

  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(currentPrice != null ? { currentPrice } : {}),
        ...(name != null ? { name } : {}),
        ...(category != null ? { category } : {}),
      },
    });
    res.json(product);
  } catch {
    res.status(404).json({ error: "محصول یافت نشد" });
  }
});

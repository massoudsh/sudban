import { Router } from "express";
import { prisma } from "../lib/prisma";

export const sellersRouter = Router();

// POST /sellers — ساخت فروشنده (تنانت)
sellersRouter.post("/", async (req, res) => {
  const { name, email } = req.body ?? {};
  if (!name || !email) {
    return res.status(400).json({ error: "name و email الزامی هستند" });
  }

  const seller = await prisma.seller.create({ data: { name, email } });
  res.status(201).json(seller);
});

sellersRouter.get("/:id/products", async (req, res) => {
  const products = await prisma.product.findMany({ where: { sellerId: req.params.id } });
  res.json(products);
});

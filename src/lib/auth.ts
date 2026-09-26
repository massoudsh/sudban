import { NextFunction, Request, Response } from "express";
import { Seller, SellerRole } from "@prisma/client";
import { prisma } from "./prisma";
import { extractApiKeyPrefix, verifyApiKey } from "./apiKey";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      seller?: Seller;
    }
  }
}

function extractApiKey(req: Request): string | null {
  const header = req.header("authorization");
  if (header && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  const apiKeyHeader = req.header("x-api-key");
  if (apiKeyHeader) return apiKeyHeader.trim();
  return null;
}

/**
 * احراز هویت بر اساس کلید API. کلید معتبر باید در هدر Authorization: Bearer <key>
 * یا x-api-key ارسال شود. در صورت موفقیت، req.seller پر می‌شود.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const apiKey = extractApiKey(req);
  if (!apiKey) {
    res.status(401).json({ error: "کلید API الزامی است (هدر Authorization: Bearer <key> یا x-api-key)" });
    return;
  }

  const prefix = extractApiKeyPrefix(apiKey);
  const seller = await prisma.seller.findUnique({ where: { apiKeyPrefix: prefix } });

  if (!seller || !(await verifyApiKey(apiKey, seller.apiKeyHash))) {
    res.status(401).json({ error: "کلید API نامعتبر است" });
    return;
  }

  req.seller = seller;
  next();
}

/**
 * تضمین می‌کند محصول درخواستی متعلق به فروشنده احرازشده است.
 * روی روت‌هایی که پارامتر :id همان productId است استفاده می‌شود.
 */
export function requireRole(...allowedRoles: SellerRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.seller) {
      res.status(401).json({ error: "کلید API الزامی است" });
      return;
    }
    if (!allowedRoles.includes(req.seller.role)) {
      res.status(403).json({ error: "سطح دسترسی برای انجام این عملیات کافی نیست" });
      return;
    }
    next();
  };
}

export async function requireOwnedProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const productId = req.params.id;
  const product = await prisma.product.findUnique({ where: { id: productId } });

  if (!product) {
    res.status(404).json({ error: "محصول یافت نشد" });
    return;
  }
  if (!req.seller || product.sellerId !== req.seller.id) {
    res.status(404).json({ error: "محصول یافت نشد" });
    return;
  }

  next();
}

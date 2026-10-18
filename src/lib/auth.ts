import { createHash } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { Seller, SellerRole } from "@prisma/client";
import { prisma } from "./prisma";
import { extractApiKeyPrefix, verifyApiKey } from "./apiKey";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      seller?: Seller;
      actorRole?: SellerRole;
      actorId?: string;
      sessionId?: string;
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
  if (req.seller) { next(); return; }
  const apiKey = extractApiKey(req);
  if (!apiKey) {
    res.status(401).json({ error: "کلید API الزامی است (هدر Authorization: Bearer <key> یا x-api-key)" });
    return;
  }

  if (apiKey.startsWith("sb_session_")) {
    const session = await prisma.sellerSession.findUnique({
      where: { tokenHash: createHash("sha256").update(apiKey).digest("hex") }, include: { seller: true },
    });
    if (!session || session.expiresAt <= new Date()) {
      res.status(401).json({ error: "نشست منقضی شده است" }); return;
    }
    req.seller = session.seller; req.actorRole = session.seller.role;
    req.actorId = session.sellerId; req.sessionId = session.id;
    await prisma.usageEvent.create({ data: { sellerId: session.sellerId, type: "API_REQUEST", quantity: 1 } });
    next(); return;
  }
  const prefix = extractApiKeyPrefix(apiKey);
  const seller = await prisma.seller.findUnique({ where: { apiKeyPrefix: prefix } });
  if (seller && await verifyApiKey(apiKey, seller.apiKeyHash)) {
    req.seller = seller; req.actorRole = seller.role; req.actorId = seller.id;
    await prisma.usageEvent.create({ data: { sellerId: seller.id, type: "API_REQUEST", quantity: 1 } });
    next(); return;
  }
  const member = await prisma.sellerTeamMember.findUnique({ where: { apiKeyPrefix: prefix }, include: { seller: true } });
  if (!member?.isActive || !member.apiKeyHash || !(await verifyApiKey(apiKey, member.apiKeyHash))) {
    res.status(401).json({ error: "کلید API نامعتبر است" }); return;
  }
  req.seller = member.seller; req.actorRole = member.role; req.actorId = member.id;
  await prisma.usageEvent.create({ data: { sellerId: member.sellerId, type: "API_REQUEST", quantity: 1 } });
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
    if (!allowedRoles.includes(req.actorRole ?? req.seller.role)) {
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

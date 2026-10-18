import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { generateApiKey } from "../lib/apiKey";
import { validate } from "../lib/validate";
import { requireAuth } from "../lib/auth";

export const accountsRouter = Router();
accountsRouter.use(rateLimit({ windowMs: 900000, limit: 30, standardHeaders: true, legacyHeaders: false }));
const credentials = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(12).max(72) });
const registration = credentials.extend({ name: z.string().trim().min(1).max(120) });

async function createSession(sellerId: string) {
  const token = `sb_session_${randomBytes(32).toString("hex")}`;
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await prisma.sellerSession.create({ data: { sellerId, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt } });
  return { token, expiresAt };
}

accountsRouter.post("/register", validate(registration), async (req, res) => {
  const { apiKeyPrefix, apiKeyHash } = await generateApiKey();
  try {
    const seller = await prisma.seller.create({ data: { name: req.body.name, email: req.body.email,
      passwordHash: await bcrypt.hash(req.body.password, 12), apiKeyPrefix, apiKeyHash, role: "OWNER" } });
    res.status(201).json({ seller: { id: seller.id, name: seller.name, email: seller.email }, ...await createSession(seller.id) });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return res.status(409).json({ error: "این ایمیل قبلاً ثبت شده است" });
    throw error;
  }
});
accountsRouter.post("/login", validate(credentials), async (req, res) => {
  const seller = await prisma.seller.findUnique({ where: { email: req.body.email } });
  if (!seller?.passwordHash || !await bcrypt.compare(req.body.password, seller.passwordHash)) {
    return res.status(401).json({ error: "ایمیل یا رمز عبور نادرست است" });
  }
  res.json({ seller: { id: seller.id, name: seller.name, email: seller.email }, ...await createSession(seller.id) });
});
accountsRouter.post("/logout", requireAuth, async (req, res) => {
  if (req.sessionId) await prisma.sellerSession.deleteMany({ where: { id: req.sessionId, sellerId: req.seller!.id } });
  res.status(204).end();
});

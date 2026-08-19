import express, { Router } from "express";
import { parse as parseCsv } from "csv-parse/sync";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import {
  costProfileRowSchema,
  salesRowSchema,
  competitorPriceRowSchema,
  ImportType,
} from "../lib/schemas";

export const bulkImportRouter = Router();

bulkImportRouter.use(requireAuth);

const IMPORT_TYPES: ImportType[] = ["cost-profiles", "sales", "competitor-prices"];
const MAX_ROWS = 5000;
const csvTextParser = express.text({ type: "text/csv", limit: "2mb" });

interface RowResult {
  row: number;
  error: string;
}

// POST /products/bulk-import?type=cost-profiles|sales|competitor-prices
// بدنه یا JSON { rows: [...] } (Content-Type: application/json) یا متن CSV خام (Content-Type: text/csv) با سطر هدر
bulkImportRouter.post("/bulk-import", csvTextParser, async (req, res) => {
  const type = req.query.type as ImportType | undefined;
  if (!type || !IMPORT_TYPES.includes(type)) {
    res.status(400).json({ error: `query param type باید یکی از ${IMPORT_TYPES.join(", ")} باشد` });
    return;
  }

  let rawRows: Record<string, unknown>[];
  if (req.is("text/csv")) {
    try {
      rawRows = parseCsv(req.body as string, { columns: true, skip_empty_lines: true, trim: true });
    } catch (err) {
      res.status(400).json({ error: `پردازش CSV ناموفق بود: ${(err as Error).message}` });
      return;
    }
  } else {
    const body = (req.body ?? {}) as { rows?: unknown };
    if (!Array.isArray(body.rows)) {
      res.status(400).json({
        error: "برای JSON، بدنه باید شامل آرایه rows باشد؛ یا Content-Type: text/csv با متن CSV بفرستید",
      });
      return;
    }
    rawRows = body.rows as Record<string, unknown>[];
  }

  if (rawRows.length === 0) {
    res.status(400).json({ error: "هیچ ردیفی برای import یافت نشد" });
    return;
  }
  if (rawRows.length > MAX_ROWS) {
    res.status(400).json({ error: `حداکثر ${MAX_ROWS} ردیف در هر درخواست مجاز است` });
    return;
  }

  // پیش‌واکشی محصولات این فروشنده برای map سریع sku -> productId و enforce مالکیت
  const sellerProducts = await prisma.product.findMany({ where: { sellerId: req.seller!.id } });
  const productIdBySku = new Map(sellerProducts.map((p) => [p.sku, p.id]));
  const ownedProductIds = new Set(sellerProducts.map((p) => p.id));

  function resolveProductId(productId?: string, sku?: string): string | null {
    if (productId && ownedProductIds.has(productId)) return productId;
    if (sku && productIdBySku.has(sku)) return productIdBySku.get(sku)!;
    return null;
  }

  let successCount = 0;
  const errors: RowResult[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const rowNumber = i + 1;

    try {
      if (type === "cost-profiles") {
        const parsed = costProfileRowSchema.safeParse(rawRows[i]);
        if (!parsed.success) throw new Error(parsed.error.issues.map((iss) => iss.message).join("، "));
        const data = parsed.data;
        const productId = resolveProductId(data.productId, data.sku);
        if (!productId) throw new Error(`محصول یافت نشد (sku: ${data.sku ?? "-"}, productId: ${data.productId ?? "-"})`);

        await prisma.$transaction(async (tx) => {
          await tx.costProfile.updateMany({ where: { productId, isActive: true }, data: { isActive: false } });
          await tx.costProfile.create({
            data: {
              productId,
              unitCost: data.unitCost,
              packagingCost: data.packagingCost,
              shippingCost: data.shippingCost,
              otherFixedCost: data.otherFixedCost,
              commissionRate: data.commissionRate,
              returnRate: data.returnRate,
              isActive: true,
            },
          });
        });
      } else if (type === "sales") {
        const parsed = salesRowSchema.safeParse(rawRows[i]);
        if (!parsed.success) throw new Error(parsed.error.issues.map((iss) => iss.message).join("، "));
        const data = parsed.data;
        const productId = resolveProductId(data.productId, data.sku);
        if (!productId) throw new Error(`محصول یافت نشد (sku: ${data.sku ?? "-"}, productId: ${data.productId ?? "-"})`);

        await prisma.salesRecord.create({
          data: {
            productId,
            price: data.price,
            quantity: data.quantity,
            channel: data.channel ?? null,
            soldAt: data.soldAt ?? new Date(),
          },
        });
      } else {
        const parsed = competitorPriceRowSchema.safeParse(rawRows[i]);
        if (!parsed.success) throw new Error(parsed.error.issues.map((iss) => iss.message).join("، "));
        const data = parsed.data;
        const productId = resolveProductId(data.productId, data.sku);
        if (!productId) throw new Error(`محصول یافت نشد (sku: ${data.sku ?? "-"}, productId: ${data.productId ?? "-"})`);

        await prisma.competitorPrice.create({
          data: {
            productId,
            competitorName: data.competitorName,
            channel: data.channel,
            price: data.price,
            currency: data.currency,
            capturedAt: data.capturedAt,
          },
        });
      }
      successCount++;
    } catch (err) {
      errors.push({ row: rowNumber, error: (err as Error).message });
    }
  }

  const status = successCount === 0 && errors.length > 0 ? 400 : 200;
  res.status(status).json({ successCount, errorCount: errors.length, errors });
});

import express, { Router } from "express";
import { parse } from "csv-parse/sync";
import { readSheet } from "read-excel-file/node";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../lib/auth";
import { validate } from "../lib/validate";
import { guardWorkbook } from "../services/workbookGuard";
import { mapCatalog } from "../services/catalogImport";

export const importsRouter = Router();
importsRouter.use(requireAuth, requireRole("OWNER", "MANAGER"));
importsRouter.post("/file", express.raw({ type: ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], limit: "1mb" }), async (req, res) => {
  if (!Buffer.isBuffer(req.body)) return res.status(415).json({ error: "فقط CSV و XLSX پشتیبانی می‌شود" });
  try {
    let rows: Record<string, unknown>[];
    if (req.is("text/csv")) rows = parse(req.body, { columns: (headers: string[]) => {
      if (new Set(headers).size !== headers.length) throw new Error("Duplicate columns");
      return headers;
    }, bom: true, skip_empty_lines: true, max_record_size: 10000 });
    else {
      guardWorkbook(req.body);
      const sheet = await readSheet(req.body);
      const headers = (sheet.shift() ?? []).map(String);
      if (new Set(headers).size !== headers.length) return res.status(400).json({ error: "نام ستون‌ها باید یکتا باشد" });
      rows = sheet.map(row => Object.fromEntries(headers.map((header, i) => [header, row[i] ?? ""])));
    }
    if (!rows.length || rows.length > 500) return res.status(400).json({ error: "هر فایل باید ۱ تا ۵۰۰ ردیف داشته باشد" });
    res.json({ headers: Object.keys(rows[0]), rows });
  } catch { res.status(400).json({ error: "فایل قابل خواندن نیست؛ فرمت و نام ستون‌ها را بررسی کنید" }); }
});
const mappedImport = z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1).max(500),
  mapping: z.record(z.string(), z.string()), unit: z.enum(["IRR", "IRT"]), commit: z.boolean().default(false) });
importsRouter.post("/catalog", validate(mappedImport), async (req, res) => {
  const results = mapCatalog(req.body.rows, req.body.mapping, req.body.unit);
  if (!req.body.commit) return res.json({ results, valid: results.every(row => !row.error) });
  if (results.some(row => row.error)) return res.status(400).json({ error: "خطاهای پیش‌نمایش را اصلاح کنید", results });
  const skus = results.map(row => row.data!.sku);
  if (new Set(skus).size !== skus.length) return res.status(400).json({ error: "SKU تکراری در فایل وجود دارد" });
  try {
    await prisma.$transaction(results.map(row => prisma.product.create({ data: { sellerId: req.seller!.id,
      sku: row.data!.sku, name: row.data!.name, currentPrice: row.data!.currentPrice,
      costProfiles: { create: { unitCost: row.data!.unitCost } }, pricingRule: { create: { minMarginPct: row.data!.minMarginPct } } } })));
    res.status(201).json({ imported: results.length });
  } catch (error) { if ((error as { code?: string }).code === "P2002") return res.status(409).json({ error: "SKU قبلاً ثبت شده؛ هیچ ردیفی وارد نشد" }); throw error; }
});

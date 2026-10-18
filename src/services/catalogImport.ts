import { z } from "zod";

export const catalogRow = z.object({ sku: z.string().trim().min(1), name: z.string().trim().min(1),
  currentPrice: z.number().positive(), unitCost: z.number().nonnegative(), minMarginPct: z.number().min(0).max(0.95).default(0.15) });

export function normalizeNumber(input: unknown) {
  const text = String(input ?? "").replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[,٬\s]/g, "").replace("٫", ".");
  return text === "" ? NaN : Number(text);
}

export function mapCatalog(rows: Record<string, unknown>[], mapping: Record<string, string>, unit: "IRR" | "IRT") {
  const multiplier = unit === "IRT" ? 10 : 1;
  return rows.map((row, index) => {
    const value = (key: string) => row[mapping[key] ?? key];
    const parsed = catalogRow.safeParse({ sku: String(value("sku") ?? ""), name: String(value("name") ?? ""),
      currentPrice: normalizeNumber(value("currentPrice")) * multiplier, unitCost: normalizeNumber(value("unitCost")) * multiplier,
      minMarginPct: value("minMarginPct") == null || value("minMarginPct") === "" ? 0.15 : normalizeNumber(value("minMarginPct")) });
    return parsed.success ? { row: index + 1, data: parsed.data, error: null } : { row: index + 1, data: null, error: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("؛ ") };
  });
}

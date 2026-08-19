import { z } from "zod";

const STRATEGIES = ["MATCH", "PREMIUM", "PENETRATION"] as const;

export const createSellerSchema = z.object({
  name: z.string().trim().min(1, "name الزامی است"),
  email: z.string().trim().email("email نامعتبر است"),
});

export const createProductSchema = z.object({
  sku: z.string().trim().min(1, "sku الزامی است"),
  name: z.string().trim().min(1, "name الزامی است"),
  category: z.string().trim().min(1).optional().nullable(),
  currentPrice: z.number().positive("currentPrice باید مثبت باشد").optional().nullable(),
});

export const updateProductSchema = z
  .object({
    currentPrice: z.number().positive("currentPrice باید مثبت باشد").optional().nullable(),
    name: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "حداقل یکی از فیلدهای currentPrice، name یا category باید ارسال شود",
  });

const rate01 = (label: string) =>
  z.number().min(0, `${label} باید بین ۰ و ۱ باشد`).max(0.999999, `${label} باید بین ۰ و ۱ باشد`);

export const createCostProfileSchema = z.object({
  unitCost: z.number().min(0, "unitCost باید غیرمنفی باشد"),
  packagingCost: z.number().min(0).default(0),
  shippingCost: z.number().min(0).default(0),
  otherFixedCost: z.number().min(0).default(0),
  commissionRate: rate01("commissionRate").default(0),
  returnRate: rate01("returnRate").default(0),
});

export const pricingRuleSchema = z.object({
  minMarginPct: rate01("minMarginPct"),
  targetMarginPct: rate01("targetMarginPct").optional().nullable(),
  floorPrice: z.number().positive().optional().nullable(),
  ceilingPrice: z.number().positive().optional().nullable(),
  strategy: z.enum(STRATEGIES).default("MATCH"),
  priceElasticity: z.number().optional().nullable(),
});

export const competitorPriceSchema = z.object({
  competitorName: z.string().trim().min(1, "competitorName الزامی است"),
  channel: z.string().trim().min(1, "channel الزامی است"),
  price: z.number().positive("price باید مثبت باشد"),
  currency: z.string().trim().min(1).default("IRR"),
  capturedAt: z.coerce.date().optional(),
});

export const salesRecordSchema = z.object({
  price: z.number().positive("price باید مثبت باشد"),
  quantity: z.number().int().positive("quantity باید عدد صحیح مثبت باشد"),
  channel: z.string().trim().min(1).optional().nullable(),
  soldAt: z.coerce.date().optional(),
});

export const simulateScenarioSchema = z.object({
  hypotheticalPrice: z.number().positive("hypotheticalPrice باید مثبت باشد"),
  baselinePrice: z.number().positive().optional(),
  baselineAvgQuantity: z.number().min(0).optional(),
  elasticity: z.number().optional(),
});

export const marginQuerySchema = z.object({
  price: z.coerce.number().positive("query param عددی price الزامی است"),
});

export const strategyQuerySchema = z.object({
  strategy: z.enum(STRATEGIES).optional(),
});

// ---- Bulk import (#4) ----

const IMPORT_TYPES = ["cost-profiles", "sales", "competitor-prices"] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];

const productRefSchema = z.object({
  productId: z.string().trim().min(1).optional(),
  sku: z.string().trim().min(1).optional(),
});

export const costProfileRowSchema = productRefSchema
  .extend({
    unitCost: z.coerce.number().min(0),
    packagingCost: z.coerce.number().min(0).default(0),
    shippingCost: z.coerce.number().min(0).default(0),
    otherFixedCost: z.coerce.number().min(0).default(0),
    commissionRate: z.coerce.number().min(0).max(0.999999).default(0),
    returnRate: z.coerce.number().min(0).max(0.999999).default(0),
  })
  .refine((r) => r.productId || r.sku, { message: "productId یا sku الزامی است" });

export const salesRowSchema = productRefSchema
  .extend({
    price: z.coerce.number().positive(),
    quantity: z.coerce.number().int().positive(),
    channel: z.string().trim().min(1).optional(),
    soldAt: z.coerce.date().optional(),
  })
  .refine((r) => r.productId || r.sku, { message: "productId یا sku الزامی است" });

export const competitorPriceRowSchema = productRefSchema
  .extend({
    competitorName: z.string().trim().min(1),
    channel: z.string().trim().min(1),
    price: z.coerce.number().positive(),
    currency: z.string().trim().min(1).default("IRR"),
    capturedAt: z.coerce.date().optional(),
  })
  .refine((r) => r.productId || r.sku, { message: "productId یا sku الزامی است" });

// ---- Notification settings (#6) ----
export const notificationSettingsSchema = z
  .object({
    telegramChatId: z.string().trim().min(1).optional().nullable(),
    notifyEmail: z.string().trim().email().optional().nullable(),
    notifyPhone: z.string().trim().min(5).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "حداقل یکی از فیلدهای telegramChatId، notifyEmail یا notifyPhone باید ارسال شود",
  });

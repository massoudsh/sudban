import { prisma } from "./prisma";
import { CostBreakdown } from "../types";
import { computeCompetitivePosition } from "../services/competitivePosition";

export class NotFoundError extends Error {}

/**
 * تمام داده‌های لازم برای موتورهای قیمت‌گذاری یک محصول را یک‌جا واکشی می‌کند:
 * آخرین بهای تمام‌شده فعال، قاعده قیمت‌گذاری و جایگاه رقابتی.
 */
export async function loadProductPricingContext(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError(`محصول با شناسه ${productId} یافت نشد`);

  const activeCostProfile = await prisma.costProfile.findFirst({
    where: { productId, isActive: true },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!activeCostProfile) {
    throw new NotFoundError(`برای این محصول هنوز بهای تمام‌شده (Cost Profile) ثبت نشده است`);
  }

  const pricingRule = await prisma.pricingRule.findUnique({ where: { productId } });
  if (!pricingRule) {
    throw new NotFoundError(`برای این محصول هنوز قاعده قیمت‌گذاری (Pricing Rule) ثبت نشده است`);
  }

  const competitorPrices = await prisma.competitorPrice.findMany({ where: { productId } });
  const competitivePosition = computeCompetitivePosition(competitorPrices, product.currentPrice);

  const costs: CostBreakdown = {
    unitCost: activeCostProfile.unitCost,
    packagingCost: activeCostProfile.packagingCost,
    shippingCost: activeCostProfile.shippingCost,
    otherFixedCost: activeCostProfile.otherFixedCost,
    commissionRate: activeCostProfile.commissionRate,
    returnRate: activeCostProfile.returnRate,
  };

  return { product, costs, pricingRule, competitivePosition };
}

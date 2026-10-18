export const BILLING_PLANS = {
  starter: { activeSkuLimit: 100, includedApiRequests: 10000, monthlyBasePrice: 0, overageUnitPrice: 0 },
  growth: { activeSkuLimit: 1000, includedApiRequests: 100000, monthlyBasePrice: 4900000, overageUnitPrice: 20 },
  scale: { activeSkuLimit: 10000, includedApiRequests: 1000000, monthlyBasePrice: 19900000, overageUnitPrice: 10 },
} as const;

export function estimateBill(plan: keyof typeof BILLING_PLANS, requests: number) {
  const terms = BILLING_PLANS[plan];
  const overage = Math.max(0, requests - terms.includedApiRequests);
  return { currency: "IRR", overage, total: terms.monthlyBasePrice + overage * terms.overageUnitPrice, estimateOnly: true };
}

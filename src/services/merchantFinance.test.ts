import { describe, expect, it } from "vitest";
import { mapCatalog, normalizeNumber } from "./catalogImport";
import { netProfit, priceSafety, replacementProtection } from "./merchantFinance";
import { estimateBill } from "./billingPlans";

describe("merchant finance and import boundaries", () => {
  it("deducts all actual transaction costs once, not once per unit", () => {
    const result = netProfit({ price: 100, quantity: 2, unitCostSnapshot: 50, commissionAmount: 10, shippingSubsidy: 5, discountAmount: 4, returnCost: 3, settlementDeduction: 2 });
    expect(result.netProfit).toBe(76); expect(result.revenue).toBe(200);
  });
  it("does not manufacture a profit for records without historical costs", () => {
    expect(netProfit({ price: 100, quantity: 1, unitCostSnapshot: null, commissionAmount: 0, shippingSubsidy: 0, discountAmount: 0, returnCost: 0, settlementDeduction: 0 }).netProfit).toBeNull();
  });
  it("handles loss-making sales without clamping losses away", () => {
    expect(netProfit({ price: 10, quantity: 1, unitCostSnapshot: 20, commissionAmount: 0, shippingSubsidy: 0, discountAmount: 0, returnCost: 0, settlementDeduction: 0 }).netProfit).toBe(-10);
  });
  it("protects replenishment against currency depreciation", () => {
    expect(replacementProtection(100, 500, 1000, 150)).toMatchObject({ replacementCost: 200, atRisk: true, changePct: 1 });
  });
  it("checks floors and ceilings inclusively", () => {
    expect(priceSafety(125, 125, 100, 200)).toBeNull();
    expect(priceSafety(124, 125, 100, 200)).not.toBeNull();
    expect(priceSafety(201, 125, null, 200)).not.toBeNull();
    expect(priceSafety(NaN, 125, null, null)).not.toBeNull();
  });
  it("normalizes Persian and Arabic digits and separators", () => {
    expect(normalizeNumber("۱٬۲۰۰٫۵")).toBe(1200.5);
    expect(normalizeNumber("١,٢٠٠")).toBe(1200);
    expect(normalizeNumber("")).toBeNaN();
  });
  it("converts toman exactly once and preserves SKU text", () => {
    const result = mapCatalog([{ sku: "001", name: "Test", currentPrice: "۱۲۰", unitCost: "۸۰" }], {}, "IRT")[0];
    expect(result.data).toMatchObject({ sku: "001", currentPrice: 1200, unitCost: 800 });
  });
  it("rejects missing or nonnumeric cost values", () => {
    expect(mapCatalog([{ sku: "s", name: "Test", currentPrice: 120, unitCost: "" }], {}, "IRR")[0].error).toBeTruthy();
  });
  it("does not charge overage below an included quota", () => {
    expect(estimateBill("growth", 20).overage).toBe(0);
    expect(estimateBill("growth", 100001).total).toBe(4900020);
  });
});

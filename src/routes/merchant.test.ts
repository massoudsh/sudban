import { beforeEach, describe, expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";
import request from "supertest";

const db = vi.hoisted(() => {
  const model = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() });
  return { seller: model(), sellerSession: model(), sellerTeamMember: model(), usageEvent: model(), product: model(), costProfile: model(), pricingRule: model(), competitorPrice: model(), priceApproval: model(), priceSuggestion: model(), subscription: model(), salesRecord: model(), economicSignal: model(), $transaction: vi.fn() };
});
vi.mock("../lib/prisma", () => ({ prisma: db }));
vi.mock("../lib/apiKey", () => ({ extractApiKeyPrefix: (key: string) => key, verifyApiKey: async () => true,
  generateApiKey: async () => ({ apiKey: "new-member-key", apiKeyPrefix: "prefix", apiKeyHash: "hash" }) }));
import { app } from "../server";
const owner = { id: "seller-1", name: "Store", email: "store@example.test", role: "OWNER", apiKeyHash: "hash", passwordHash: "private-hash" };
const auth = { Authorization: "Bearer owner" };

beforeEach(() => {
  vi.resetAllMocks();
  db.seller.findUnique.mockImplementation(async ({ where }) => where.apiKeyPrefix === "owner" ? owner : null);
  db.sellerTeamMember.findUnique.mockResolvedValue(null);
  db.usageEvent.create.mockResolvedValue({ id: "usage" });
  db.product.findUnique.mockResolvedValue({ id: "p1", sellerId: owner.id, currentPrice: 200 });
  db.costProfile.findFirst.mockResolvedValue({ unitCost: 100, packagingCost: 0, shippingCost: 0, otherFixedCost: 0, commissionRate: 0, returnRate: 0 });
  db.pricingRule.findUnique.mockResolvedValue({ minMarginPct: 0.2, floorPrice: null, ceilingPrice: 400 });
  db.competitorPrice.findMany.mockResolvedValue([]);
  db.$transaction.mockImplementation(async value => typeof value === "function" ? value(db) : Promise.all(value));
});

describe("merchant HTTP regressions", () => {
  it("reads an XLSX catalog without writing products", async () => {
    const xml = (body: string) => strToU8(`<?xml version="1.0" encoding="UTF-8"?>${body}`);
    const workbook = zipSync({
      "[Content_Types].xml": xml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
      "_rels/.rels": xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
      "xl/workbook.xml": xml('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Catalog" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      "xl/_rels/workbook.xml.rels": xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
      "xl/worksheets/sheet1.xml": xml('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>sku</t></is></c><c r="B1" t="inlineStr"><is><t>price</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>S1</t></is></c><c r="B2"><v>120</v></c></row></sheetData></worksheet>'),
    });
    const res = await request(app).post("/imports/file").set(auth)
      .set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(Buffer.from(workbook));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ headers: ["sku", "price"], rows: [{ sku: "S1", price: 120 }] });
    expect(db.product.create).not.toHaveBeenCalled();
  });
  it("rejects duplicate CSV headers rather than silently losing columns", async () => {
    const res = await request(app).post("/imports/file").set(auth).set("Content-Type", "text/csv").send("sku,sku\nS1,S2");
    expect(res.status).toBe(400);
    expect(db.product.create).not.toHaveBeenCalled();
  });
  it("keeps the demo account unavailable unless explicitly enabled", async () => {
    delete process.env.DEMO_MODE;
    expect((await request(app).post("/accounts/demo")).status).toBe(404);
  });
  it("issues an owner session for an explicitly enabled demo account", async () => {
    process.env.DEMO_MODE = "true";
    db.seller.findUnique.mockResolvedValue(null); db.seller.create.mockResolvedValue(owner); db.sellerSession.create.mockResolvedValue({ id: "session" });
    const res = await request(app).post("/accounts/demo");
    expect(res.status).toBe(200); expect(res.body).toMatchObject({ demo: true, seller: { id: owner.id, role: "OWNER" } });
    expect(res.body.token).toMatch(/^sb_session_/);
    delete process.env.DEMO_MODE;
  });
  it("keeps public registration reachable before scoped authentication", async () => {
    db.seller.create.mockResolvedValue(owner);
    const res = await request(app).post("/sellers").send({ name: "Store", email: "store@example.test" });
    expect(res.status).toBe(201);
    expect(db.seller.findUnique).not.toHaveBeenCalled();
  });
  it("protects private endpoints and returns a public health response", async () => {
    expect((await request(app).get("/health")).status).toBe(200);
    expect((await request(app).get("/merchant/products")).status).toBe(401);
  });
  it("does not serialize account hashes in the seller profile", async () => {
    const res = await request(app).get("/sellers/me").set(auth);
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("passwordHash");
    expect(res.body).not.toHaveProperty("apiKeyHash");
    expect(db.usageEvent.create).toHaveBeenCalledTimes(1);
  });
  it("hides products belonging to another tenant", async () => {
    db.product.findUnique.mockResolvedValue({ id: "other", sellerId: "seller-2" });
    expect((await request(app).get("/merchant/products/other/detail").set(auth)).status).toBe(404);
  });
  it("uses member role rather than the tenant owner's role", async () => {
    db.sellerTeamMember.findUnique.mockResolvedValue({ id: "member", sellerId: owner.id, role: "VIEWER", isActive: true, apiKeyHash: "hash", seller: owner });
    const res = await request(app).post("/merchant/onboarding").set({ Authorization: "Bearer member" }).send({});
    expect(res.status).toBe(403);
    expect(db.product.create).not.toHaveBeenCalled();
  });
  it("rejects revoked team access", async () => {
    db.sellerTeamMember.findUnique.mockResolvedValue({ isActive: false, seller: owner });
    expect((await request(app).get("/merchant/products").set({ Authorization: "Bearer revoked" })).status).toBe(401);
  });
  it("rejects expired sessions", async () => {
    db.sellerSession.findUnique.mockResolvedValue({ seller: owner, expiresAt: new Date(0) });
    expect((await request(app).get("/merchant/products").set({ Authorization: "Bearer sb_session_expired" })).status).toBe(401);
  });
  it("does not allow clients to set subscription prices or quotas", async () => {
    const res = await request(app).put("/sellers/me/subscription").set(auth).send({ plan: "starter", monthlyBasePrice: 0, activeSkuLimit: 999999 });
    expect(res.status).toBe(400);
    expect(db.subscription.create).not.toHaveBeenCalled();
  });
  it("does not activate paid plans without verified payment", async () => {
    const res = await request(app).put("/sellers/me/subscription").set(auth).send({ plan: "growth" });
    expect(res.status).toBe(409);
    expect(res.body.paymentConfigured).toBe(false);
  });
  it("validates preview without writing catalog rows", async () => {
    const res = await request(app).post("/imports/catalog").set(auth).send({ rows: [{ code: "S1", title: "Phone", price: "۱۲۰", cost: "۸۰" }], mapping: { sku: "code", name: "title", currentPrice: "price", unitCost: "cost" }, unit: "IRT" });
    expect(res.status).toBe(200);
    expect(res.body.results[0].data.currentPrice).toBe(1200);
    expect(db.product.create).not.toHaveBeenCalled();
  });
  it("rejects duplicate SKUs before creating anything", async () => {
    const row = { sku: "S1", name: "Phone", currentPrice: 200, unitCost: 100 };
    const res = await request(app).post("/imports/catalog").set(auth).send({ rows: [row, row], mapping: {}, unit: "IRR", commit: true });
    expect(res.status).toBe(400);
    expect(db.product.create).not.toHaveBeenCalled();
  });
  it("rejects prices below the live cost floor", async () => {
    const res = await request(app).post("/merchant/products/p1/approvals").set(auth).send({ price: 101, reason: "test" });
    expect(res.status).toBe(422);
    expect(db.priceApproval.create).not.toHaveBeenCalled();
  });
  it("requires approval before applying a recommendation", async () => {
    db.priceApproval.findFirst.mockResolvedValue({ id: "a1", sellerId: owner.id, productId: "p1", status: "RECOMMENDED" });
    expect((await request(app).post("/merchant/approvals/a1/apply").set(auth).send({})).status).toBe(409);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("detects stale product prices during apply", async () => {
    db.priceApproval.findFirst.mockResolvedValue({ id: "a1", sellerId: owner.id, productId: "p1", status: "APPROVED", previousPrice: 200, proposedPrice: 220 });
    db.priceApproval.updateMany.mockResolvedValue({ count: 1 });
    db.product.updateMany.mockResolvedValue({ count: 0 });
    expect((await request(app).post("/merchant/approvals/a1/apply").set(auth).send({})).status).toBe(409);
  });
  it("applies approved prices locally and reports marketplace status honestly", async () => {
    db.priceApproval.findFirst.mockResolvedValue({ id: "a1", sellerId: owner.id, productId: "p1", status: "APPROVED", previousPrice: 200, proposedPrice: 220 });
    db.priceApproval.updateMany.mockResolvedValue({ count: 1 }); db.product.updateMany.mockResolvedValue({ count: 1 });
    const res = await request(app).post("/merchant/approvals/a1/apply").set(auth).send({});
    expect(res.status).toBe(200); expect(res.body).toMatchObject({ status: "APPLIED", marketplaceApplied: false });
  });
  it("lists MAP violations and leaves compliant products out", async () => {
    db.pricingRule.findMany.mockResolvedValue([
      { mapPrice: 1000, product: { id: "p1", sku: "S1", name: "Phone", currentPrice: 900 } },
      { mapPrice: 1000, product: { id: "p2", sku: "S2", name: "Cable", currentPrice: 1200 } },
    ]);
    const res = await request(app).get("/merchant/map-violations").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(2);
    expect(res.body.violations).toHaveLength(1);
    expect(res.body.violations[0]).toMatchObject({ sku: "S1", status: "VIOLATION", deviationAmount: 100 });
  });
  it("forecasts stock-outs from recent sales", async () => {
    db.product.findMany.mockResolvedValue([{ id: "p1", sku: "S1", name: "Phone", stockQuantity: 5, reorderPoint: 10, handlingTimeDays: 10 }]);
    db.salesRecord.findMany.mockResolvedValue([{ productId: "p1", quantity: 30 }]);
    const res = await request(app).get("/merchant/stock-forecast").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.urgent).toBe(1);
    expect(res.body.forecasts[0]).toMatchObject({ sku: "S1", dailyVelocity: 1, willStockOutBeforeRestock: true });
  });
  it("reports the price position against fresh competitor prices", async () => {
    db.competitorPrice.findMany.mockResolvedValue([{ price: 250 }, { price: 300 }]);
    const res = await request(app).get("/merchant/products/p1/price-position").set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ standing: "CHEAPEST", cheapest: 250, sampleSize: 2 });
  });
  it("builds a chronological price history", async () => {
    db.priceSuggestion.findMany.mockResolvedValue([{ suggestedPrice: 210, createdAt: new Date("2026-01-02") }]);
    db.priceApproval.findMany.mockResolvedValue([{ proposedPrice: 220, createdAt: new Date("2026-01-03"), status: "APPLIED" }]);
    db.competitorPrice.findMany.mockResolvedValue([{ price: 190, capturedAt: new Date("2026-01-01") }]);
    const res = await request(app).get("/merchant/products/p1/price-history").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.points.map((p: { price: number }) => p.price)).toEqual([190, 210, 220]);
    expect(res.body.summary).toMatchObject({ low: 190, high: 220, current: 220, points: 3 });
  });
  it("caps a promotion at the live cost floor", async () => {
    const res = await request(app).get("/merchant/products/p1/promotion-plan").set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ currentPrice: 200, effectiveFloor: 125, maxSafePrice: 125, withinSafety: true });
    expect(res.body.maxSafeDiscountPct).toBeCloseTo(0.375);
  });
  it("serves CSP-compatible external scripts without unsafe-inline", async () => {
    const res = await request(app).get("/dashboard.html");
    expect(res.status).toBe(200);
    expect(res.text).not.toContain("<script>");
    expect(res.headers["content-security-policy"]).toContain("script-src 'self'");
    expect((await request(app).get("/workflows.js")).status).toBe(200);
  });
});

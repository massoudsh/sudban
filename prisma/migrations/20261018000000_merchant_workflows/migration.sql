ALTER TABLE "products" ADD COLUMN "stockQuantity" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "reorderPoint" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "handlingTimeDays" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "sellers" ADD COLUMN "passwordHash" TEXT, ADD COLUMN "lastDigestAt" TIMESTAMP(3);
ALTER TABLE "seller_team_members" ADD COLUMN "apiKeyPrefix" TEXT, ADD COLUMN "apiKeyHash" TEXT;
CREATE UNIQUE INDEX "seller_team_members_apiKeyPrefix_key" ON "seller_team_members"("apiKeyPrefix");
ALTER TABLE "competitor_prices" ADD COLUMN "inStock" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "matchConfidence" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "sales_records" ADD COLUMN "unitCostSnapshot" DOUBLE PRECISION,
 ADD COLUMN "commissionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
 ADD COLUMN "shippingSubsidy" DOUBLE PRECISION NOT NULL DEFAULT 0,
 ADD COLUMN "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
 ADD COLUMN "returnCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
 ADD COLUMN "settlementDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0;
CREATE TABLE "seller_sessions" (
 "id" TEXT NOT NULL PRIMARY KEY, "sellerId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "seller_sessions_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "seller_sessions_tokenHash_key" ON "seller_sessions"("tokenHash");
CREATE INDEX "seller_sessions_sellerId_expiresAt_idx" ON "seller_sessions"("sellerId", "expiresAt");
CREATE TABLE "price_approvals" (
 "id" TEXT NOT NULL PRIMARY KEY, "sellerId" TEXT NOT NULL, "productId" TEXT NOT NULL,
 "previousPrice" DOUBLE PRECISION NOT NULL, "proposedPrice" DOUBLE PRECISION NOT NULL,
 "expectedMarginPct" DOUBLE PRECISION NOT NULL, "reason" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'RECOMMENDED',
 "approvedBy" TEXT, "appliedAt" TIMESTAMP(3), "rolledBackAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "price_approvals_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "price_approvals_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "price_approvals_sellerId_status_createdAt_idx" ON "price_approvals"("sellerId", "status", "createdAt");

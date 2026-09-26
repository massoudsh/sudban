CREATE TYPE "SellerRole" AS ENUM ('OWNER', 'MANAGER', 'ANALYST', 'VIEWER');
CREATE TYPE "IntegrationJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "IntegrationJobType" AS ENUM ('COMPETITOR_PRICE_SYNC', 'PRICE_PUSH');
CREATE TYPE "UsageEventType" AS ENUM ('API_REQUEST', 'PRICE_SUGGESTION', 'BULK_IMPORT_ROW', 'ALERT_NOTIFICATION', 'PRICE_PUSH_JOB');

ALTER TABLE "sellers" ADD COLUMN "role" "SellerRole" NOT NULL DEFAULT 'OWNER';

CREATE TABLE "seller_team_members" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "role" "SellerRole" NOT NULL DEFAULT 'VIEWER',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "seller_team_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_jobs" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "productId" TEXT,
  "type" "IntegrationJobType" NOT NULL,
  "status" "IntegrationJobStatus" NOT NULL DEFAULT 'QUEUED',
  "channel" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "result" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "integration_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "economic_signals" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'IRR',
  "rate" DOUBLE PRECISION,
  "inflationPct" DOUBLE PRECISION,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "economic_signals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "usage_events" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "type" "UsageEventType" NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscriptions" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "plan" TEXT NOT NULL,
  "activeSkuLimit" INTEGER NOT NULL,
  "includedApiRequests" INTEGER NOT NULL,
  "monthlyBasePrice" DOUBLE PRECISION NOT NULL,
  "overageUnitPrice" DOUBLE PRECISION NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seller_team_members_sellerId_email_key" ON "seller_team_members"("sellerId", "email");
CREATE INDEX "seller_team_members_sellerId_role_idx" ON "seller_team_members"("sellerId", "role");
CREATE INDEX "integration_jobs_sellerId_type_status_idx" ON "integration_jobs"("sellerId", "type", "status");
CREATE INDEX "integration_jobs_productId_type_status_idx" ON "integration_jobs"("productId", "type", "status");
CREATE INDEX "economic_signals_sellerId_capturedAt_idx" ON "economic_signals"("sellerId", "capturedAt");
CREATE INDEX "usage_events_sellerId_type_occurredAt_idx" ON "usage_events"("sellerId", "type", "occurredAt");
CREATE INDEX "subscriptions_sellerId_startsAt_idx" ON "subscriptions"("sellerId", "startsAt");

ALTER TABLE "seller_team_members" ADD CONSTRAINT "seller_team_members_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_jobs" ADD CONSTRAINT "integration_jobs_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_jobs" ADD CONSTRAINT "integration_jobs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "economic_signals" ADD CONSTRAINT "economic_signals_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

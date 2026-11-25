-- MAP (minimum advertised price) per product, used by the compliance report.
ALTER TABLE "pricing_rules" ADD COLUMN "mapPrice" DOUBLE PRECISION;

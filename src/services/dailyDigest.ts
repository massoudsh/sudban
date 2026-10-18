import "dotenv/config";
import { prisma } from "../lib/prisma";
import { loadProductPricingContext, NotFoundError } from "../lib/productContext";
import { checkRisks } from "./riskAlertEngine";
import { notifyNewAlerts } from "./notifier";

export async function runDailyDigest(send = false, now = new Date()) {
  const sellers = await prisma.seller.findMany({ where: { OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }] } });
  const summary = { sellers: sellers.length, alerts: 0, sent: 0, failed: 0 };
  for (const seller of sellers) {
    const products = await prisma.product.findMany({ where: { sellerId: seller.id, currentPrice: { not: null } } });
    const alerts = [];
    for (const product of products) {
      try {
        const { costs, pricingRule, competitivePosition } = await loadProductPricingContext(product.id);
        alerts.push(...checkRisks({ price: product.currentPrice!, costs, minMarginPct: pricingRule.minMarginPct, competitivePosition })
          .map(a => ({ ...a, message: `${product.name}: ${a.message}` })));
      } catch (error) { if (!(error instanceof NotFoundError)) throw error; }
    }
    summary.alerts += alerts.length;
    if (send && alerts.length) {
      const result = await notifyNewAlerts({ seller, productName: "خلاصه روزانه", productSku: "daily-digest", alerts });
      summary.sent += result.sent; summary.failed += result.failed;
      if (result.sent && !result.failed) await prisma.seller.update({ where: { id: seller.id }, data: { lastDigestAt: now } });
    }
  }
  return summary;
}

if (require.main === module) {
  runDailyDigest(process.argv.includes("--send")).then(result => console.log(JSON.stringify(result)))
    .catch(() => { console.error("Digest failed"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}

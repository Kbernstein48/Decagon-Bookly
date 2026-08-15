import { BOOKLY_MODEL } from "@/lib/agent";
import { getDatabase } from "@/lib/database";
import { knowledgeBaseCounts } from "@/lib/vector-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDatabase();
  const versions = db.prepare("SELECT sqlite_version() AS sqlite").get();
  const commerceCounts = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM orders) AS orders,
      (SELECT COUNT(*) FROM shipment_events) AS shipmentEvents,
      (SELECT COUNT(*) FROM shipping_investigations WHERE status IN ('open', 'carrier_review')) AS openShippingInvestigations,
      (SELECT COUNT(*) FROM catalog_items WHERE active = 1) AS catalogVariants,
      (SELECT COUNT(*) FROM carts c WHERE status = 'active' AND EXISTS (SELECT 1 FROM cart_items ci WHERE ci.cart_id = c.id)) AS activeCarts,
      (SELECT COUNT(*) FROM replacement_orders WHERE status IN ('processing', 'shipped')) AS activeReplacements,
      (SELECT COUNT(*) FROM support_cases WHERE status != 'closed') AS openSupportCases
  `).get();
  const knowledgeCounts = await knowledgeBaseCounts(db);
  return Response.json({
    ok: true,
    model: BOOKLY_MODEL,
    databases: { ...versions as object, vector: "LanceDB" },
    data: { ...commerceCounts as object, ...knowledgeCounts },
  });
}

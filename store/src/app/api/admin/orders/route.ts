import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight, requireAdmin } from "@/lib/api";
import type { Database } from "@/types/database";

export const OPTIONS = preflight;

type OrderStatus = Database["public"]["Tables"]["orders"]["Row"]["status"];
const ORDER_STATUSES: OrderStatus[] = ["pending_payment", "paid", "fulfilled", "cancelled", "refunded"];

/** GET /api/admin/orders?status=paid&limit=50&offset=0 */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const status = ORDER_STATUSES.find((s) => s === statusParam) ?? null;
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 200);
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);

    const admin = createAdminClient();
    let query = admin.from("orders").select("*", { count: "exact" });
    if (status) query = query.eq("status", status);

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    return json(req, { orders: data ?? [], total: count ?? 0 });
  } catch (err) {
    return errorJson(req, err);
  }
}

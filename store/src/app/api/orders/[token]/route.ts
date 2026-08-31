import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight, ApiError } from "@/lib/api";

export const OPTIONS = preflight;

/**
 * GET /api/orders/:token — customer-facing order status lookup. No login
 * required; the 32-character token (returned once at checkout, and emailed)
 * is unguessable, which is the whole access control here.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const admin = createAdminClient();

    const { data: order } = await admin.from("orders").select("*").eq("token", token).maybeSingle();
    if (!order) throw new ApiError(404, "Order not found");

    const { data: items } = await admin.from("order_items").select("*").eq("order_id", order.id);

    return json(req, { order, items: items ?? [] });
  } catch (err) {
    return errorJson(req, err);
  }
}

import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight, readJson, requireAdmin, ApiError } from "@/lib/api";
import { adminOrderStatusSchema } from "@/lib/validation";

export const OPTIONS = preflight;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const admin = createAdminClient();

    const { data: order } = await admin.from("orders").select("*").eq("id", id).maybeSingle();
    if (!order) throw new ApiError(404, "Order not found");
    const { data: items } = await admin.from("order_items").select("*").eq("order_id", id);
    const { data: payments } = await admin.from("payments").select("*").eq("order_id", id);
    const { data: events } = await admin
      .from("order_events")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: true });

    return json(req, { order, items: items ?? [], payments: payments ?? [], events: events ?? [] });
  } catch (err) {
    return errorJson(req, err);
  }
}

/** PATCH /api/admin/orders/:id — { status }. Status changes are logged to order_events by a DB trigger. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = adminOrderStatusSchema.parse(await readJson(req));
    const admin = createAdminClient();

    const { data: existing } = await admin.from("orders").select("id").eq("id", id).maybeSingle();
    if (!existing) throw new ApiError(404, "Order not found");

    const { data, error } = await admin.from("orders").update({ status: body.status }).eq("id", id).select("*").single();
    if (error) throw error;

    return json(req, { order: data });
  } catch (err) {
    return errorJson(req, err);
  }
}

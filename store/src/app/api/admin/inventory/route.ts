import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight, readJson, requireAdmin, ApiError } from "@/lib/api";
import { adminInventoryAdjustSchema } from "@/lib/validation";

export const OPTIONS = preflight;

/** GET /api/admin/inventory — every variant with its parent product name, for a stock overview. */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { data: variants, error } = await admin.from("variants").select("*").order("sku", { ascending: true });
    if (error) throw error;

    const productIds = [...new Set((variants ?? []).map((v) => v.product_id))];
    const { data: products } = productIds.length
      ? await admin.from("products").select("id, name, handle").in("id", productIds)
      : { data: [] };
    const productById = new Map((products ?? []).map((p) => [p.id, p]));

    return json(req, {
      variants: (variants ?? []).map((v) => ({ ...v, product: productById.get(v.product_id) ?? null })),
    });
  } catch (err) {
    return errorJson(req, err);
  }
}

/** POST /api/admin/inventory — { variantId, delta, reason? }. Adjusts stock by a positive or negative delta. */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = adminInventoryAdjustSchema.parse(await readJson(req));
    const admin = createAdminClient();

    const { data: variant } = await admin.from("variants").select("inventory_count").eq("id", body.variantId).maybeSingle();
    if (!variant) throw new ApiError(404, "Variant not found");

    const nextCount = variant.inventory_count + body.delta;
    if (nextCount < 0) throw new ApiError(400, `Adjustment would take inventory below zero (current: ${variant.inventory_count})`);

    const { data, error } = await admin
      .from("variants")
      .update({ inventory_count: nextCount })
      .eq("id", body.variantId)
      .select("*")
      .single();
    if (error) throw error;

    return json(req, { variant: data });
  } catch (err) {
    return errorJson(req, err);
  }
}

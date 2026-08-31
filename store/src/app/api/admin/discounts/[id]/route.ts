import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight, readJson, requireAdmin, ApiError } from "@/lib/api";
import { adminDiscountUpdateSchema } from "@/lib/validation";
import type { Database } from "@/types/database";

type DiscountUpdate = Database["public"]["Tables"]["discounts"]["Update"];

export const OPTIONS = preflight;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = adminDiscountUpdateSchema.parse(await readJson(req));
    const admin = createAdminClient();

    const { data: existing } = await admin.from("discounts").select("id").eq("id", id).maybeSingle();
    if (!existing) throw new ApiError(404, "Discount not found");

    const update: DiscountUpdate = {};
    if (body.code !== undefined) update.code = body.code;
    if (body.type !== undefined) update.type = body.type;
    if (body.value !== undefined) update.value = body.value;
    if (body.minSubtotalCents !== undefined) update.min_subtotal_cents = body.minSubtotalCents;
    if (body.active !== undefined) update.active = body.active;
    if (body.expiresAt !== undefined) update.expires_at = body.expiresAt;
    if (body.usageLimit !== undefined) update.usage_limit = body.usageLimit;

    const { data, error } = await admin.from("discounts").update(update).eq("id", id).select("*").single();
    if (error) throw error;
    return json(req, { discount: data });
  } catch (err) {
    return errorJson(req, err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const admin = createAdminClient();
    const { error } = await admin.from("discounts").delete().eq("id", id);
    if (error) throw error;
    return json(req, { ok: true });
  } catch (err) {
    return errorJson(req, err);
  }
}

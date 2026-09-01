import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight, readJson, requireAdmin } from "@/lib/api";
import { adminDiscountSchema } from "@/lib/validation";

export const OPTIONS = preflight;

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { data, error } = await admin.from("discounts").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return json(req, { discounts: data ?? [] });
  } catch (err) {
    return errorJson(req, err);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = adminDiscountSchema.parse(await readJson(req));
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("discounts")
      .insert({
        code: body.code,
        type: body.type,
        value: body.value,
        min_subtotal_cents: body.minSubtotalCents,
        active: body.active,
        expires_at: body.expiresAt,
        usage_limit: body.usageLimit,
      })
      .select("*")
      .single();
    if (error) throw error;
    return json(req, { discount: data }, 201);
  } catch (err) {
    return errorJson(req, err);
  }
}

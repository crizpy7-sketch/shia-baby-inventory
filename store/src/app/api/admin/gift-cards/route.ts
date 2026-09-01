import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight, readJson, requireAdmin } from "@/lib/api";
import { adminGiftCardSchema } from "@/lib/validation";

export const OPTIONS = preflight;

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { data, error } = await admin.from("gift_cards").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return json(req, { giftCards: data ?? [] });
  } catch (err) {
    return errorJson(req, err);
  }
}

/** POST /api/admin/gift-cards — issue a new gift card. */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = adminGiftCardSchema.parse(await readJson(req));
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("gift_cards")
      .insert({
        code: body.code,
        initial_balance_cents: body.initialBalanceCents,
        balance_cents: body.initialBalanceCents,
        issued_to_email: body.issuedToEmail,
      })
      .select("*")
      .single();
    if (error) throw error;
    return json(req, { giftCard: data }, 201);
  } catch (err) {
    return errorJson(req, err);
  }
}

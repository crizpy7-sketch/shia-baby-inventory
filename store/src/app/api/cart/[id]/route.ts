import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight, readJson, ApiError } from "@/lib/api";
import { updateCartSchema } from "@/lib/validation";
import { loadCartWithTotals } from "@/lib/cart";
import type { Database } from "@/types/database";

type CartUpdate = Database["public"]["Tables"]["carts"]["Update"];

export const OPTIONS = preflight;

function serialize(result: Awaited<ReturnType<typeof loadCartWithTotals>>) {
  const { cart, items, totals, discount, discountError, giftCard, giftCardError } = result;
  return {
    id: cart.id,
    status: cart.status,
    customerEmail: cart.customer_email,
    giftWrap: cart.gift_wrap,
    giftNote: cart.gift_note,
    items,
    totals,
    discountCode: cart.discount_code,
    discount,
    discountError,
    giftCardCode: cart.gift_card_code,
    giftCard,
    giftCardError,
  };
}

/** GET /api/cart/:id — live cart contents with freshly computed totals. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const admin = createAdminClient();
    const result = await loadCartWithTotals(admin, id);
    return json(req, { cart: serialize(result) });
  } catch (err) {
    return errorJson(req, err);
  }
}

/** PATCH /api/cart/:id — update customer email, gift wrap/note, discount or gift-card code. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = updateCartSchema.parse(await readJson(req));
    const admin = createAdminClient();

    const { data: existing } = await admin.from("carts").select("status").eq("id", id).maybeSingle();
    if (!existing) throw new ApiError(404, "Cart not found");
    if (existing.status !== "open") throw new ApiError(409, "This cart has already been checked out");

    const update: CartUpdate = {};
    if (body.customerEmail !== undefined) update.customer_email = body.customerEmail;
    if (body.giftWrap !== undefined) update.gift_wrap = body.giftWrap;
    if (body.giftNote !== undefined) update.gift_note = body.giftNote;
    if (body.discountCode !== undefined) update.discount_code = body.discountCode || null;
    if (body.giftCardCode !== undefined) update.gift_card_code = body.giftCardCode || null;

    if (Object.keys(update).length > 0) {
      const { error } = await admin.from("carts").update(update).eq("id", id);
      if (error) throw error;
    }

    const result = await loadCartWithTotals(admin, id);
    return json(req, { cart: serialize(result) });
  } catch (err) {
    return errorJson(req, err);
  }
}

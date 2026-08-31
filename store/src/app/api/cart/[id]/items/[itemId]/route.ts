import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight, readJson, ApiError } from "@/lib/api";
import { updateCartItemSchema } from "@/lib/validation";
import { loadCartWithTotals } from "@/lib/cart";

export const OPTIONS = preflight;

async function assertOwnedOpenCart(admin: ReturnType<typeof createAdminClient>, cartId: string) {
  const { data: cart } = await admin.from("carts").select("status").eq("id", cartId).maybeSingle();
  if (!cart) throw new ApiError(404, "Cart not found");
  if (cart.status !== "open") throw new ApiError(409, "This cart has already been checked out");
}

/** PATCH /api/cart/:id/items/:itemId — change a line item's quantity. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: cartId, itemId } = await params;
    const body = updateCartItemSchema.parse(await readJson(req));
    const admin = createAdminClient();
    await assertOwnedOpenCart(admin, cartId);

    const { data: item } = await admin
      .from("cart_items")
      .select("*, variants(inventory_count)")
      .eq("id", itemId)
      .eq("cart_id", cartId)
      .maybeSingle();
    if (!item) throw new ApiError(404, "Cart item not found");

    const inventoryCount = (item as unknown as { variants: { inventory_count: number } }).variants.inventory_count;
    if (body.quantity > inventoryCount) throw new ApiError(409, `Only ${inventoryCount} left in stock`);

    const { error } = await admin.from("cart_items").update({ quantity: body.quantity }).eq("id", itemId);
    if (error) throw error;

    const result = await loadCartWithTotals(admin, cartId);
    return json(req, { cart: { id: result.cart.id, items: result.items, totals: result.totals } });
  } catch (err) {
    return errorJson(req, err);
  }
}

/** DELETE /api/cart/:id/items/:itemId — remove a line item. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: cartId, itemId } = await params;
    const admin = createAdminClient();
    await assertOwnedOpenCart(admin, cartId);

    const { error } = await admin.from("cart_items").delete().eq("id", itemId).eq("cart_id", cartId);
    if (error) throw error;

    const result = await loadCartWithTotals(admin, cartId);
    return json(req, { cart: { id: result.cart.id, items: result.items, totals: result.totals } });
  } catch (err) {
    return errorJson(req, err);
  }
}

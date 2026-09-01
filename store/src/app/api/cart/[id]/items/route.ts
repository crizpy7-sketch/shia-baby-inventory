import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight, readJson, ApiError } from "@/lib/api";
import { addCartItemSchema } from "@/lib/validation";
import { loadCartWithTotals } from "@/lib/cart";

export const OPTIONS = preflight;

/** POST /api/cart/:id/items — add a variant to the cart (or increase its quantity). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: cartId } = await params;
    const body = addCartItemSchema.parse(await readJson(req));
    const admin = createAdminClient();

    const { data: cart } = await admin.from("carts").select("status").eq("id", cartId).maybeSingle();
    if (!cart) throw new ApiError(404, "Cart not found");
    if (cart.status !== "open") throw new ApiError(409, "This cart has already been checked out");

    const { data: variant } = await admin.from("variants").select("*").eq("id", body.variantId).maybeSingle();
    if (!variant) throw new ApiError(404, "Product variant not found");

    const { data: product } = await admin
      .from("products")
      .select("status")
      .eq("id", variant.product_id)
      .maybeSingle();
    if (!product || product.status !== "active") throw new ApiError(404, "Product is not available");

    const { data: existingItem } = await admin
      .from("cart_items")
      .select("*")
      .eq("cart_id", cartId)
      .eq("variant_id", body.variantId)
      .maybeSingle();

    const requestedQuantity = (existingItem?.quantity ?? 0) + body.quantity;
    if (requestedQuantity > variant.inventory_count) {
      throw new ApiError(409, `Only ${variant.inventory_count} left in stock`);
    }

    if (existingItem) {
      const { error } = await admin
        .from("cart_items")
        .update({ quantity: requestedQuantity })
        .eq("id", existingItem.id);
      if (error) throw error;
    } else {
      const { error } = await admin
        .from("cart_items")
        .insert({ cart_id: cartId, variant_id: body.variantId, quantity: body.quantity });
      if (error) throw error;
    }

    const result = await loadCartWithTotals(admin, cartId);
    return json(req, { cart: { id: result.cart.id, items: result.items, totals: result.totals } }, 201);
  } catch (err) {
    return errorJson(req, err);
  }
}

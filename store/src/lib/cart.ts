import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api";
import { computeOrderTotals, formatCents, type PricingResult } from "@/lib/pricing";
import type { Database, Tables } from "@/types/database";

export interface CartItemDetail {
  itemId: string;
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  unitPriceCents: number;
  quantity: number;
  inventoryCount: number;
  lineTotalCents: number;
}

export interface DiscountSummary {
  code: string;
  type: "percentage" | "fixed";
  value: number;
}

export interface GiftCardSummary {
  code: string;
  balanceCents: number;
}

export interface CartWithTotals {
  cart: Tables<"carts">;
  items: CartItemDetail[];
  totals: PricingResult;
  discount: DiscountSummary | null;
  discountError?: string;
  giftCard: GiftCardSummary | null;
  giftCardError?: string;
}

type Admin = SupabaseClient<Database>;

async function validateDiscount(
  admin: Admin,
  code: string | null,
  subtotalCents: number
): Promise<{ discount: DiscountSummary | null; error?: string }> {
  if (!code) return { discount: null };
  const { data } = await admin.from("discounts").select("*").eq("code", code).maybeSingle();
  if (!data) return { discount: null, error: "Discount code not found" };
  if (!data.active) return { discount: null, error: "Discount code is no longer active" };
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { discount: null, error: "Discount code has expired" };
  }
  if (data.usage_limit != null && data.times_used >= data.usage_limit) {
    return { discount: null, error: "Discount code has reached its usage limit" };
  }
  if (subtotalCents < data.min_subtotal_cents) {
    return {
      discount: null,
      error: `Add ${formatCents(data.min_subtotal_cents - subtotalCents)} more to use this code`,
    };
  }
  return { discount: { code: data.code, type: data.type, value: Number(data.value) } };
}

async function validateGiftCard(
  admin: Admin,
  code: string | null
): Promise<{ giftCard: GiftCardSummary | null; error?: string }> {
  if (!code) return { giftCard: null };
  const { data } = await admin.from("gift_cards").select("*").eq("code", code).maybeSingle();
  if (!data) return { giftCard: null, error: "Gift card not found" };
  if (data.status !== "active") return { giftCard: null, error: "Gift card is not active" };
  if (data.balance_cents <= 0) return { giftCard: null, error: "Gift card has no remaining balance" };
  return { giftCard: { code: data.code, balanceCents: data.balance_cents } };
}

/**
 * Loads a cart and computes its current totals fresh from the database
 * (live prices, live inventory, live discount/gift-card validity). Used
 * both for the cart preview endpoint and, once more, right before a
 * checkout snapshot is taken.
 */
export async function loadCartWithTotals(admin: Admin, cartId: string): Promise<CartWithTotals> {
  const { data: cart, error: cartError } = await admin.from("carts").select("*").eq("id", cartId).maybeSingle();
  if (cartError) throw cartError;
  if (!cart) throw new ApiError(404, "Cart not found");

  const { data: cartItems, error: itemsError } = await admin
    .from("cart_items")
    .select("*")
    .eq("cart_id", cartId);
  if (itemsError) throw itemsError;

  const variantIds = [...new Set((cartItems ?? []).map((i) => i.variant_id))];
  const variants = variantIds.length
    ? (await admin.from("variants").select("*").in("id", variantIds)).data ?? []
    : [];
  const productIds = [...new Set(variants.map((v) => v.product_id))];
  const products = productIds.length
    ? (await admin.from("products").select("*").in("id", productIds)).data ?? []
    : [];

  const variantById = new Map(variants.map((v) => [v.id, v]));
  const productById = new Map(products.map((p) => [p.id, p]));

  const items: CartItemDetail[] = (cartItems ?? []).map((row) => {
    const variant = variantById.get(row.variant_id);
    if (!variant) throw new ApiError(409, `Cart item references a variant that no longer exists`);
    const product = productById.get(variant.product_id);
    if (!product) throw new ApiError(409, `Cart item references a product that no longer exists`);

    const unitPriceCents = variant.price_override_cents ?? product.price_cents;
    const variantLabel = [variant.size, variant.color].filter(Boolean).join(" / ") || null;
    return {
      itemId: row.id,
      variantId: variant.id,
      productId: product.id,
      productName: product.name,
      variantLabel,
      unitPriceCents,
      quantity: row.quantity,
      inventoryCount: variant.inventory_count,
      lineTotalCents: unitPriceCents * row.quantity,
    };
  });

  const itemsSubtotalCents = items.reduce((sum, i) => sum + i.lineTotalCents, 0);

  const { discount, error: discountError } = await validateDiscount(admin, cart.discount_code, itemsSubtotalCents);
  const { giftCard, error: giftCardError } = await validateGiftCard(admin, cart.gift_card_code);

  const totals = computeOrderTotals({
    itemsSubtotalCents,
    giftWrap: cart.gift_wrap,
    discount: discount ? { type: discount.type, value: discount.value } : null,
    giftCardBalanceCents: giftCard?.balanceCents ?? 0,
  });

  return { cart, items, totals, discount, discountError, giftCard, giftCardError };
}

/** The frozen JSON shape written to carts.checkout_snapshot, consumed by the create_order_from_snapshot SQL function. */
export function buildCheckoutSnapshot(cartWithTotals: CartWithTotals) {
  const { items, totals, discount, giftCard } = cartWithTotals;
  return {
    items: items.map((i) => ({
      variantId: i.variantId,
      productId: i.productId,
      productName: i.productName,
      variantLabel: i.variantLabel,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
    })),
    subtotalCents: totals.subtotalCents,
    discountCents: totals.discountCents,
    discountCode: discount?.code ?? null,
    giftWrapCents: totals.giftWrapCents,
    shippingCents: totals.shippingCents,
    taxCents: totals.taxCents,
    giftCardCode: giftCard?.code ?? null,
    giftCardAppliedCents: totals.giftCardAppliedCents,
    totalCents: totals.totalCents,
  };
}

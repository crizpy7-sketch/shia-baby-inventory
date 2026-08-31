import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight, readJson, ApiError } from "@/lib/api";
import { checkoutSchema } from "@/lib/validation";
import { loadCartWithTotals, buildCheckoutSnapshot } from "@/lib/cart";
import { getStripe } from "@/lib/stripe";
import { sendOrderConfirmationEmail } from "@/lib/email";

export const OPTIONS = preflight;

/**
 * POST /api/checkout — { cartId, customerEmail? }
 *
 * All prices are recomputed here from the database, never trusted from the
 * client. The computed totals are frozen into carts.checkout_snapshot so
 * the Stripe webhook (or the $0 gift-card path below) fulfills the order
 * against exactly what the customer was charged for, not whatever the
 * cart looks like by the time payment confirms.
 */
export async function POST(req: Request) {
  try {
    const body = checkoutSchema.parse(await readJson(req));
    const admin = createAdminClient();

    const { data: cartRow } = await admin.from("carts").select("status, customer_email").eq("id", body.cartId).maybeSingle();
    if (!cartRow) throw new ApiError(404, "Cart not found");
    if (cartRow.status !== "open") throw new ApiError(409, "This cart has already been checked out");

    const customerEmail = body.customerEmail ?? cartRow.customer_email;
    if (!customerEmail) throw new ApiError(400, "customerEmail is required");
    if (body.customerEmail && body.customerEmail !== cartRow.customer_email) {
      await admin.from("carts").update({ customer_email: body.customerEmail }).eq("id", body.cartId);
    }

    const result = await loadCartWithTotals(admin, body.cartId);
    if (result.items.length === 0) throw new ApiError(400, "Cart is empty");

    const insufficient = result.items.filter((i) => i.quantity > i.inventoryCount);
    if (insufficient.length > 0) {
      throw new ApiError(
        409,
        `Not enough stock for: ${insufficient.map((i) => i.productName).join(", ")}`
      );
    }
    if (result.discountError) throw new ApiError(400, result.discountError);
    if (result.giftCardError) throw new ApiError(400, result.giftCardError);

    const snapshot = buildCheckoutSnapshot(result);

    // Full coverage by a gift card — no payment collection needed.
    if (snapshot.totalCents === 0) {
      const syntheticSessionId = `ZERO-${body.cartId}`;
      await admin.from("carts").update({ checkout_snapshot: snapshot, locked_at: new Date().toISOString() }).eq("id", body.cartId);

      const { data: rpcResult, error: rpcError } = await admin.rpc("create_order_from_snapshot", {
        p_cart_id: body.cartId,
        p_stripe_session_id: syntheticSessionId,
        p_stripe_payment_intent_id: null,
        p_customer_email: customerEmail,
      });
      if (rpcError) throw new ApiError(409, rpcError.message);
      const order = rpcResult?.[0];
      if (!order) throw new ApiError(500, "Order could not be created");

      const { data: fullOrder } = await admin.from("orders").select("*").eq("id", order.order_id).single();
      const { data: orderItems } = await admin.from("order_items").select("*").eq("order_id", order.order_id);
      if (fullOrder) await sendOrderConfirmationEmail(fullOrder, orderItems ?? []);

      return json(req, { paid: true, orderToken: order.order_token });
    }

    await admin.from("carts").update({ checkout_snapshot: snapshot, locked_at: new Date().toISOString() }).eq("id", body.cartId);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const stripe = getStripe();

    // Merchandise discount is spread proportionally across item unit prices
    // (Stripe line items can't be negative), everything else is its own line.
    const discountMultiplier =
      snapshot.subtotalCents > 0 ? (snapshot.subtotalCents - snapshot.discountCents) / snapshot.subtotalCents : 1;

    const lineItems = snapshot.items.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: "usd",
        unit_amount: Math.max(0, Math.round(item.unitPriceCents * discountMultiplier)),
        product_data: {
          name: item.variantLabel ? `${item.productName} — ${item.variantLabel}` : item.productName,
        },
      },
    }));

    if (snapshot.shippingCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: { currency: "usd", unit_amount: snapshot.shippingCents, product_data: { name: "Shipping" } },
      });
    }
    if (snapshot.giftWrapCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: { currency: "usd", unit_amount: snapshot.giftWrapCents, product_data: { name: "Signature gift wrap" } },
      });
    }
    if (snapshot.taxCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: { currency: "usd", unit_amount: snapshot.taxCents, product_data: { name: "Estimated tax" } },
      });
    }
    // Stripe Checkout line items can't carry a negative amount, so a
    // partially-applied gift card is expressed as a one-time coupon
    // instead of a negative line item.
    let discounts: { coupon: string }[] | undefined;
    if (snapshot.giftCardAppliedCents > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: snapshot.giftCardAppliedCents,
        currency: "usd",
        duration: "once",
        name: `Gift card ${snapshot.giftCardCode}`,
      });
      discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customerEmail,
      line_items: lineItems,
      discounts,
      metadata: { cartId: body.cartId },
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout/cancelled`,
    });

    await admin.from("carts").update({ stripe_checkout_session_id: session.id }).eq("id", body.cartId);

    return json(req, { url: session.url });
  } catch (err) {
    return errorJson(req, err);
  }
}

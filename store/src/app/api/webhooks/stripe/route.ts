import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { sendOrderConfirmationEmail } from "@/lib/email";

/**
 * Stripe webhook — the only place a paid order actually gets created.
 * Fulfillment (order + order_items + inventory decrement + discount/gift-card
 * redemption) happens inside the create_order_from_snapshot SQL function so
 * it's one atomic transaction; this handler just verifies the event and
 * calls it. Idempotent: re-delivering the same session.id is a no-op.
 */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return new Response("Webhook not configured", { status: 500 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response("ignored", { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const cartId = session.metadata?.cartId;
  if (!cartId) {
    console.error("checkout.session.completed missing cartId metadata", session.id);
    return new Response("missing cartId", { status: 400 });
  }

  const admin = createAdminClient();
  const customerEmail = session.customer_email ?? session.customer_details?.email;
  if (!customerEmail) {
    console.error("checkout.session.completed missing customer email", session.id);
    return new Response("missing customer email", { status: 400 });
  }

  const { data: rpcResult, error: rpcError } = await admin.rpc("create_order_from_snapshot", {
    p_cart_id: cartId,
    p_stripe_session_id: session.id,
    p_stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
    p_customer_email: customerEmail,
  });

  if (rpcError) {
    // Surfacing a 500 tells Stripe to retry — appropriate for a transient
    // DB error, though a genuine "insufficient inventory" will retry and
    // fail the same way every time until someone investigates.
    console.error("create_order_from_snapshot failed", rpcError, { cartId, sessionId: session.id });
    return new Response("fulfillment failed", { status: 500 });
  }

  const order = rpcResult?.[0];
  if (!order) return new Response("no order returned", { status: 500 });

  const { data: fullOrder } = await admin.from("orders").select("*").eq("id", order.order_id).single();
  const { data: orderItems } = await admin.from("order_items").select("*").eq("order_id", order.order_id);
  if (fullOrder) {
    try {
      await sendOrderConfirmationEmail(fullOrder, orderItems ?? []);
    } catch (err) {
      // Don't fail the webhook over email delivery — the order already exists.
      console.error("Order confirmation email failed", err);
    }
  }

  return new Response("ok", { status: 200 });
}

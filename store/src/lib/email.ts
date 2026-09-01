import { Resend } from "resend";
import { brand, brandFonts } from "@/lib/brand";
import { formatCents } from "@/lib/pricing";
import type { Tables } from "@/types/database";

let _resend: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${brand.cream};font-family:${brandFonts.body};color:${brand.ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.cream};padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:${brand.paper};border-radius:14px;overflow:hidden;">
          <tr><td style="background:${brand.indigo};padding:28px 32px;">
            <span style="font:700 22px ${brandFonts.display};color:${brand.cream};letter-spacing:.02em;">Shia Baby</span>
          </td></tr>
          <tr><td style="padding:32px;">
            <h1 style="font:700 22px ${brandFonts.display};color:${brand.indigo};margin:0 0 16px;">${title}</h1>
            ${bodyHtml}
          </td></tr>
          <tr><td style="padding:20px 32px;background:${brand.cream};color:${brand.muted};font-size:12px;">
            Shia Baby &middot; Timeless Baby Essentials
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

type OrderRow = Tables<"orders">;
type OrderItemRow = Tables<"order_items">;

export async function sendOrderConfirmationEmail(order: OrderRow, items: OrderItemRow[]) {
  const resend = getResend();
  const itemsHtml = items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid ${brand.line};">${i.product_name}${i.variant_label ? ` — ${i.variant_label}` : ""} &times; ${i.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid ${brand.line};text-align:right;white-space:nowrap;">${formatCents(i.unit_price_cents * i.quantity)}</td>
        </tr>`
    )
    .join("");

  const html = shell(
    "Your order is confirmed",
    `
    <p style="margin:0 0 20px;color:${brand.muted};">Thank you for your order, beautifully wrapped and on its way. Order <strong>${order.order_number}</strong>.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:20px;">
      ${itemsHtml}
      <tr><td style="padding-top:12px;">Subtotal</td><td style="padding-top:12px;text-align:right;">${formatCents(order.subtotal_cents)}</td></tr>
      ${order.discount_cents ? `<tr><td>Discount${order.discount_code ? ` (${order.discount_code})` : ""}</td><td style="text-align:right;">-${formatCents(order.discount_cents)}</td></tr>` : ""}
      ${order.gift_wrap_cents ? `<tr><td>Gift wrap</td><td style="text-align:right;">${formatCents(order.gift_wrap_cents)}</td></tr>` : ""}
      <tr><td>Shipping</td><td style="text-align:right;">${order.shipping_cents === 0 ? "Complimentary" : formatCents(order.shipping_cents)}</td></tr>
      ${order.tax_cents ? `<tr><td>Tax</td><td style="text-align:right;">${formatCents(order.tax_cents)}</td></tr>` : ""}
      ${order.gift_card_cents ? `<tr><td>Gift card</td><td style="text-align:right;">-${formatCents(order.gift_card_cents)}</td></tr>` : ""}
      <tr><td style="padding-top:12px;font-weight:700;">Total</td><td style="padding-top:12px;text-align:right;font-weight:700;">${formatCents(order.total_cents)}</td></tr>
    </table>
    ${order.gift_note ? `<p style="font-style:italic;color:${brand.muted};">Gift note: "${order.gift_note}"</p>` : ""}
    `
  );

  if (!resend) {
    console.log(`[email:skipped — RESEND_API_KEY unset] order confirmation for ${order.customer_email} (${order.order_number})`);
    return;
  }

  await resend.emails.send({
    from: process.env.EMAIL_FROM || "Shia Baby <hello@shiababy.com>",
    to: order.customer_email,
    subject: `Your Shia Baby order ${order.order_number} is confirmed`,
    html,
  });

  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (adminEmail) {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "Shia Baby <hello@shiababy.com>",
      to: adminEmail,
      subject: `New order ${order.order_number} — ${formatCents(order.total_cents)}`,
      html: shell("New order received", `<p>${order.customer_email} — ${formatCents(order.total_cents)}</p>`),
    });
  }
}

export async function sendWaitlistWelcomeEmail(email: string) {
  const resend = getResend();
  const html = shell(
    "Welcome to the family",
    `<p style="color:${brand.muted};">You're on the Founding Families list — you'll be the first to know when we open, and your 15% off is waiting for your first order.</p>`
  );
  if (!resend) {
    console.log(`[email:skipped — RESEND_API_KEY unset] waitlist welcome for ${email}`);
    return;
  }
  await resend.emails.send({
    from: process.env.EMAIL_FROM || "Shia Baby <hello@shiababy.com>",
    to: email,
    subject: "Welcome to the Shia Baby Founding Families",
    html,
  });
}

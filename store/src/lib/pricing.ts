// Central pricing engine — the ONE place order totals get computed.
// Every price the client sees or pays flows through here, always derived
// from server-side data (variant/product prices in the DB), never from
// client-submitted amounts.

export const FREE_SHIPPING_THRESHOLD_CENTS = Math.round(Number(process.env.FREE_SHIPPING_THRESHOLD ?? 75) * 100);
export const FLAT_SHIPPING_CENTS = Math.round(Number(process.env.FLAT_SHIPPING_RATE ?? 6.95) * 100);
export const GIFT_WRAP_CENTS = Math.round(Number(process.env.GIFT_WRAP_PRICE ?? 8) * 100);
export const TAX_RATE = Number(process.env.TAX_RATE ?? 0);

export interface DiscountInput {
  type: "percentage" | "fixed";
  value: number;
}

export interface PricingInput {
  itemsSubtotalCents: number;
  giftWrap: boolean;
  discount?: DiscountInput | null;
  giftCardBalanceCents?: number;
}

export interface PricingResult {
  subtotalCents: number;
  discountCents: number;
  giftWrapCents: number;
  shippingCents: number;
  taxCents: number;
  giftCardAppliedCents: number;
  totalCents: number;
}

export function computeOrderTotals(input: PricingInput): PricingResult {
  const { itemsSubtotalCents, giftWrap, discount, giftCardBalanceCents = 0 } = input;

  let discountCents = 0;
  if (discount) {
    discountCents =
      discount.type === "percentage"
        ? Math.round(itemsSubtotalCents * (discount.value / 100))
        : Math.round(discount.value * 100);
    discountCents = Math.max(0, Math.min(discountCents, itemsSubtotalCents));
  }

  const discountedSubtotal = itemsSubtotalCents - discountCents;
  const giftWrapCents = giftWrap ? GIFT_WRAP_CENTS : 0;
  const shippingCents = discountedSubtotal >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : FLAT_SHIPPING_CENTS;
  const taxableCents = discountedSubtotal + giftWrapCents;
  const taxCents = Math.round(taxableCents * TAX_RATE);

  const preGiftCardTotal = discountedSubtotal + giftWrapCents + shippingCents + taxCents;
  const giftCardAppliedCents = Math.max(0, Math.min(giftCardBalanceCents, preGiftCardTotal));
  const totalCents = Math.max(0, preGiftCardTotal - giftCardAppliedCents);

  return {
    subtotalCents: itemsSubtotalCents,
    discountCents,
    giftWrapCents,
    shippingCents,
    taxCents,
    giftCardAppliedCents,
    totalCents,
  };
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

import { z } from "zod";

export const waitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["expecting", "gifting", "grandparent", "other"]).optional(),
  source: z.string().max(80).optional(),
});

export const addCartItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive().max(20).default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive().max(20),
});

export const updateCartSchema = z.object({
  customerEmail: z.string().trim().toLowerCase().email().optional(),
  giftWrap: z.boolean().optional(),
  giftNote: z.string().max(500).optional().nullable(),
  discountCode: z.string().trim().toUpperCase().max(50).optional().nullable(),
  giftCardCode: z.string().trim().toUpperCase().max(50).optional().nullable(),
});

export const checkoutSchema = z.object({
  cartId: z.string().uuid(),
  customerEmail: z.string().trim().toLowerCase().email().optional(),
});

export const variantInputSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().min(1).max(100),
  size: z.string().max(40).optional().nullable(),
  color: z.string().max(40).optional().nullable(),
  priceOverrideCents: z.number().int().nonnegative().optional().nullable(),
  inventoryCount: z.number().int().nonnegative().default(0),
});

export const adminProductSchema = z.object({
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "handle must be lowercase, hyphen-separated"),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  vendor: z.string().max(120).optional().nullable(),
  productType: z.string().max(120).optional().nullable(),
  tags: z.array(z.string().max(40)).max(30).default([]),
  priceCents: z.number().int().nonnegative(),
  compareAtPriceCents: z.number().int().nonnegative().optional().nullable(),
  giftReady: z.boolean().default(false),
  materials: z.string().max(2000).optional().nullable(),
  careInstructions: z.string().max(2000).optional().nullable(),
  images: z.array(z.string().url()).max(20).default([]),
  collectionIds: z.array(z.string().uuid()).max(20).default([]),
  variants: z.array(variantInputSchema).min(1),
});

export const adminProductUpdateSchema = adminProductSchema.partial().extend({
  variants: z.array(variantInputSchema).optional(),
});

export const adminCollectionSchema = z.object({
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "handle must be lowercase, hyphen-separated"),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  type: z.enum(["manual", "smart"]).default("manual"),
});

export const adminCollectionUpdateSchema = adminCollectionSchema.partial();

export const adminOrderStatusSchema = z.object({
  status: z.enum(["pending_payment", "paid", "fulfilled", "cancelled", "refunded"]),
});

export const adminInventoryAdjustSchema = z.object({
  variantId: z.string().uuid(),
  delta: z.number().int().refine((n) => n !== 0, "delta must be non-zero"),
  reason: z.string().max(200).optional(),
});

export const adminDiscountSchema = z.object({
  code: z.string().trim().toUpperCase().min(2).max(50),
  type: z.enum(["percentage", "fixed"]),
  value: z.number().positive(),
  minSubtotalCents: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
  expiresAt: z.string().datetime().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
});

export const adminDiscountUpdateSchema = adminDiscountSchema.partial();

export const adminGiftCardSchema = z.object({
  code: z.string().trim().toUpperCase().min(4).max(50),
  initialBalanceCents: z.number().int().positive(),
  issuedToEmail: z.string().trim().toLowerCase().email().optional().nullable(),
});

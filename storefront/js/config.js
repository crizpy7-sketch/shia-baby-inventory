/**
 * Storefront configuration. Set window.__STOREFRONT_CONFIG__ before this
 * module loads (see index.html) to point at the real Shopify Storefront
 * API. Left unset, the app runs entirely on the bundled mock catalog in
 * data/products.sample.json — real UI, real interactions, no live store
 * required. That's deliberate: a designer working on this doesn't need
 * Shopify credentials to see it fully populated.
 *
 * To go live:
 *   1. Shopify Admin → Settings → Apps → Develop apps → (the app created
 *      for square-shopify-sync, or a new one) → API credentials →
 *      Storefront API → generate a token with scopes:
 *      unauthenticated_read_product_listings,
 *      unauthenticated_read_product_inventory,
 *      unauthenticated_write_checkouts (or unauthenticated_read/write_cart
 *      on newer API versions).
 *   2. Set window.__STOREFRONT_CONFIG__ = { domain: 'your-store.myshopify.com',
 *      token: 'shpat_...' } in index.html/shop.html/product.html.
 * The Storefront token is safe to ship client-side — unlike the Admin API
 * token used by square-shopify-sync, it's scoped for exactly this.
 */
const runtimeConfig = typeof window !== "undefined" ? window.__STOREFRONT_CONFIG__ : undefined;

export const config = {
  domain: runtimeConfig?.domain ?? null,
  token: runtimeConfig?.token ?? null,
  apiVersion: "2025-01",
  get isLive() {
    return Boolean(this.domain && this.token);
  },
  freeShippingThresholdCents: 7500,
  currency: "USD",
};

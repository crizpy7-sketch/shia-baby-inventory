import { config } from "./config.js";

/* ============================================================
 * Storefront API GraphQL client
 * ============================================================ */

async function storefrontGraphQL(query, variables) {
  const res = await fetch(`https://${config.domain}/api/${config.apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": config.token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    const message = json.errors?.map((e) => e.message).join("; ") ?? res.statusText;
    throw new Error(`Storefront API error: ${message}`);
  }
  return json.data;
}

const PRODUCT_FIELDS = `
  id
  handle
  title
  description
  vendor
  productType
  tags
  featuredImage { url altText }
  images(first: 10) { edges { node { url altText } } }
  priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
  options { name optionValues { name } }
  variants(first: 25) {
    edges {
      node {
        id
        title
        sku
        availableForSale
        quantityAvailable
        price { amount currencyCode }
        selectedOptions { name value }
      }
    }
  }
`;

function normalizeStorefrontProduct(node) {
  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    description: node.description,
    vendor: node.vendor,
    productType: node.productType,
    tags: node.tags ?? [],
    collections: [], // resolved separately when browsing by collection
    featuredImage: node.featuredImage ?? node.images?.edges?.[0]?.node ?? null,
    images: (node.images?.edges ?? []).map((e) => e.node),
    priceRange: {
      min: Number(node.priceRange.minVariantPrice.amount),
      max: Number(node.priceRange.maxVariantPrice.amount),
      currency: node.priceRange.minVariantPrice.currencyCode,
    },
    options: (node.options ?? []).map((o) => ({ name: o.name, values: (o.optionValues ?? []).map((v) => v.name) })),
    variants: (node.variants?.edges ?? []).map((e) => ({
      id: e.node.id,
      title: e.node.title,
      sku: e.node.sku,
      price: Number(e.node.price.amount),
      available: e.node.availableForSale,
      quantityAvailable: e.node.quantityAvailable ?? null,
      selectedOptions: e.node.selectedOptions,
    })),
  };
}

/* ============================================================
 * Mock catalog (bundled fixture — see data/products.sample.json)
 * ============================================================ */

let mockCatalogPromise;
async function loadMockCatalog() {
  if (!mockCatalogPromise) {
    mockCatalogPromise = fetch(new URL("../data/products.sample.json", import.meta.url)).then((res) => {
      if (!res.ok) throw new Error("Could not load mock catalog");
      return res.json();
    });
  }
  return mockCatalogPromise;
}

/* ============================================================
 * Public repository — same interface regardless of data source
 * ============================================================ */

function matchesQuery(product, query) {
  if (!query) return true;
  const haystack = `${product.title} ${product.productType} ${product.tags.join(" ")}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function sortProducts(products, sort) {
  const sorted = [...products];
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => a.priceRange.min - b.priceRange.min);
    case "price-desc":
      return sorted.sort((a, b) => b.priceRange.min - a.priceRange.min);
    case "title-asc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return sorted; // "featured" — bundled/catalog order
  }
}

export async function listProducts({ collectionHandle, search, sort = "featured", first = 24 } = {}) {
  if (config.isLive) {
    let query = "";
    if (collectionHandle) query += `product_type:${JSON.stringify(collectionHandle)}`;
    if (search) query += `${query ? " AND " : ""}title:*${search}*`;

    const sortKeyMap = { "price-asc": "PRICE", "price-desc": "PRICE", "title-asc": "TITLE", featured: "RELEVANCE" };
    const data = await storefrontGraphQL(
      `query Products($first: Int!, $query: String, $sortKey: ProductSortKeys, $reverse: Boolean) {
        products(first: $first, query: $query, sortKey: $sortKey, reverse: $reverse) {
          edges { node { ${PRODUCT_FIELDS} } }
        }
      }`,
      { first, query: query || null, sortKey: sortKeyMap[sort], reverse: sort === "price-desc" }
    );
    return data.products.edges.map((e) => normalizeStorefrontProduct(e.node));
  }

  const catalog = await loadMockCatalog();
  let products = catalog.products;
  if (collectionHandle) products = products.filter((p) => p.collections.includes(collectionHandle));
  products = products.filter((p) => matchesQuery(p, search));
  return sortProducts(products, sort).slice(0, first);
}

export async function getProduct(handle) {
  if (config.isLive) {
    const data = await storefrontGraphQL(
      `query ProductByHandle($handle: String!) {
        product(handle: $handle) { ${PRODUCT_FIELDS} }
      }`,
      { handle }
    );
    return data.product ? normalizeStorefrontProduct(data.product) : null;
  }

  const catalog = await loadMockCatalog();
  return catalog.products.find((p) => p.handle === handle) ?? null;
}

export async function listCollections() {
  if (config.isLive) {
    const data = await storefrontGraphQL(
      `query Collections($first: Int!) {
        collections(first: $first) { edges { node { handle title description } } }
      }`,
      { first: 20 }
    );
    return data.collections.edges.map((e) => e.node);
  }

  const catalog = await loadMockCatalog();
  return catalog.collections;
}

/* ============================================================
 * Cart (Shopify Storefront Cart API — live mode only)
 * ============================================================
 * In mock mode the cart is purely client-side state (see cart.js) with a
 * simulated checkout. In live mode every mutation below talks to Shopify's
 * real cart so `checkoutUrl` is a genuine, working Shopify checkout link.
 */

const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  cost { totalAmount { amount currencyCode } subtotalAmount { amount currencyCode } }
  lines(first: 50) {
    edges {
      node {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            price { amount currencyCode }
            image { url altText }
            product { title handle }
          }
        }
      }
    }
  }
`;

function normalizeCart(cart) {
  return {
    id: cart.id,
    checkoutUrl: cart.checkoutUrl,
    totalQuantity: cart.totalQuantity,
    subtotal: Number(cart.cost.subtotalAmount.amount),
    total: Number(cart.cost.totalAmount.amount),
    currency: cart.cost.totalAmount.currencyCode,
    lines: cart.lines.edges.map((e) => ({
      lineId: e.node.id,
      quantity: e.node.quantity,
      variantId: e.node.merchandise.id,
      title: e.node.merchandise.product.title,
      variantTitle: e.node.merchandise.title,
      handle: e.node.merchandise.product.handle,
      price: Number(e.node.merchandise.price.amount),
      image: e.node.merchandise.image,
    })),
  };
}

export async function shopifyCartCreate(lines) {
  const data = await storefrontGraphQL(
    `mutation CartCreate($input: CartInput) {
      cartCreate(input: $input) { cart { ${CART_FIELDS} } userErrors { field message } }
    }`,
    { input: { lines } }
  );
  if (data.cartCreate.userErrors.length) throw new Error(data.cartCreate.userErrors.map((e) => e.message).join("; "));
  return normalizeCart(data.cartCreate.cart);
}

export async function shopifyCartLinesAdd(cartId, lines) {
  const data = await storefrontGraphQL(
    `mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ${CART_FIELDS} } userErrors { field message } }
    }`,
    { cartId, lines }
  );
  if (data.cartLinesAdd.userErrors.length) throw new Error(data.cartLinesAdd.userErrors.map((e) => e.message).join("; "));
  return normalizeCart(data.cartLinesAdd.cart);
}

export async function shopifyCartLinesUpdate(cartId, lines) {
  const data = await storefrontGraphQL(
    `mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ${CART_FIELDS} } userErrors { field message } }
    }`,
    { cartId, lines }
  );
  if (data.cartLinesUpdate.userErrors.length) throw new Error(data.cartLinesUpdate.userErrors.map((e) => e.message).join("; "));
  return normalizeCart(data.cartLinesUpdate.cart);
}

export async function shopifyCartLinesRemove(cartId, lineIds) {
  const data = await storefrontGraphQL(
    `mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ${CART_FIELDS} } userErrors { field message } }
    }`,
    { cartId, lineIds }
  );
  if (data.cartLinesRemove.userErrors.length) throw new Error(data.cartLinesRemove.userErrors.map((e) => e.message).join("; "));
  return normalizeCart(data.cartLinesRemove.cart);
}

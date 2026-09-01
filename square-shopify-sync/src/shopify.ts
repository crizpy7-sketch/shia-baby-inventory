import type { ShopifyVariantMatch } from "./types.js";

const API_VERSION = "2025-01";
const SYNC_TAG = "square-import";

function endpoint(): string {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error("SHOPIFY_STORE_DOMAIN is not set");
  return `https://${domain}/admin/api/${API_VERSION}/graphql.json`;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
  extensions?: { cost?: { throttleStatus?: { currentlyAvailable: number; restoreRate: number } } };
}

async function shopifyGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!token) throw new Error("SHOPIFY_ADMIN_ACCESS_TOKEN is not set");

  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? "2");
      await sleep(retryAfter * 1000);
      continue;
    }

    const json = (await res.json()) as GraphQLResponse<T>;
    if (!res.ok || json.errors?.length) {
      throw new Error(`Shopify GraphQL error: ${json.errors?.map((e) => e.message).join("; ") ?? res.statusText}`);
    }

    const throttle = json.extensions?.cost?.throttleStatus;
    if (throttle && throttle.currentlyAvailable < 200) {
      await sleep(500);
    }
    return json.data as T;
  }
  throw new Error("Shopify GraphQL: exceeded retry budget while rate-limited");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toCents(price: string): number {
  return Math.round(Number(price) * 100);
}

function toDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Finds a variant by exact SKU. Returns null if no product carries that SKU. */
export async function findVariantBySku(sku: string): Promise<ShopifyVariantMatch | null> {
  const data = await shopifyGraphQL<{
    productVariants: {
      edges: {
        node: {
          id: string;
          sku: string | null;
          price: string;
          inventoryQuantity: number | null;
          inventoryItem: { id: string };
          product: { id: string; title: string; status: string };
        };
      }[];
    };
  }>(
    `query FindVariantBySku($query: String!) {
      productVariants(first: 1, query: $query) {
        edges {
          node {
            id
            sku
            price
            inventoryQuantity
            inventoryItem { id }
            product { id title status }
          }
        }
      }
    }`,
    { query: `sku:${JSON.stringify(sku)}` }
  );

  const node = data.productVariants.edges[0]?.node;
  if (!node || node.sku !== sku) return null;

  return {
    variantId: node.id,
    productId: node.product.id,
    productTitle: node.product.title,
    productStatus: node.product.status,
    inventoryItemId: node.inventoryItem.id,
    priceCents: toCents(node.price),
    inventoryQuantity: node.inventoryQuantity ?? 0,
  };
}

/**
 * Creates a new single-variant Shopify product for a Square item that has
 * no matching SKU yet, and returns the match info needed to set its stock.
 */
export async function createProductFromSquare(product: {
  sku: string;
  title: string;
  description: string | null;
  priceCents: number;
}): Promise<ShopifyVariantMatch> {
  const created = await shopifyGraphQL<{
    productCreate: {
      product: { id: string; title: string; variants: { edges: { node: { id: string; inventoryItem: { id: string } } }[] } } | null;
      userErrors: { field: string[]; message: string }[];
    };
  }>(
    `mutation CreateProduct($product: ProductCreateInput!) {
      productCreate(product: $product) {
        product {
          id
          title
          variants(first: 1) {
            edges { node { id inventoryItem { id } } }
          }
        }
        userErrors { field message }
      }
    }`,
    {
      product: {
        title: product.title,
        descriptionHtml: product.description ?? undefined,
        vendor: "Shia Baby",
        status: "ACTIVE",
        tags: [SYNC_TAG],
      },
    }
  );

  if (created.productCreate.userErrors.length > 0) {
    throw new Error(`productCreate failed for SKU ${product.sku}: ${created.productCreate.userErrors.map((e) => e.message).join("; ")}`);
  }
  const shopifyProduct = created.productCreate.product;
  const defaultVariant = shopifyProduct?.variants.edges[0]?.node;
  if (!shopifyProduct || !defaultVariant) {
    throw new Error(`productCreate returned no default variant for SKU ${product.sku}`);
  }

  const updated = await shopifyGraphQL<{
    productVariantsBulkUpdate: {
      productVariants: { id: string; sku: string | null; price: string; inventoryItem: { id: string } }[];
      userErrors: { field: string[]; message: string }[];
    };
  }>(
    `mutation UpdateVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id sku price inventoryItem { id } }
        userErrors { field message }
      }
    }`,
    {
      productId: shopifyProduct.id,
      variants: [
        {
          id: defaultVariant.id,
          price: toDollars(product.priceCents),
          inventoryItem: { sku: product.sku, tracked: true },
        },
      ],
    }
  );

  if (updated.productVariantsBulkUpdate.userErrors.length > 0) {
    throw new Error(
      `productVariantsBulkUpdate failed for SKU ${product.sku}: ${updated.productVariantsBulkUpdate.userErrors.map((e) => e.message).join("; ")}`
    );
  }

  return {
    variantId: defaultVariant.id,
    productId: shopifyProduct.id,
    productTitle: shopifyProduct.title,
    productStatus: "ACTIVE",
    inventoryItemId: defaultVariant.inventoryItem.id,
    priceCents: product.priceCents,
    inventoryQuantity: 0,
  };
}

/** Updates an existing variant's price. */
export async function updateVariantPrice(productId: string, variantId: string, priceCents: number): Promise<void> {
  const result = await shopifyGraphQL<{
    productVariantsBulkUpdate: { userErrors: { field: string[]; message: string }[] };
  }>(
    `mutation UpdateVariantPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id }
        userErrors { field message }
      }
    }`,
    { productId, variants: [{ id: variantId, price: toDollars(priceCents) }] }
  );
  if (result.productVariantsBulkUpdate.userErrors.length > 0) {
    throw new Error(`price update failed: ${result.productVariantsBulkUpdate.userErrors.map((e) => e.message).join("; ")}`);
  }
}

/**
 * Sets absolute on-hand quantity for one inventory item. `changeFromQuantity`
 * is left null deliberately — Square is the source of truth here, so we
 * don't want Shopify's compare-and-swap check rejecting the write because
 * Shopify's own count had already drifted (that drift is exactly what this
 * call is correcting).
 */
export async function setInventoryQuantity(inventoryItemId: string, quantity: number, squareVariationId: string): Promise<void> {
  const locationId = process.env.SHOPIFY_LOCATION_ID;
  if (!locationId) throw new Error("SHOPIFY_LOCATION_ID is not set");

  const result = await shopifyGraphQL<{
    inventorySetQuantities: { userErrors: { field: string[]; message: string; code: string }[] };
  }>(
    `mutation SetInventory($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) {
        inventoryAdjustmentGroup { createdAt }
        userErrors { field message code }
      }
    }`,
    {
      input: {
        name: "available",
        reason: "correction",
        referenceDocumentUri: `gid://square-shopify-sync/CatalogItemVariation/${squareVariationId}`,
        quantities: [{ inventoryItemId, locationId, quantity, changeFromQuantity: null }],
      },
    }
  );
  if (result.inventorySetQuantities.userErrors.length > 0) {
    throw new Error(`inventory set failed: ${result.inventorySetQuantities.userErrors.map((e) => e.message).join("; ")}`);
  }
}

/** Every product this sync has ever created or touched, for orphan detection (SKUs no longer in Square). */
export async function listSyncedShopifySkus(): Promise<{ sku: string; productTitle: string }[]> {
  const results: { sku: string; productTitle: string }[] = [];
  let after: string | undefined;

  do {
    const data = await shopifyGraphQL<{
      products: {
        edges: { node: { title: string; variants: { edges: { node: { sku: string | null } }[] } } }[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    }>(
      `query SyncedProducts($after: String) {
        products(first: 50, after: $after, query: "tag:${SYNC_TAG}") {
          edges { node { title variants(first: 50) { edges { node { sku } } } } }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { after }
    );

    for (const edge of data.products.edges) {
      for (const variantEdge of edge.node.variants.edges) {
        if (variantEdge.node.sku) results.push({ sku: variantEdge.node.sku, productTitle: edge.node.title });
      }
    }

    after = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor ?? undefined : undefined;
  } while (after);

  return results;
}

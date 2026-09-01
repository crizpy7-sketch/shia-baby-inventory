import type { SquareProduct } from "./types.js";

const SQUARE_VERSION = "2024-10-17";

function baseUrl(): string {
  return process.env.SQUARE_ENVIRONMENT === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
}

function headers(): HeadersInit {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN is not set");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Square-Version": SQUARE_VERSION,
  };
}

async function squareRequest<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    const message = Array.isArray(json?.errors)
      ? json.errors.map((e: { detail?: string; code?: string }) => e.detail ?? e.code).join("; ")
      : res.statusText;
    throw new Error(`Square API error (${path}): ${message}`);
  }
  return json as T;
}

interface CatalogObject {
  type: string;
  id: string;
  is_deleted?: boolean;
  item_data?: {
    name: string;
    description?: string;
    is_archived?: boolean;
    variations?: CatalogObject[];
  };
  item_variation_data?: {
    item_id: string;
    sku?: string;
    price_money?: { amount: number; currency: string };
    track_inventory?: boolean;
    sellable?: boolean;
    stockable?: boolean;
  };
}

/**
 * Every non-deleted, non-archived, sellable Square item variation that has a
 * SKU — the set of products this store actually wants reflected in Shopify.
 * Items without a SKU are skipped: SKU is the join key against Shopify, and
 * there's no reliable way to match them otherwise.
 */
export async function listSquareProducts(): Promise<SquareProduct[]> {
  const itemsById = new Map<string, CatalogObject>();
  const variations: CatalogObject[] = [];

  let cursor: string | undefined;
  do {
    const page = await squareRequest<{ objects?: CatalogObject[]; cursor?: string }>(
      "/v2/catalog/search-objects",
      {
        object_types: ["ITEM", "ITEM_VARIATION"],
        include_deleted_objects: false,
        limit: 500,
        cursor,
      }
    );
    for (const obj of page.objects ?? []) {
      if (obj.type === "ITEM") itemsById.set(obj.id, obj);
      else if (obj.type === "ITEM_VARIATION") variations.push(obj);
    }
    cursor = page.cursor;
  } while (cursor);

  const products: SquareProduct[] = [];
  for (const variation of variations) {
    const data = variation.item_variation_data;
    if (!data?.sku) continue;
    if (data.sellable === false || data.stockable === false) continue;

    const item = itemsById.get(data.item_id);
    if (!item || item.item_data?.is_archived) continue;

    products.push({
      sku: data.sku,
      itemId: item.id,
      variationId: variation.id,
      title: item.item_data?.name ?? data.sku,
      description: item.item_data?.description ?? null,
      priceCents: data.price_money?.amount ?? 0,
      trackInventory: data.track_inventory ?? true,
      inventoryCount: 0, // filled in by attachInventoryCounts
    });
  }
  return products;
}

/** Mutates each product's inventoryCount in place from a batched inventory-counts lookup. */
export async function attachInventoryCounts(products: SquareProduct[]): Promise<void> {
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!locationId) throw new Error("SQUARE_LOCATION_ID is not set");

  const trackable = products.filter((p) => p.trackInventory);
  const countByVariationId = new Map<string, number>();

  const BATCH_SIZE = 100;
  for (let i = 0; i < trackable.length; i += BATCH_SIZE) {
    const batch = trackable.slice(i, i + BATCH_SIZE);
    let cursor: string | undefined;
    do {
      const page = await squareRequest<{
        counts?: { catalog_object_id: string; quantity: string; state: string }[];
        cursor?: string;
      }>("/v2/inventory/counts/batch-retrieve", {
        catalog_object_ids: batch.map((p) => p.variationId),
        location_ids: [locationId],
        states: ["IN_STOCK"],
        cursor,
      });
      for (const count of page.counts ?? []) {
        countByVariationId.set(count.catalog_object_id, Number(count.quantity));
      }
      cursor = page.cursor;
    } while (cursor);
  }

  for (const product of products) {
    product.inventoryCount = countByVariationId.get(product.variationId) ?? 0;
  }
}

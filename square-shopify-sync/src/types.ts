/** A Square catalog item variation, flattened with its parent item's data — the canonical record synced into Shopify. */
export interface SquareProduct {
  sku: string;
  itemId: string;
  variationId: string;
  title: string;
  description: string | null;
  priceCents: number;
  trackInventory: boolean;
  inventoryCount: number;
}

export interface ShopifyVariantMatch {
  variantId: string;
  productId: string;
  productTitle: string;
  productStatus: string;
  inventoryItemId: string;
  priceCents: number;
  inventoryQuantity: number;
}

export type SyncAction =
  | { kind: "created"; sku: string; title: string }
  | { kind: "price_updated"; sku: string; from: number; to: number }
  | { kind: "inventory_updated"; sku: string; from: number; to: number }
  | { kind: "unchanged"; sku: string }
  | { kind: "orphaned_in_shopify"; sku: string; productTitle: string }
  | { kind: "error"; sku: string; message: string };

export interface SyncSummary {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  squareProductCount: number;
  actions: SyncAction[];
}

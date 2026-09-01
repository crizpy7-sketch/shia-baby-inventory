import { listSquareProducts, attachInventoryCounts } from "./square.js";
import { findVariantBySku, createProductFromSquare, updateVariantPrice, setInventoryQuantity, listSyncedShopifySkus } from "./shopify.js";
import type { SyncAction, SyncSummary } from "./types.js";

/** Runs a handful of async jobs at a time instead of all at once, to stay well under Shopify's rate limits. */
async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function runSync(options: { dryRun: boolean }): Promise<SyncSummary> {
  const startedAt = new Date().toISOString();

  const squareProducts = await listSquareProducts();
  await attachInventoryCounts(squareProducts);

  const seenSkus = new Set<string>();

  const actions = await mapWithConcurrency(squareProducts, 3, async (product): Promise<SyncAction> => {
    seenSkus.add(product.sku);
    try {
      const match = await findVariantBySku(product.sku);

      if (!match) {
        if (!options.dryRun) {
          const created = await createProductFromSquare({
            sku: product.sku,
            title: product.title,
            description: product.description,
            priceCents: product.priceCents,
          });
          if (product.trackInventory) {
            await setInventoryQuantity(created.inventoryItemId, product.inventoryCount, product.variationId);
          }
        }
        return { kind: "created", sku: product.sku, title: product.title };
      }

      const priceChanged = match.priceCents !== product.priceCents;
      const inventoryChanged = product.trackInventory && match.inventoryQuantity !== product.inventoryCount;

      if (priceChanged && !options.dryRun) {
        await updateVariantPrice(match.productId, match.variantId, product.priceCents);
      }
      if (inventoryChanged && !options.dryRun) {
        await setInventoryQuantity(match.inventoryItemId, product.inventoryCount, product.variationId);
      }

      if (priceChanged) return { kind: "price_updated", sku: product.sku, from: match.priceCents, to: product.priceCents };
      if (inventoryChanged) return { kind: "inventory_updated", sku: product.sku, from: match.inventoryQuantity, to: product.inventoryCount };
      return { kind: "unchanged", sku: product.sku };
    } catch (err) {
      return { kind: "error", sku: product.sku, message: err instanceof Error ? err.message : String(err) };
    }
  });

  // Orphan detection: a Shopify product this sync created/manages, whose SKU
  // Square no longer has (sold out and delisted, discontinued, archived,
  // etc). Logged only — never auto-archived. That's a judgment call for a
  // person, since "gone from Square" doesn't always mean "should stop
  // selling online."
  try {
    const syncedShopifySkus = await listSyncedShopifySkus();
    for (const { sku, productTitle } of syncedShopifySkus) {
      if (!seenSkus.has(sku)) {
        actions.push({ kind: "orphaned_in_shopify", sku, productTitle });
      }
    }
  } catch (err) {
    actions.push({ kind: "error", sku: "(orphan check)", message: err instanceof Error ? err.message : String(err) });
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    dryRun: options.dryRun,
    squareProductCount: squareProducts.length,
    actions,
  };
}

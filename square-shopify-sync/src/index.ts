import { writeFileSync } from "node:fs";
import { runSync } from "./sync.js";
import type { SyncAction } from "./types.js";

try {
  process.loadEnvFile?.(".env");
} catch {
  // No .env file — fine in CI, where secrets are already in the environment.
}

const dryRun = process.env.DRY_RUN === "true";

function group(actions: SyncAction[], kind: SyncAction["kind"]): SyncAction[] {
  return actions.filter((a) => a.kind === kind);
}

async function main() {
  console.log(`Square → Shopify sync starting${dryRun ? " (DRY RUN — no writes will be made)" : ""}...`);

  const summary = await runSync({ dryRun });

  const created = group(summary.actions, "created");
  const priceUpdated = group(summary.actions, "price_updated");
  const inventoryUpdated = group(summary.actions, "inventory_updated");
  const unchanged = group(summary.actions, "unchanged");
  const orphaned = group(summary.actions, "orphaned_in_shopify");
  const errors = group(summary.actions, "error");

  console.log(`\nSquare products considered: ${summary.squareProductCount}`);
  console.log(`  created in Shopify:        ${created.length}`);
  console.log(`  price updated:             ${priceUpdated.length}`);
  console.log(`  inventory updated:         ${inventoryUpdated.length}`);
  console.log(`  unchanged:                 ${unchanged.length}`);
  console.log(`  orphaned in Shopify:       ${orphaned.length}  (in Shopify, no longer in Square — review manually)`);
  console.log(`  errors:                    ${errors.length}`);

  if (created.length) console.log("\nCreated:\n" + created.map((a) => `  + ${(a as { sku: string; title: string }).sku} — ${(a as { title: string }).title}`).join("\n"));
  if (priceUpdated.length)
    console.log(
      "\nPrice updated:\n" +
        priceUpdated.map((a) => {
          const p = a as { sku: string; from: number; to: number };
          return `  ~ ${p.sku}: $${(p.from / 100).toFixed(2)} → $${(p.to / 100).toFixed(2)}`;
        }).join("\n")
    );
  if (inventoryUpdated.length)
    console.log(
      "\nInventory updated:\n" +
        inventoryUpdated.map((a) => {
          const p = a as { sku: string; from: number; to: number };
          return `  ~ ${p.sku}: ${p.from} → ${p.to}`;
        }).join("\n")
    );
  if (orphaned.length)
    console.log(
      "\nOrphaned (in Shopify, gone from Square):\n" +
        orphaned.map((a) => `  ? ${(a as { sku: string; productTitle: string }).sku} — ${(a as { productTitle: string }).productTitle}`).join("\n")
    );
  if (errors.length) console.log("\nErrors:\n" + errors.map((a) => `  ! ${(a as { sku: string; message: string }).sku}: ${(a as { message: string }).message}`).join("\n"));

  const logPath = `sync-log-${summary.startedAt.replace(/[:.]/g, "-")}.json`;
  writeFileSync(logPath, JSON.stringify(summary, null, 2));
  console.log(`\nFull log written to ${logPath}`);

  if (errors.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exitCode = 1;
});

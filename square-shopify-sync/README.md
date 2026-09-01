# Square → Shopify sync

Keeps the Shopify storefront (`shiababyboutique.com`) in sync with Square,
which is the source of truth for what's in stock and what it costs — Square
is the in-store POS at the Shia Baby location (Mercado District, McAllen TX),
Shopify is the online store.

One-directional: Square → Shopify, on a schedule. It never writes to Square.

## What it does, every run

1. Reads every active, sellable Square catalog item variation that has a
   SKU (items without one are skipped — SKU is the join key against
   Shopify), plus its current on-hand count at the Shia Baby location.
2. For each SKU:
   - **Not yet in Shopify** → creates a new product (status `ACTIVE`, vendor
     `Shia Baby`, tagged `square-import`), with that price and stock.
   - **Already in Shopify** → updates price and/or inventory only if they've
     actually drifted from Square. Nothing is touched if they already match.
   Matching is by SKU across the *entire* Shopify catalog, not just
   `square-import`-tagged products — if a manually-created Shopify product
   happens to reuse a Square SKU, this sync will update its price/stock too.
   SKUs are assumed unique across the whole business.
3. **Orphan check**: any Shopify product tagged `square-import` whose SKU no
   longer shows up in Square (discontinued, archived, deleted) is logged as
   "orphaned" — never auto-archived. Whether a sold-out or discontinued
   item should come down from the online store is a call for a person, not
   this script.
4. Writes a full JSON log (`sync-log-<timestamp>.json`) and prints a summary.

## Why one-directional

You said Square is the source of truth, so that's what this builds: Square
decides what exists, what it costs, and how much is on the shelf; Shopify
just reflects it. It does **not** currently decrement Square's stock when
something sells on Shopify — see **Known limitation** below before this
carries real traffic on both channels at once.

## Setup

### 1. Square access token

developer.squareup.com → your application → **Credentials** → generate an
access token with `ITEMS_READ` and `INVENTORY_READ` scopes. Read-only is
enough; this script never writes to Square.

### 2. Shopify custom app

Shopify Admin → Settings → Apps → **Develop apps** → create an app → API
credentials → configure Admin API scopes:
`read_products`, `write_products`, `read_inventory`, `write_inventory` →
install the app → copy the Admin API access token.

You'll also need the store's `*.myshopify.com` domain (Settings → Domains —
not the custom domain `shiababyboutique.com`).

### 3. Configure

```bash
cp .env.example .env   # fill in the two access tokens
npm install
npm run sync:dry-run   # see what it WOULD do, writes nothing
npm run sync           # do it for real
```

`SQUARE_LOCATION_ID` and `SHOPIFY_LOCATION_ID` in `.env.example` are
pre-filled with the values for the connected Shia Baby accounts at the time
this was built — double-check they're still right (Square: Locations in the
Square Dashboard; Shopify: Settings → Locations) rather than assuming.

### 4. Run it on a schedule

`.github/workflows/square-shopify-sync.yml` (at the repo root) runs this
every 30 minutes via GitHub Actions. Add these as **repository secrets**
(Settings → Secrets and variables → Actions):

- `SQUARE_ACCESS_TOKEN`
- `SQUARE_LOCATION_ID`
- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_ADMIN_ACCESS_TOKEN`
- `SHOPIFY_LOCATION_ID`

You can also trigger it on demand from the Actions tab (`workflow_dispatch`).
Every run's log is kept as a workflow artifact for 30 days.

## Known limitation: selling the same physical stock on two channels

Because this only flows Square → Shopify on a 30-minute schedule, an item
can look in-stock on Shopify for up to 30 minutes after someone buys the
last one in the store. For a single walk-in location this is a low-odds
edge case, but it's real. Two ways to close it, in order of effort:

1. **Shorter interval** — cron minimum on GitHub Actions is 5 minutes;
   tightening the schedule shrinks the window cheaply.
2. **Real-time, two-way**: a Shopify `orders/create` webhook that decrements
   the corresponding Square inventory count the moment an online sale
   happens, so the shelf (and Square) reflect it immediately rather than
   waiting for the next scheduled run. Square stays authoritative for
   catalog data (name, price, what exists) either way — this would just
   make stock consumption events flow both directions in real time. Not
   built yet; ask if you want it.

## Repo context

This replaces the earlier plan to build a full custom Supabase/Stripe
checkout engine (`store/` in this repo) as the storefront backend — since
Shopify already *is* the live online store, `store/` is no longer the active
plan. It's left in place rather than deleted in case it's useful later, but
this sync engine is where ongoing backend work should go.

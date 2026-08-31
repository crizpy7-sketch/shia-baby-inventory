# Shia Baby — Store Backend

A headless e-commerce backend for Shia Baby: catalog, cart, checkout,
orders, inventory, discounts, gift cards, and the pre-launch Founding
Families waitlist. Built as Next.js API routes (App Router) against
Supabase (Postgres), with Stripe for payment.

This app has **no storefront UI** — that's being built separately (see
`BRAND.md` for the indigo/cream brand tokens it should use). This repo just
needs to serve a correct, secure API for it to call, same-origin or cross-origin.

## Tech stack

| Layer            | Choice                                      |
|-------------------|----------------------------------------------|
| Framework         | Next.js 15 (App Router, Route Handlers, TS)  |
| Database / Auth   | Supabase (Postgres, Supabase Auth)           |
| Payments          | Stripe Checkout + webhooks                   |
| Email             | Resend (gracefully skipped if unconfigured)  |
| Validation        | Zod, on every request body                   |

## Security model

Every table has Row Level Security **enabled with zero policies** — the
anon and authenticated Supabase keys can read or write nothing directly.
All data access goes through the service-role key (`lib/supabase/admin.ts`)
inside API route handlers, after whatever app-level check that route
requires:

- **Public catalog/cart/checkout routes** — no auth, but every input is
  Zod-validated and every price is computed server-side from the database.
  The client never gets to submit a price, a discount amount, or a total.
- **Admin routes** (`/api/admin/*`) — require a Supabase Auth session
  *and* that user's id present in the `admin_users` allow-list
  (`lib/auth.ts#getAdminUser`). Add an admin via SQL after creating their
  Supabase Auth user:
  ```sql
  insert into admin_users (user_id) values ('<the-user-uuid>');
  ```
- **Order lookup** (`/api/orders/:token`) — no login; the 32-hex-char
  token is unguessable and is the access control, same pattern as the
  Reveal Atelier app.
- **Stripe webhook** — signature-verified against `STRIPE_WEBHOOK_SECRET`
  before anything else happens.

## The pricing/checkout flow, and why it's structured this way

1. A cart's totals (`lib/pricing.ts#computeOrderTotals`) are always
   recomputed from the database — current variant prices, current
   inventory, current discount/gift-card validity. Nothing is cached from
   an earlier request.
2. `POST /api/checkout` recomputes totals one last time, freezes them into
   `carts.checkout_snapshot`, and either:
   - creates the order immediately if a gift card covers the total
     (`totalCents === 0`), or
   - creates a Stripe Checkout Session priced from that snapshot.
3. The **Stripe webhook** (`checkout.session.completed`) is the only place
   a paid order is actually created. It calls the `create_order_from_snapshot`
   Postgres function (see the migration), which — in one atomic transaction —
   inserts the order + order_items, decrements inventory (raising, and
   rolling back the whole thing, if stock is now insufficient), redeems the
   discount/gift card, and records the payment. This avoids the classic
   race where two customers both "successfully" buy the last unit.
4. The webhook is idempotent: Stripe redelivering the same
   `checkout.session.completed` event is a no-op (checked via
   `stripe_checkout_session_id`).

## Project structure

```
store/
├── supabase/migrations/0001_init.sql   # Full schema, RLS, the atomic order-fulfillment function
├── BRAND.md                            # Indigo/cream brand tokens (source of truth for design)
├── src/
│   ├── types/database.ts               # Hand-written Supabase types (regenerate once linked)
│   ├── lib/
│   │   ├── supabase/{admin,server,client}.ts
│   │   ├── auth.ts        # getAdminUser() — allow-list check
│   │   ├── api.ts         # json()/errorJson()/CORS/requireAdmin() helpers used by every route
│   │   ├── pricing.ts     # computeOrderTotals() — the one place prices get calculated
│   │   ├── cart.ts        # loadCartWithTotals() / buildCheckoutSnapshot()
│   │   ├── validation.ts  # Zod schemas for every request body
│   │   ├── stripe.ts      # Stripe client
│   │   ├── email.ts       # Order confirmation / waitlist emails (Resend)
│   │   └── brand.ts       # Brand color tokens as TS constants
│   └── app/
│       ├── page.tsx, layout.tsx, globals.css   # Placeholder shell only
│       └── api/
│           ├── products/                 # GET list, GET [handle]
│           ├── collections/               # GET list, GET [handle]
│           ├── waitlist/                  # POST — Founding Families signup
│           ├── cart/                      # POST create; [id] GET/PATCH; [id]/items POST; [id]/items/[itemId] PATCH/DELETE
│           ├── checkout/                  # POST — creates Stripe session or a $0 gift-card order
│           ├── webhooks/stripe/           # POST — fulfills paid orders
│           ├── orders/[token]/            # GET — public order status lookup
│           └── admin/
│               ├── products/, products/[id]/
│               ├── collections/, collections/[id]/
│               ├── orders/, orders/[id]/          # list/detail, PATCH status
│               ├── inventory/                      # GET stock overview, POST adjust
│               ├── discounts/, discounts/[id]/
│               ├── gift-cards/                      # POST issue
│               └── waitlist/                        # GET export signups
```

## Setup

### 1. Supabase

1. Create a project at supabase.com.
2. Open **SQL Editor**, paste `supabase/migrations/0001_init.sql`, run it.
   This creates every table, the storage bucket for product images, RLS
   (enabled, no policies), and the `create_order_from_snapshot` function.
3. Create your admin login under **Authentication → Users → Add user**.
4. Add that user to the allow-list (SQL Editor):
   ```sql
   insert into admin_users (user_id) values ('<the-user-uuid>');
   ```

### 2. Stripe

1. Grab your secret key → `STRIPE_SECRET_KEY`.
2. Local dev webhook:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   Copy the printed `whsec_…` → `STRIPE_WEBHOOK_SECRET`.
3. Production: Dashboard → Developers → Webhooks → add endpoint
   `https://yourdomain.com/api/webhooks/stripe`, event
   `checkout.session.completed`; use that endpoint's signing secret.

Prices are set dynamically per line item (`price_data`) at checkout time —
no Stripe Product/Price catalog to keep in sync separately.

### 3. Resend (optional)

`RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`. If unset,
emails are logged to the console and skipped — the app still works.

### 4. Run it

```bash
cp .env.example .env.local   # fill in every value
npm install
npm run dev
```

Then, from a separate terminal, `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
if you're testing checkout end-to-end.

## Populating the catalog

There's no admin UI yet (that's frontend work), so seed products via the
admin API once you have an admin session cookie (sign in through
`@/lib/supabase/client.ts`'s browser client from any small script/page, or
`curl` with a session cookie copied from the browser):

```bash
curl -X POST http://localhost:3000/api/admin/products \
  -H "Content-Type: application/json" \
  -H "Cookie: <your supabase auth cookies>" \
  -d '{
    "handle": "heirloom-knit-blanket-powder-blue",
    "name": "Heirloom Knit Blanket — Powder Blue",
    "status": "active",
    "priceCents": 6800,
    "giftReady": true,
    "images": ["https://<project>.supabase.co/storage/v1/object/public/product-images/blanket-1.jpg"],
    "variants": [{ "sku": "SB-BLK-PB-01", "inventoryCount": 40 }]
  }'
```

## Known limitations / roadmap

- **Tax** is a single flat `TAX_RATE` env var applied to the whole order —
  fine for a single-jurisdiction estimate, not real multi-state
  compliance. Wire up Stripe Tax or TaxJar before relying on it.
- **No customer accounts/login** — checkout is guest-only, with order
  status tracked by the unguessable token. Add Supabase Auth customer
  accounts later if repeat-customer features (saved addresses, order
  history in one place) are wanted.
- **No reviews** — deliberately out of scope for this pass; add a
  `reviews` table + routes when it's actually needed.
- **Product images** upload via the `product-images` Supabase Storage
  bucket (public read, already created by the migration) — there's no
  admin upload endpoint yet, so images are referenced by URL for now.

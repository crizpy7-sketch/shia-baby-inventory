# Shia Baby — Storefront

The customer-facing storefront: home, shop/browse, and product detail pages,
with a full cart and (once configured) real Shopify checkout. Plain HTML5 +
JS (ES modules, no framework, no build step) — open any `.html` file behind
a static server and it runs.

**This build is split deliberately into two layers** so a design tool or
designer agent can take over the visual side without touching behavior:

- **Structure & behavior (this is what I built):** semantic HTML, the data
  layer, cart logic, search, filtering, variant selection, animations,
  accessibility. Lives in `js/` and the HTML files' structure/markup.
- **Visual design (yours to take over):** every color, font, spacing value,
  radius, shadow, and timing is a CSS custom property in `css/tokens.css`.
  `css/app.css` consumes those tokens for layout and component structure
  but should rarely need edits itself — restyling should mean editing
  `tokens.css`, not hunting through selectors.

## For the designer / design agent

1. **Start here:** `css/tokens.css`. Every design decision — palette,
   typography, spacing scale, radii, shadows, motion timing — is a variable
   there. Current values are a functional placeholder (the indigo/cream
   brand already used elsewhere in this repo — see `/BRAND.md`), not a
   finished direction. Change them; everything downstream updates.
2. **The three pages** (`index.html`, `shop.html`, `product.html`) are
   plain semantic HTML with classes like `.hero`, `.product-card`,
   `.cart-drawer`. Restyle freely in `css/app.css` — just don't rename or
   remove the `data-*` attributes (see below), those are load-bearing.
3. **Fonts/imagery:** swap the Google Fonts (or self-hosted) link in each
   HTML `<head>` and the hero/placeholder image URLs. Product photography
   itself comes from the data source (Shopify or the mock JSON), not
   hardcoded in HTML.
4. **Everything is already populated with real content** — see "Preview
   without credentials" below — so you're styling a fully working page, not
   an empty shell.
5. **`data-*` attributes are the contract with the JS.** Every interactive
   element the JS reads or writes is targeted by a `data-*` attribute, never
   by class name — so classes are entirely free to rename/restructure for
   styling. Don't remove or rename a `data-*` attribute unless you also
   update the corresponding line in `js/`. The full list is at the bottom
   of this file.

## Preview without credentials

Open the site through any static server (fetching local JSON needs http://,
not file://):

```bash
cd storefront
python3 -m http.server 8080   # or: npx serve
```

Then visit `http://localhost:8080`. With no Storefront API token configured
(the default), the whole site runs on `data/products.sample.json` — 10 real
products pulled from the live Shia Baby Shopify store during development,
with working prices, images, sizes, and stock levels. Cart, search, filters,
variant selection, and checkout all function against this data; only the
final "Checkout" button is a preview message instead of a real Shopify
redirect (see below).

## Going live

Set `window.__STOREFRONT_CONFIG__` in each HTML file's `<head>`:

```html
<script>
  window.__STOREFRONT_CONFIG__ = {
    domain: 'your-store.myshopify.com',
    token: 'shpat_...',
  };
</script>
```

Get the token: Shopify Admin → Settings → Apps → Develop apps → (the app
created for `square-shopify-sync/`, or a new one) → Storefront API → scopes
`unauthenticated_read_product_listings`, `unauthenticated_read_product_inventory`,
`unauthenticated_write_checkouts` (or the cart read/write scopes on newer
API versions). This token is safe to ship client-side — it's the public,
storefront-scoped one, unlike the Admin token `square-shopify-sync` uses.

Once set, every page switches from the mock catalog to live Shopify data
automatically (`js/config.js` / `js/data.js` — nothing else needs to
change), and the cart drawer's checkout button becomes a real Shopify
checkout redirect using the cart's `checkoutUrl`.

Collections referenced in the UI (`girl`, `boy`, `gifts`, `new-arrivals`)
are matched by product tag on Shopify's side. Tag products accordingly, or
create matching real Shopify Collections and adjust the `collectionHandle`
filter in `js/data.js`'s `listProducts` to query by collection instead of
tag if you'd rather manage them there.

## Architecture

```
storefront/
├── index.html / shop.html / product.html   Semantic pages, data-* hooks, no inline logic
├── css/
│   ├── tokens.css        Design tokens — THE file to restyle
│   └── app.css           Structural/component CSS, consumes tokens.css only
├── js/
│   ├── config.js         Live vs. mock mode switch
│   ├── data.js            Shopify Storefront API client + mock loader, one repository interface either way
│   ├── cart-store.js      Cart state (add/update/remove), localStorage persistence, live Shopify Cart API in live mode
│   ├── cart-ui.js         Cart drawer rendering + focus-trapped open/close
│   ├── nav.js              Mobile menu, sticky/hide-on-scroll header, search overlay with live results
│   ├── product-card.js     Shared product-card markup (home + shop grids)
│   ├── motion.js            Scroll-reveal (IntersectionObserver) + prefers-reduced-motion handling
│   ├── announcement.js       Rotating announcement bar
│   ├── newsletter.js          Footer signup (client-side confirmation; wire WAITLIST_ENDPOINT to persist real signups)
│   ├── utils.js                 qs/on/debounce/formatMoney/focus-trap/aria-announce helpers
│   ├── home.js / shop.js / product.js   Per-page entry points, each composing the modules above
└── data/products.sample.json   Real product fixture (see note in the file)
```

**Data layer:** `js/data.js` exposes one interface — `listProducts()`,
`getProduct()`, `listCollections()` — regardless of whether it's backed by
the mock JSON or live Shopify. No other module knows or cares which.

**Cart:** `js/cart-store.js` is the single source of truth, with a pub/sub
(`subscribeCart`) that `cart-ui.js` and the header badge react to. In mock
mode it's pure client-side state persisted to `localStorage`. In live mode
every mutation calls Shopify's real Cart API (`cartCreate`/`cartLinesAdd`/
etc. — all four operations validated against the live Admin schema before
being written), so `checkoutUrl` is a genuine working Shopify checkout link,
not a placeholder.

**Correctness note (already fixed once, worth knowing about):** the sticky
mobile add-to-cart bar (`product.js#initStickyAddToCart`) deliberately does
NOT use a plain "is the button visible" `IntersectionObserver` toggle — that
reads as symmetric in both scroll directions, so it fires as soon as the
page loads (button starts below the fold, reads as "not visible", bar pops
up before the visitor has scrolled at all) and gets stuck open near the top
of the page on the way back up. It's implemented instead as a directional
check — `getBoundingClientRect().bottom < 0`, i.e. specifically "scrolled
past it, downward" — verified with real incremental scroll simulation in
both directions, not just a single before/after screenshot.

## UX features (the part I owned)

- Instant client-side filtering/sorting/search on the shop page, state
  synced to the URL (`?collection=&sort=&q=`) via `history.pushState` so
  filters are shareable and the back button restores prior state.
- Debounced live search overlay with keyboard (↑/↓/Enter) navigation and a
  `/` keyboard shortcut to open it.
- Optimistic cart updates, a free-shipping progress bar ($75 threshold,
  matching the rest of this repo), and a bump animation on the cart badge.
- Variant selection with per-value availability (out-of-stock combinations
  shown struck-through and disabled, not just omitted).
- Sticky mobile add-to-cart bar (see correctness note above).
- Native cross-document View Transitions between pages (`@view-transition`
  in `app.css`) — Chromium cross-fades navigations automatically; every
  other browser just navigates normally. No JS, no dependency, pure
  progressive enhancement.
- Full keyboard/screen-reader support: skip-to-content link, focus-trapped
  cart drawer/mobile menu/search overlay (Tab cycles within, Escape closes,
  focus returns to the trigger), `aria-live` announcements on cart changes,
  `prefers-reduced-motion` respected everywhere animation happens.
- Real inventory awareness: quick-add and add-to-cart both respect live
  stock counts (won't let you add more than what's available), and
  distinguish "sold out" from "only N left."
- The Reveal Atelier — the gender reveal keepsake-box service, carried over
  from `advertise.html` and given a proper home-page section (`js/reveal-
  atelier.js`) with a booking inquiry form, degrading to a client-side
  confirmation the same honest way the newsletter signup does until a real
  booking endpoint is wired up.

## `data-*` attribute reference

| Attribute | Meaning |
|---|---|
| `data-site-header` | Header — sticky/hide-on-scroll behavior target |
| `data-menu-toggle` / `data-menu-close` / `data-mobile-menu` | Mobile menu |
| `data-search-toggle` / `data-search-close` / `data-search-overlay` / `data-search-input` / `data-search-results` / `data-search-empty` | Search overlay |
| `data-open-cart` / `data-cart-close` / `data-cart-drawer` / `data-overlay` | Cart drawer open/close |
| `data-cart-count` | Header cart item-count badge |
| `data-cart-items` / `data-cart-empty` / `data-cart-footer` / `data-cart-subtotal` | Cart drawer contents |
| `data-shipping-fill` / `data-shipping-message` | Free-shipping progress bar |
| `data-checkout` | Checkout button |
| `data-featured-grid` | Home page product grid |
| `data-shop-grid` / `data-shop-empty` / `data-shop-count` / `data-shop-search` / `data-sort-select` / `data-collection-chips` / `data-collection` | Shop page |
| `data-quick-add` | Quick-add button on a product card (value = product handle) |
| `data-product-page` / `data-product-not-found` | Product page state |
| `data-gallery-main` / `data-gallery-thumbs` / `data-thumb` | Product gallery |
| `data-product-options` / `data-option-name` / `data-option-value` | Variant selectors |
| `data-product-title` / `data-product-price` / `data-product-availability` / `data-product-description` / `data-product-vendor` | Product info fields |
| `data-quantity-input` / `data-quantity-decrease` / `data-quantity-increase` | Quantity stepper |
| `data-add-to-cart` / `data-sticky-add` / `data-add-to-cart-sticky` | Add to cart |
| `data-related-grid` / `data-related-section` | Related products |
| `data-newsletter-form` | Footer signup |
| `data-reveal-booking-form` | Reveal Atelier (gender reveal service) booking inquiry form, home page only |
| `data-announcement-text` | Rotating announcement bar |
| `.reveal` | Fades/rises in once scrolled into view (`initScrollReveal`) |
| `.reveal-load` (+ optional `--reveal-delay`) | Fades/rises in immediately on page load, staggered — for above-the-fold content a scroll observer would never trigger (hero, product gallery) (`initLoadReveal`) |

## Testing notes

Verified end-to-end with headless Chromium (Playwright) against the mock
catalog: featured/shop grids render and quick-add works; search returns and
navigates correctly; collection filtering + sorting update the URL and the
back button restores prior state; variant selection updates price/
availability; add-to-cart updates the drawer and persists across a reload;
mobile menu and search overlay open/close with focus trapped; the sticky
add-to-cart bar was specifically re-verified with real incremental scroll
simulation in both directions after the fix described above (a first pass
using instant/synthetic scroll jumps had validated the wrong thing). Not
yet tested against a live Shopify Storefront API token — do that once one
is configured.

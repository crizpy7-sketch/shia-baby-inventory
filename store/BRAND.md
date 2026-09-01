# Shia Baby — Brand Tokens

Single source of truth for the site's color system: **indigo + cream**.
These match the palette already used in `index.html` (the Square inventory
tool) at the repo root, so every surface — storefront, emails, admin — stays
consistent. The frontend agent should treat this file (and
`src/lib/brand.ts`, its code-usable counterpart) as canonical rather than
inventing new values.

| Token       | Hex       | Use                                          |
|-------------|-----------|-----------------------------------------------|
| `indigo`    | `#24345f` | Primary brand color — headings, buttons, nav  |
| `indigoDark`| `#334a7c` | Hover/active states, gradients                |
| `cream`     | `#f7f1e8` | Page background                               |
| `paper`     | `#fffdf9` | Card/panel surfaces                           |
| `gold`      | `#b89b68` | Accent — badges, dividers, highlights          |
| `green`     | `#364f45` | Secondary accent (success, "in stock")        |
| `ink`       | `#1e2430` | Body text                                     |
| `muted`     | `#6d7280` | Secondary text                                |
| `line`      | `#ded8cf` | Borders, dividers                             |
| `danger`    | `#a53232` | Errors, destructive actions                   |
| `ok`        | `#2c6d50` | Success states                                |
| `warn`      | `#a76b17` | Warnings, low-stock badges                    |

Typeface pairing used elsewhere on the brand: Georgia/serif for display
headings, a clean sans-serif (Inter or system UI) for body and UI text.

These values are exported as plain TypeScript constants from
`src/lib/brand.ts` so backend code (order confirmation emails) and any
frontend code in this repo can import the same tokens instead of
hardcoding hex values.

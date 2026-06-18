# Merch Shop

The shop sells Battle of the Tech Bands merchandise via **Stripe Checkout**
(direct, no Shopify). It currently sells one product: the **2026 Battle of the
Tech Bands T-Shirt** (AS Colour, Charcoal).

It is **soft-launched / hidden**: reachable at `/shop` but not linked in nav,
marked `noindex`, excluded from the sitemap, and disallowed in `robots.txt`.

## Product & pricing

- **Sizes:** S, M, L, XL, XXL, XXXL.
- **Price:** A$40 each, **A$35 each when the order totals 2+ shirts** (volume
  discount applies across mixed sizes — e.g. 1×M + 1×L = 2 shirts → $35 each).
- **Shipping:** flat **A$10**, **Australia only**.
- **Multi-size orders:** customers can buy several sizes in one order (per-size
  quantity steppers); max **20** shirts per order.
- Unit price is computed in code (`unitPriceCents` in `src/lib/shop/config.ts`)
  and charged via Stripe **`price_data`** (dynamic) against the catalog product
  — single source of truth, so the displayed price can't drift from the charge.

## Architecture

- **Storefront:** `src/app/shop/page.tsx` + `shop-client.tsx` (client). Success:
  `src/app/shop/success/`, cancel: `src/app/shop/cancel/`.
- **Checkout:** `POST /api/shop/checkout` creates a Checkout Session (one line
  item priced at the volume unit price, qty = total; AU-only shipping address;
  per-size breakdown in `metadata.items`).
- **Webhook:** `POST /api/webhooks/stripe` (signature-verified) handles
  `checkout.session.completed` → upserts the order (idempotent on
  `stripe_session_id`) → emails. Email sends are gated on per-order timestamps
  so retries never double-send.
- **Orders:** `merch_orders` table (`src/lib/db/orders.ts`); per-size breakdown
  in the `items` jsonb column.
- **Emails (Resend):** fulfillment notice → `info@bottb.com`; customer
  **Invoice**. Templates in `src/lib/shop/emails/`. The Resend wrapper no-ops
  (logs) if `RESEND_API_KEY` is unset, so orders still record before email is
  configured.

## Invoice / seller

Issued by **BOTB Events Ltd**, **ABN 19 691 201 153**, contact `info@bottb.com`.
The company is **not registered for GST**, so the document is titled
**"Invoice"** (never "Tax Invoice") and carries **no GST line**.

## Environment variables

| Var                                  | Scope  | Purpose                                    |
| ------------------------------------ | ------ | ------------------------------------------ |
| `STRIPE_SECRET_KEY`                  | server | Stripe API                                 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | client | test-mode banner / future client use       |
| `STRIPE_TSHIRT_PRODUCT_ID`           | server | catalog product referenced by `price_data` |
| `STRIPE_WEBHOOK_SECRET`              | server | verify webhook signatures                  |
| `RESEND_API_KEY`                     | server | transactional email                        |
| `SHOP_EMAIL_FROM`                    | server | from-address (`orders@send.bottb.com`)     |

All live in Vercel project env + local `.env.local` (gitignored). Server vars
are read at runtime, but **changing any env var requires a redeploy** to take
effect (and `NEXT_PUBLIC_*` is inlined at build time).

## Going live (switch from test mode to real payments)

Currently everything runs on **Stripe test keys** so colleagues can test with
`4242 4242 4242 4242`. To take real money:

- [ ] **Stripe account activation** — complete KYC + add a bank account for
      payouts (live mode).
- [ ] **Create the product in LIVE mode** — products are per-mode; the test
      product doesn't exist in live. Create "2026 Battle of the Tech Bands
      T-Shirt" in live and note its `prod_…` id. (No Price object needed — we
      use dynamic `price_data`.)
- [ ] **Swap the Stripe env vars in Vercel (Production)** to live values:
  - `STRIPE_SECRET_KEY` → `sk_live_…`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_…`
  - `STRIPE_TSHIRT_PRODUCT_ID` → the **live** product id
- [ ] **Create a LIVE webhook endpoint** in Stripe → URL
      `https://www.battleofthetechbands.com/api/webhooks/stripe`, event
      `checkout.session.completed` → set `STRIPE_WEBHOOK_SECRET` (live `whsec_…`)
      in Vercel.
- [ ] **Redeploy** so the env changes (esp. the build-time `NEXT_PUBLIC_` key)
      take effect.
- [ ] **Resend** — no change; `send.bottb.com` is already verified and live.
- [ ] **Smoke test in live** — make one real purchase, confirm the order records
      in `merch_orders` and both emails arrive, then **refund** it in Stripe.
- [ ] **(Optional) Un-hide the shop** — to launch publicly: add a nav/footer
      link, remove `robots: { index:false }` on the shop pages, drop `/shop`
      from `robots.txt` disallow, and add `/shop` to the sitemap. Keep hidden
      for a soft launch.
- [ ] The storefront's "test mode" banner auto-hides once the publishable key is
      `pk_live_…` (no code change needed).

Notes:

- The **test** Stripe product (`prod_UiyXm8bJuIpKar`) and **test** webhook
  endpoint (`we_1TjXbdHoBk1FHksXvxcGKk7L`) are test-mode only; live needs its own.
- No inventory/stock control yet — ensure supply or add stock limits before a
  big push.

## Future enhancements

- **Admin orders page** (`/admin/orders`) — list + mark-fulfilled. DB helpers
  already exist (`getMerchOrders`, `markOrderFulfilled`).
- **Australia Post Shipping API** — auto-generate 250g parcel labels + tracking
  on fulfillment (needs an approved AusPost merchant API account).
- **Inventory / per-size stock** so sizes can sell out.

# Raneems

A mobile-first dashboard for managing product batches and orders sold to
retailers over WhatsApp — replacing manually created Paystack payment links.

The dashboard (batches, products, orders, auth, and product-image uploads)
is backed by **Supabase** (Postgres + Auth + Storage). Payments are still
mocked pending a real Paystack integration (see below).

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4
- [lucide-react](https://lucide.dev) for icons
- [Supabase](https://supabase.com) — Postgres database, Auth, and Storage
  (`@supabase/supabase-js` + `@supabase/ssr`)

## Running locally

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase values
npm run dev
```

Visit `http://localhost:3000`.

### 1. Configure Supabase

Copy `.env.example` to `.env.local` and set both values from your Supabase
project (Project Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-or-publishable-key
```

Also set the server-only keys (never `NEXT_PUBLIC_`):

```
SUPABASE_SERVICE_ROLE_KEY=...      # Project Settings → API → service_role
PAYSTACK_SECRET_KEY=sk_test_...    # Paystack → Settings → API Keys & Webhooks
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 2. Create the schema

Two ways to apply [`supabase/schema.sql`](supabase/schema.sql):

- **From the terminal** — add `SUPABASE_DB_URL` to `.env.local` (Project
  Settings → Database → Connection string → URI), then run:

  ```bash
  npm run db:push
  ```

  The schema is idempotent, so it's safe to re-run.

- **Or in the dashboard** — paste the file into the Supabase SQL editor and run it.

It creates the `batches`, `products`, and `orders` tables, Row Level Security
policies, an order-reference sequence/trigger, payment-reference columns, and
the `product-images` Storage bucket.

### 3. Create a login

Auth is real Supabase email/password. Add a user under Authentication →
Users in the dashboard, then sign in with those credentials.

### 4. Configure the Paystack webhook

Payments are confirmed by a signed webhook. In the Paystack dashboard
(Settings → API Keys & Webhooks), set the webhook URL to:

```
https://your-domain.com/api/paystack/webhook
```

For local testing, expose your dev server with a tunnel (e.g. `ngrok http
3000` or `cloudflared`) and point the Paystack webhook at the tunnel URL
+ `/api/paystack/webhook`.

## How the data layer is wired

Every read/write the UI does goes through a named function in
**[`lib/api.ts`](lib/api.ts)** — nothing else touches Supabase directly.
Each function maps the snake_case DB rows to the camelCase shapes in
**[`lib/types.ts`](lib/types.ts)**, so the components stay unchanged.

- **Browser client** — [`lib/supabase/client.ts`](lib/supabase/client.ts),
  used by the client-side dashboard UI.
- **Server client** — [`lib/supabase/server.ts`](lib/supabase/server.ts),
  for any future Server Components / Route Handlers.
- **Session refresh** — [`proxy.ts`](proxy.ts) (Next.js 16 renamed
  `middleware` to `proxy`) refreshes the auth cookie on each request.
- **Auth state** — [`lib/auth-context.tsx`](lib/auth-context.tsx) exposes
  `useAuth()`; the route guards await it instead of a synchronous flag.

### Payments (Paystack)

Payments are real Paystack transactions, handled by server-side Route
Handlers so the secret key never touches the browser:

- **Initialize** — [`app/api/payments/initialize/route.ts`](app/api/payments/initialize/route.ts)
  creates a Paystack transaction (item or shipping) and returns the hosted
  checkout URL. The public checkout redirects the customer there; the owner
  sends the shipping link over WhatsApp.
- **Callback** — [`app/api/payments/callback/route.ts`](app/api/payments/callback/route.ts)
  is where Paystack sends the customer back. It verifies the transaction and
  redirects to `/payment/success`.
- **Webhook** — [`app/api/paystack/webhook/route.ts`](app/api/paystack/webhook/route.ts)
  is the authoritative confirmation. It verifies the `x-paystack-signature`
  (HMAC-SHA512 over the raw body) and marks the order paid. Both the callback
  and webhook are idempotent, so a payment is never applied twice.

Once the item payment succeeds the order moves to `awaiting_shipping_payment`;
once shipping is paid it becomes `ready_to_dispatch`.

### Real and functional

- **Auth, batches, products, orders, image upload** — all backed by Supabase.
- **Payments** — real Paystack (see above).
- **WhatsApp send** — a `wa.me` deep link built client-side
  (`lib/format.ts#buildWhatsAppLink`), no backend needed.

## Pages

| Route | Purpose |
| --- | --- |
| `/login` | Mock auth |
| `/dashboard` | Home — quick stats + shortcuts |
| `/batches` | List batches, create new ones |
| `/batches/[id]` | Products in a batch, copy public link, live preview |
| `/batches/[id]/new-product` | Add product form (dynamic attributes, mock image upload) |
| `/orders` | All orders, filterable |
| `/orders/[id]` | Order detail — shipping cost, shipment link, WhatsApp send, dispatch controls |
| `/dispatch` | Ready-to-dispatch driver hand-off list, print-friendly |
| `/p/[slug]` | Public, no-login product/catalogue page with mock checkout |

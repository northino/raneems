# Raneems

A mobile-first dashboard for managing product batches and orders sold to
retailers over WhatsApp — replacing manually created Paystack payment links.

This is a **frontend-only build**. There is no real backend, database, or
Paystack integration. All data is mock/local and resets are avoidable only
because it's persisted to `localStorage` (clear site data / a private
window resets the demo).

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4
- [lucide-react](https://lucide.dev) for icons

## Running locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`. Login is a mock form — any email/password
combination works.

## How this is wired for a real backend

Every read/write the UI does goes through a named function in
**[`lib/api.ts`](lib/api.ts)** — nothing else touches storage directly.
Each function is documented with a `TODO: replace with ...` comment
describing the real endpoint it should call. To connect a real backend:

1. Implement the endpoints described in the `TODO` comments.
2. Replace each function body in `lib/api.ts` with a `fetch` (or API
   client) call returning the same shape.
3. Delete `lib/storage.ts` and `lib/mock-data.ts` — nothing outside
   `lib/api.ts` imports them.

Data shapes live in **[`lib/types.ts`](lib/types.ts)** and match the
backend contract as specified — use them as-is.

### Notable mock/demo-only pieces

- **Auth** — `lib/api.ts#login` just sets a `localStorage` flag. No real
  session/token handling.
- **Image upload** — the Add Product form previews the file locally via
  `FileReader` (`app/(dashboard)/batches/[id]/new-product/page.tsx`)
  instead of uploading anywhere.
- **Payments** — `initiateItemPayment` / `confirmMockItemPayment` and
  `generateShipmentLink` simulate a Paystack redirect + webhook with a
  timer. A real backend replaces these with actual Paystack calls and
  webhook handling.
- **"Mark shipping payment as received (demo)"** button on the Order
  Detail page stands in for the Paystack webhook that would normally
  confirm the shipping payment automatically — it's clearly labelled and
  should be removed once real webhook handling exists.
- **WhatsApp send** is real and functional — it's just a `wa.me` deep
  link built client-side (`lib/format.ts#buildWhatsAppLink`), no backend
  needed.

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

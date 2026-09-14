-- ---------------------------------------------------------------------------
-- Raneems — Supabase schema
-- ---------------------------------------------------------------------------
-- Run this in the Supabase SQL editor (or via the CLI) to create the tables,
-- storage bucket, and Row Level Security policies the dashboard expects.
--
-- Column names are snake_case (Postgres convention). lib/api.ts maps them to
-- the camelCase shapes in lib/types.ts. Money is stored in whole Naira as
-- integers (the UI already treats prices/amounts as plain numbers).
--
-- Access model for this first pass:
--   * batches / products / orders are readable+writable by any AUTHENTICATED
--     user (the shop owner logs in). This mirrors the current single-owner app.
--   * products and orders are ALSO readable by anonymous visitors so the
--     public catalogue (/p/[slug]) and public checkout can work without login
--   * anonymous visitors may INSERT an order (public "Pay Now" flow).
-- Tighten these later (e.g. per-owner ownership) once multi-tenant is needed.
-- ---------------------------------------------------------------------------

-- Extensions ----------------------------------------------------------------
create extension if not exists "pgcrypto";

-- Enums ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'batch_status') then
    create type batch_status as enum ('open', 'closed');
  end if;
  if not exists (select 1 from pg_type where typname = 'dispatch_status') then
    create type dispatch_status as enum (
      'awaiting_item_payment',
      'awaiting_shipping_payment',
      'ready_to_dispatch',
      'dispatched',
      'delivered'
    );
  end if;
end$$;

-- Batches -------------------------------------------------------------------
create table if not exists public.batches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  status      batch_status not null default 'open',
  created_at  timestamptz not null default now()
);

-- Products ------------------------------------------------------------------
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid not null references public.batches(id) on delete cascade,
  name         text not null,
  description  text not null default '',
  attributes   jsonb not null default '[]'::jsonb, -- [{ label, value }]
  price        integer not null default 0,          -- whole Naira
  image_url    text not null default '',
  public_slug  text not null unique,
  created_at   timestamptz not null default now()
);
create index if not exists products_batch_id_idx on public.products(batch_id);
create index if not exists products_public_slug_idx on public.products(public_slug);

-- Orders --------------------------------------------------------------------
-- itemPayment / shippingPayment from the type are flattened into columns and
-- reassembled into nested objects by lib/api.ts.
create table if not exists public.orders (
  id                    uuid primary key default gen_random_uuid(),
  order_reference       text not null unique,
  batch_id              uuid references public.batches(id) on delete set null,
  product_id            uuid references public.products(id) on delete set null,
  product_name          text not null,
  quantity              integer not null default 1,
  customer_name         text not null,
  customer_phone        text not null,
  customer_email        text not null,
  delivery_address      text not null,

  item_paid             boolean not null default false,
  item_amount           integer,
  item_paid_at          timestamptz,
  item_payment_reference   text,  -- provider transaction reference / orderNo (item)
  item_platform_fee     integer, -- platform commission on the item payment (₦)
  item_merchant_amount  integer, -- merchant subaccount share of the item payment (₦)
  item_provider         text,    -- 'paystack' | 'paystack_dva' | 'gafiapay' (item)
  item_gafia_account    text,    -- GafiaPay virtual account number (item)
  item_gafia_bank       text,    -- GafiaPay virtual account bank name (item)
  item_dva_account      text,    -- Paystack DVA account number (item)
  item_dva_bank         text,    -- Paystack DVA bank name (item)
  paystack_customer_code text,   -- Paystack customer_code (for DVA reuse)

  shipping_paid         boolean not null default false,
  shipping_amount       integer,
  shipping_paid_at      timestamptz,
  shipping_payment_reference text, -- provider transaction reference / orderNo (shipping)
  shipping_platform_fee integer, -- platform commission on the shipping payment (₦)
  shipping_merchant_amount integer, -- merchant subaccount share of the shipping payment (₦)
  shipping_provider     text,    -- 'paystack' | 'paystack_dva' | 'gafiapay' (shipping)
  shipping_gafia_account text,   -- GafiaPay virtual account number (shipping)
  shipping_gafia_bank   text,    -- GafiaPay virtual account bank name (shipping)
  shipping_dva_account  text,    -- Paystack DVA account number (shipping)
  shipping_dva_bank     text,    -- Paystack DVA bank name (shipping)

  dispatch_status       dispatch_status not null default 'awaiting_item_payment',
  created_at            timestamptz not null default now()
);
create index if not exists orders_batch_id_idx on public.orders(batch_id);
create index if not exists orders_dispatch_status_idx on public.orders(dispatch_status);
create index if not exists orders_item_ref_idx on public.orders(item_payment_reference);
create index if not exists orders_shipping_ref_idx on public.orders(shipping_payment_reference);

-- If you already ran an earlier version of this schema, these add the new
-- columns without recreating the table:
alter table public.orders add column if not exists item_payment_reference text;
alter table public.orders add column if not exists shipping_payment_reference text;
alter table public.orders add column if not exists item_platform_fee integer;
alter table public.orders add column if not exists item_merchant_amount integer;
alter table public.orders add column if not exists shipping_platform_fee integer;
alter table public.orders add column if not exists shipping_merchant_amount integer;
alter table public.orders add column if not exists item_provider text;
alter table public.orders add column if not exists item_gafia_account text;
alter table public.orders add column if not exists item_gafia_bank text;
alter table public.orders add column if not exists shipping_provider text;
alter table public.orders add column if not exists shipping_gafia_account text;
alter table public.orders add column if not exists shipping_gafia_bank text;
alter table public.orders add column if not exists item_dva_account text;
alter table public.orders add column if not exists item_dva_bank text;
alter table public.orders add column if not exists shipping_dva_account text;
alter table public.orders add column if not exists shipping_dva_bank text;
alter table public.orders add column if not exists paystack_customer_code text;

-- Order reference sequence --------------------------------------------------
-- Mirrors the mock "RNM-1001, RNM-1002…" scheme with a DB sequence so
-- references stay unique even under concurrency.
create sequence if not exists public.order_reference_seq start with 1001;

create or replace function public.set_order_reference()
returns trigger
language plpgsql
as $$
begin
  if new.order_reference is null or new.order_reference = '' then
    new.order_reference := 'RNM-' || nextval('public.order_reference_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists set_order_reference_trigger on public.orders;
create trigger set_order_reference_trigger
  before insert on public.orders
  for each row execute function public.set_order_reference();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.batches  enable row level security;
alter table public.products enable row level security;
alter table public.orders   enable row level security;

-- Batches: authenticated owner has full access.
drop policy if exists "batches_auth_all" on public.batches;
create policy "batches_auth_all" on public.batches
  for all to authenticated using (true) with check (true);

-- Products: authenticated owner full access; anyone can read (public catalogue).
drop policy if exists "products_auth_all" on public.products;
create policy "products_auth_all" on public.products
  for all to authenticated using (true) with check (true);

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products
  for select to anon using (true);

-- Orders: authenticated owner full access.
drop policy if exists "orders_auth_all" on public.orders;
create policy "orders_auth_all" on public.orders
  for all to authenticated using (true) with check (true);

-- Orders: anonymous checkout can create an order and read it back.
drop policy if exists "orders_public_insert" on public.orders;
create policy "orders_public_insert" on public.orders
  for insert to anon with check (true);

drop policy if exists "orders_public_read" on public.orders;
create policy "orders_public_read" on public.orders
  for select to anon using (true);

-- ---------------------------------------------------------------------------
-- Storage: product images
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Public read of product images.
drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

-- Authenticated owner can upload/update/delete product images.
drop policy if exists "product_images_auth_write" on storage.objects;
create policy "product_images_auth_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

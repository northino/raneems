// ---------------------------------------------------------------------------
// SINGLE API LAYER  (Supabase-backed)
// ---------------------------------------------------------------------------
// Every piece of data the UI reads or writes goes through a named function in
// this file. Each one talks to Supabase (Postgres + Auth + Storage) and maps
// the snake_case DB rows to the camelCase shapes in lib/types.ts. Nothing
// outside this file touches Supabase directly, so components stay unchanged.
//
// The DB schema this expects lives in supabase/schema.sql.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./supabase/client";
import {
  Batch,
  DispatchStatus,
  Order,
  OrderFilters,
  Product,
  ProductAttribute,
} from "./types";

// Lazily create the browser client on first use. Creating it at module load
// would throw during static prerender (when env vars aren't inlined yet) and
// break `next build`. This defers creation to actual (client-side) calls.
let _supabase: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!_supabase) _supabase = createClient();
  return _supabase;
}

const PRODUCT_IMAGE_BUCKET = "product-images";

// ---------------------------------------------------------------------------
// Row types (shape returned by Supabase) + mappers to app types
// ---------------------------------------------------------------------------

interface BatchRow {
  id: string;
  name: string;
  status: Batch["status"];
  created_at: string;
}

interface ProductRow {
  id: string;
  batch_id: string;
  name: string;
  description: string;
  attributes: ProductAttribute[];
  price: number;
  image_url: string;
  public_slug: string;
}

interface OrderRow {
  id: string;
  order_reference: string;
  batch_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  delivery_address: string;
  item_paid: boolean;
  item_amount: number | null;
  item_paid_at: string | null;
  shipping_paid: boolean;
  shipping_amount: number | null;
  shipping_paid_at: string | null;
  dispatch_status: DispatchStatus;
  created_at: string;
}

function mapBatch(row: BatchRow): Batch {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    status: row.status,
  };
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    batchId: row.batch_id,
    name: row.name,
    description: row.description,
    attributes: row.attributes ?? [],
    price: row.price,
    imageUrl: row.image_url,
    publicSlug: row.public_slug,
  };
}

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    orderReference: row.order_reference,
    batchId: row.batch_id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    deliveryAddress: row.delivery_address,
    itemPayment: {
      paid: row.item_paid,
      amount: row.item_amount,
      paidAt: row.item_paid_at,
    },
    shippingPayment: {
      paid: row.shipping_paid,
      amount: row.shipping_amount,
      paidAt: row.shipping_paid_at,
    },
    dispatchStatus: row.dispatch_status,
    createdAt: row.created_at,
  };
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** Signs in with email + password against Supabase Auth. */
export async function login(
  email: string,
  password: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!email || !password) {
    return { ok: false, message: "Email and password are required." };
  }
  const { error } = await db().auth.signInWithPassword({ email, password });
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

/** Ends the Supabase session. */
export async function logout(): Promise<void> {
  await db().auth.signOut();
}

/**
 * Async session check — resolves whether a user is currently signed in.
 * Route guards should prefer the useAuth() hook from lib/auth-context.
 */
export async function getCurrentUser() {
  const { data } = await db().auth.getUser();
  return data.user;
}

/**
 * Change the signed-in user's password. Re-verifies the current password first
 * (signInWithPassword) so an unattended logged-in session can't silently change
 * it, then updates via Supabase auth.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!currentPassword || !newPassword) {
    return { ok: false, message: "Both current and new password are required." };
  }
  if (newPassword.length < 8) {
    return { ok: false, message: "New password must be at least 8 characters." };
  }

  const {
    data: { user },
  } = await db().auth.getUser();
  if (!user?.email) {
    return { ok: false, message: "You must be signed in." };
  }

  // Verify the current password by re-authenticating.
  const { error: verifyError } = await db().auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    return { ok: false, message: "Current password is incorrect." };
  }

  const { error } = await db().auth.updateUser({ password: newPassword });
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Batches
// ---------------------------------------------------------------------------

export async function listBatches(): Promise<Batch[]> {
  const { data, error } = await db()
    .from("batches")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as BatchRow[]).map(mapBatch);
}

export async function getBatch(id: string): Promise<Batch | undefined> {
  const { data, error } = await db()
    .from("batches")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapBatch(data as BatchRow) : undefined;
}

export async function createBatch(name: string): Promise<Batch> {
  const { data, error } = await db()
    .from("batches")
    .insert({ name })
    .select("*")
    .single();
  if (error) throw error;
  return mapBatch(data as BatchRow);
}

export async function setBatchStatus(
  id: string,
  status: Batch["status"],
): Promise<Batch | undefined> {
  const { data, error } = await db()
    .from("batches")
    .update({ status })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? mapBatch(data as BatchRow) : undefined;
}

export async function countProductsInBatch(batchId: string): Promise<number> {
  const { count, error } = await db()
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("batch_id", batchId);
  if (error) throw error;
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function listProducts(batchId?: string): Promise<Product[]> {
  let query = db()
    .from("products")
    .select("*")
    .order("created_at", { ascending: true });
  if (batchId) query = query.eq("batch_id", batchId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as ProductRow[]).map(mapProduct);
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const { data, error } = await db()
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProduct(data as ProductRow) : undefined;
}

export async function getProductBySlug(
  slug: string,
): Promise<Product | undefined> {
  const { data, error } = await db()
    .from("products")
    .select("*")
    .eq("public_slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProduct(data as ProductRow) : undefined;
}

export interface CreateProductInput {
  batchId: string;
  name: string;
  description: string;
  attributes: ProductAttribute[];
  price: number;
  imageUrl: string;
}

export async function createProduct(
  input: CreateProductInput,
): Promise<Product> {
  const { data, error } = await db()
    .from("products")
    .insert({
      batch_id: input.batchId,
      name: input.name,
      description: input.description,
      attributes: input.attributes,
      price: input.price,
      image_url: input.imageUrl,
      public_slug: slugify(input.name),
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapProduct(data as ProductRow);
}

/**
 * Uploads a product image to Supabase Storage and returns its public URL.
 * Used by the Add Product form in place of the old FileReader data-URL mock.
 */
export async function uploadProductImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await db().storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = db().storage
    .from(PRODUCT_IMAGE_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Extracts the in-bucket path from a Supabase Storage public URL, or null if
 * the URL isn't one of ours (e.g. a placeholder `data:` SVG). Public URLs look
 * like: https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
 */
function storagePathFromPublicUrl(url: string): string | null {
  if (!url || url.startsWith("data:")) return null;
  const marker = `/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length).split("?")[0];
  return path ? decodeURIComponent(path) : null;
}

/**
 * Removes a product image from Storage. Safe no-op for placeholder/data-URL
 * images or anything not in our bucket, so callers don't need to check.
 */
export async function deleteProductImage(imageUrl: string): Promise<void> {
  const path = storagePathFromPublicUrl(imageUrl);
  if (!path) return;
  const { error } = await db().storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
  if (error) throw error;
}

export interface UpdateProductInput {
  name: string;
  description: string;
  attributes: ProductAttribute[];
  price: number;
  /** New hosted image URL. If it differs from the current one, the old image
   *  is deleted from Storage. Pass the existing URL to keep the current image. */
  imageUrl: string;
}

/**
 * Updates a product. If the image changed, the previous image is removed from
 * Storage first (so unused files don't pile up), then the new URL is saved.
 */
export async function updateProduct(
  id: string,
  input: UpdateProductInput,
): Promise<Product> {
  // Look up the current image so we can clean it up if it's being replaced.
  const existing = await getProduct(id);

  const { data, error } = await db()
    .from("products")
    .update({
      name: input.name,
      description: input.description,
      attributes: input.attributes,
      price: input.price,
      image_url: input.imageUrl,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  // After the DB update succeeds, delete the old image if it was replaced.
  if (existing && existing.imageUrl && existing.imageUrl !== input.imageUrl) {
    await deleteProductImage(existing.imageUrl).catch(() => {
      // Non-fatal: the product is updated; a stray image is not worth failing.
    });
  }

  return mapProduct(data as ProductRow);
}

/**
 * Deletes a product and removes its image from Storage.
 */
export async function deleteProduct(id: string): Promise<void> {
  const existing = await getProduct(id);

  const { error } = await db().from("products").delete().eq("id", id);
  if (error) throw error;

  if (existing?.imageUrl) {
    await deleteProductImage(existing.imageUrl).catch(() => {
      // Non-fatal: the row is gone; a leftover image is not worth failing.
    });
  }
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function listOrders(filters: OrderFilters = {}): Promise<Order[]> {
  let query = db()
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (filters.batchId) query = query.eq("batch_id", filters.batchId);
  if (filters.itemPaid !== undefined) query = query.eq("item_paid", filters.itemPaid);
  if (filters.shippingPaid !== undefined)
    query = query.eq("shipping_paid", filters.shippingPaid);
  if (filters.dispatchStatus) {
    query = query.eq("dispatch_status", filters.dispatchStatus);
  } else if (!filters.includeUnconfirmed) {
    // By default hide unconfirmed checkout attempts (order created but the
    // item payment never completed — abandoned or failed checkouts). They're
    // still visible when explicitly filtering by that dispatch status.
    query = query.neq("dispatch_status", "awaiting_item_payment");
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data as OrderRow[]).map(mapOrder);
}

export async function getOrder(id: string): Promise<Order | undefined> {
  const { data, error } = await db()
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapOrder(data as OrderRow) : undefined;
}

/**
 * Orders ready to hand to a delivery driver: both payments confirmed and not
 * yet delivered.
 */
export async function listReadyToDispatch(): Promise<Order[]> {
  const { data, error } = await db()
    .from("orders")
    .select("*")
    .eq("item_paid", true)
    .eq("shipping_paid", true)
    .neq("dispatch_status", "delivered")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as OrderRow[]).map(mapOrder);
}

/**
 * Deletes abandoned checkout attempts: orders still awaiting the item payment
 * (item never paid) that are older than `olderThanMinutes`. Safe — it only
 * ever touches unpaid `awaiting_item_payment` rows, never a real/paid order.
 * Returns the number of orders removed.
 */
export async function deleteAbandonedOrders(
  olderThanMinutes = 60,
): Promise<number> {
  const cutoff = new Date(
    Date.now() - olderThanMinutes * 60_000,
  ).toISOString();
  const { data, error } = await db()
    .from("orders")
    .delete()
    .eq("item_paid", false)
    .eq("dispatch_status", "awaiting_item_payment")
    .lt("created_at", cutoff)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export interface SubmitOrderInput {
  batchId: string;
  productId: string;
  productName: string;
  quantity: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddress: string;
  itemAmount: number;
}

/**
 * Created from the public catalogue page when the customer taps "Pay Now",
 * before payment is confirmed. The order_reference is assigned by a DB trigger.
 */
export async function submitOrder(input: SubmitOrderInput): Promise<Order> {
  const { data, error } = await db()
    .from("orders")
    .insert({
      batch_id: input.batchId,
      product_id: input.productId,
      product_name: input.productName,
      quantity: input.quantity,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_email: input.customerEmail,
      delivery_address: input.deliveryAddress,
      item_paid: false,
      item_amount: input.itemAmount,
      item_paid_at: null,
      shipping_paid: false,
      shipping_amount: null,
      shipping_paid_at: null,
      dispatch_status: "awaiting_item_payment",
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapOrder(data as OrderRow);
}

/**
 * Initializes a real Paystack transaction for the item payment (via the
 * server route, which holds the secret key) and returns the hosted checkout
 * URL. The caller should redirect the browser to `redirectUrl`. Payment is
 * confirmed asynchronously by the Paystack webhook / callback.
 */
export async function initiateItemPayment(
  orderId: string,
): Promise<{ redirectUrl: string }> {
  const res = await fetch("/api/payments/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, type: "item" }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not start payment.");
  return { redirectUrl: json.authorizationUrl as string };
}

/** Owner enters the shipping/import cost for this specific customer. */
export async function setShippingCost(
  orderId: string,
  amount: number,
): Promise<Order | undefined> {
  const { data, error } = await db()
    .from("orders")
    .update({ shipping_amount: amount })
    .eq("id", orderId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? mapOrder(data as OrderRow) : undefined;
}

/**
 * Generates a real Paystack payment link for the shipping cost (via the server
 * route). The owner sends this link to the customer over WhatsApp. Payment is
 * confirmed asynchronously by the Paystack webhook / callback.
 * Call setShippingCost() first so the order has a shipping amount.
 */
export async function generateShipmentLink(
  orderId: string,
): Promise<{ url: string }> {
  const res = await fetch("/api/payments/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, type: "shipping" }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not create shipment link.");
  return { url: json.authorizationUrl as string };
}

// ---------------------------------------------------------------------------
// GafiaPay (bank transfer to a virtual account) — second payment option.
// ---------------------------------------------------------------------------

export interface GafiaAccount {
  accountNumber: string;
  bankName: string;
  accountName: string;
  amount: number;
}

/** Same shape as GafiaAccount — bank account details to display for a transfer. */
export type TransferAccount = GafiaAccount;

/**
 * Starts a Paystack "pay with bank transfer" (Dedicated Virtual Account) for an
 * item payment: returns a bank account to display on the page. Payment is
 * confirmed asynchronously by the Paystack charge.success webhook.
 */
export async function initiateItemPaymentDva(
  orderId: string,
): Promise<TransferAccount> {
  const res = await fetch("/api/payments/dva", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, type: "item" }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not start bank transfer.");
  return json as TransferAccount;
}

/**
 * Generates a Paystack DVA for the shipping cost. The owner sends the transfer
 * details to the customer over WhatsApp. Call setShippingCost() first.
 */
export async function generateShipmentDva(
  orderId: string,
): Promise<TransferAccount> {
  const res = await fetch("/api/payments/dva", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, type: "shipping" }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not create bank transfer.");
  return json as TransferAccount;
}

/**
 * Starts a GafiaPay item payment: generates a virtual account for the customer
 * to transfer into. Requires the customer's BVN or NIN. Payment is confirmed
 * asynchronously by the GafiaPay webhook.
 */
export async function initiateItemPaymentGafia(
  orderId: string,
  id: { bvn?: string; nin?: string },
): Promise<GafiaAccount> {
  const res = await fetch("/api/gafiapay/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, type: "item", ...id }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not start GafiaPay payment.");
  return json as GafiaAccount;
}

/**
 * Generates a GafiaPay virtual account for the shipping cost. The owner sends
 * these transfer details to the customer over WhatsApp. Requires the
 * customer's BVN or NIN. Call setShippingCost() first.
 */
export async function generateShipmentGafia(
  orderId: string,
  id: { bvn?: string; nin?: string },
): Promise<GafiaAccount> {
  const res = await fetch("/api/gafiapay/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, type: "shipping", ...id }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not create GafiaPay transfer.");
  return json as GafiaAccount;
}

export async function setDispatchStatus(
  orderId: string,
  status: DispatchStatus,
): Promise<Order | undefined> {
  const { data, error } = await db()
    .from("orders")
    .update({ dispatch_status: status })
    .eq("id", orderId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? mapOrder(data as OrderRow) : undefined;
}

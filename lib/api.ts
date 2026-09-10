// ---------------------------------------------------------------------------
// SINGLE API LAYER
// ---------------------------------------------------------------------------
// Every piece of data the UI reads or writes goes through a named function
// in this file. Right now each function reads/writes localStorage as a
// stand-in "database" and resolves after a short artificial delay so the
// UI's loading states behave like they will against a real network call.
//
// To wire up a real backend: replace the body of each function with a
// `fetch(...)` call (or your API client of choice) that returns the same
// shape. Nothing outside this file talks to localStorage directly, so no
// component or page needs to change.
// ---------------------------------------------------------------------------

import { seedBatches, seedOrders, seedProducts } from "./mock-data";
import { readCollection, readFlag, writeCollection, writeFlag } from "./storage";
import {
  Batch,
  DispatchStatus,
  Order,
  OrderFilters,
  Product,
  ProductAttribute,
} from "./types";

const BATCHES_KEY = "batches";
const PRODUCTS_KEY = "products";
const ORDERS_KEY = "orders";
const AUTH_KEY = "auth";

function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function getBatches(): Batch[] {
  return readCollection<Batch>(BATCHES_KEY, seedBatches);
}
function setBatches(batches: Batch[]) {
  writeCollection(BATCHES_KEY, batches);
}
function getProducts(): Product[] {
  return readCollection<Product>(PRODUCTS_KEY, seedProducts);
}
function setProducts(products: Product[]) {
  writeCollection(PRODUCTS_KEY, products);
}
function getOrders(): Order[] {
  return readCollection<Order>(ORDERS_KEY, seedOrders);
}
function setOrders(orders: Order[]) {
  writeCollection(ORDERS_KEY, orders);
}

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
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

/**
 * TODO: replace with a real API call (e.g. POST /api/auth/login) that
 * verifies credentials and returns a session token / cookie.
 */
export async function login(
  email: string,
  password: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!email || !password) {
    return delay({ ok: false, message: "Email and password are required." });
  }
  writeFlag(AUTH_KEY, true);
  return delay({ ok: true });
}

/** TODO: replace with a real API call that invalidates the session. */
export async function logout(): Promise<void> {
  writeFlag(AUTH_KEY, false);
  return delay(undefined, 100);
}

/** Synchronous on purpose — used by route guards before first paint. */
export function isAuthenticated(): boolean {
  return readFlag(AUTH_KEY);
}

// ---------------------------------------------------------------------------
// Batches
// ---------------------------------------------------------------------------

/** TODO: replace with GET /api/batches */
export async function listBatches(): Promise<Batch[]> {
  const batches = [...getBatches()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  return delay(batches);
}

/** TODO: replace with GET /api/batches/:id */
export async function getBatch(id: string): Promise<Batch | undefined> {
  return delay(getBatches().find((b) => b.id === id));
}

/** TODO: replace with POST /api/batches */
export async function createBatch(name: string): Promise<Batch> {
  const batch: Batch = {
    id: randomId("batch"),
    name,
    createdAt: new Date().toISOString(),
    status: "open",
  };
  setBatches([batch, ...getBatches()]);
  return delay(batch);
}

/** TODO: replace with PATCH /api/batches/:id */
export async function setBatchStatus(
  id: string,
  status: Batch["status"],
): Promise<Batch | undefined> {
  const batches = getBatches().map((b) => (b.id === id ? { ...b, status } : b));
  setBatches(batches);
  return delay(batches.find((b) => b.id === id));
}

/** TODO: replace with GET /api/batches/:id/product-count (or include in batch payload) */
export async function countProductsInBatch(batchId: string): Promise<number> {
  return delay(getProducts().filter((p) => p.batchId === batchId).length);
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

/** TODO: replace with GET /api/products?batchId=... */
export async function listProducts(batchId?: string): Promise<Product[]> {
  const products = getProducts().filter((p) =>
    batchId ? p.batchId === batchId : true,
  );
  return delay(products);
}

/** TODO: replace with GET /api/products/:id */
export async function getProduct(id: string): Promise<Product | undefined> {
  return delay(getProducts().find((p) => p.id === id));
}

/** TODO: replace with GET /api/public/products/:slug (public, unauthenticated) */
export async function getProductBySlug(
  slug: string,
): Promise<Product | undefined> {
  return delay(getProducts().find((p) => p.publicSlug === slug));
}

export interface CreateProductInput {
  batchId: string;
  name: string;
  description: string;
  attributes: ProductAttribute[];
  price: number;
  imageUrl: string; // TODO: real backend should accept a File / multipart upload here
}

/** TODO: replace with POST /api/products (multipart if uploading a real image file) */
export async function createProduct(input: CreateProductInput): Promise<Product> {
  const product: Product = {
    id: randomId("prod"),
    batchId: input.batchId,
    name: input.name,
    description: input.description,
    attributes: input.attributes,
    price: input.price,
    imageUrl: input.imageUrl,
    publicSlug: slugify(input.name),
  };
  setProducts([...getProducts(), product]);
  return delay(product);
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

function nextOrderReference(): string {
  const count = getOrders().length + 1;
  return `RNM-${1000 + count}`;
}

/** TODO: replace with GET /api/orders?batchId=&itemPaid=&shippingPaid=&dispatchStatus= */
export async function listOrders(filters: OrderFilters = {}): Promise<Order[]> {
  let orders = [...getOrders()];
  if (filters.batchId) orders = orders.filter((o) => o.batchId === filters.batchId);
  if (filters.itemPaid !== undefined)
    orders = orders.filter((o) => o.itemPayment.paid === filters.itemPaid);
  if (filters.shippingPaid !== undefined)
    orders = orders.filter((o) => o.shippingPayment.paid === filters.shippingPaid);
  if (filters.dispatchStatus)
    orders = orders.filter((o) => o.dispatchStatus === filters.dispatchStatus);
  orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return delay(orders);
}

/** TODO: replace with GET /api/orders/:id */
export async function getOrder(id: string): Promise<Order | undefined> {
  return delay(getOrders().find((o) => o.id === id));
}

/**
 * Orders ready to hand to a delivery driver: both payments confirmed and
 * not yet delivered.
 * TODO: replace with GET /api/orders?readyToDispatch=true
 */
export async function listReadyToDispatch(): Promise<Order[]> {
  const orders = getOrders().filter(
    (o) =>
      o.itemPayment.paid &&
      o.shippingPayment.paid &&
      o.dispatchStatus !== "delivered",
  );
  orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return delay(orders);
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
 * before payment is confirmed.
 * TODO: replace with POST /api/public/orders (public, unauthenticated)
 */
export async function submitOrder(input: SubmitOrderInput): Promise<Order> {
  const order: Order = {
    id: randomId("order"),
    orderReference: nextOrderReference(),
    batchId: input.batchId,
    productId: input.productId,
    productName: input.productName,
    quantity: input.quantity,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    deliveryAddress: input.deliveryAddress,
    itemPayment: { paid: false, amount: input.itemAmount, paidAt: null },
    shippingPayment: { paid: false, amount: null, paidAt: null },
    dispatchStatus: "awaiting_item_payment",
    createdAt: new Date().toISOString(),
  };
  setOrders([...getOrders(), order]);
  return delay(order);
}

/**
 * Simulates redirecting to Paystack for the item payment.
 * TODO: replace with a real call to initialize a Paystack transaction and
 * return the authorization_url to redirect the customer to.
 */
export async function initiateItemPayment(
  orderId: string,
): Promise<{ redirectUrl: string }> {
  return delay({ redirectUrl: `https://mock-paystack.test/pay/${orderId}` }, 1200);
}

/**
 * Simulates the webhook/callback confirming the item payment succeeded.
 * TODO: replace with the real Paystack webhook handler updating this order,
 * or a verify call the frontend makes after redirect.
 */
export async function confirmMockItemPayment(orderId: string): Promise<Order | undefined> {
  const orders = getOrders().map((o) =>
    o.id === orderId
      ? {
          ...o,
          itemPayment: {
            paid: true,
            amount: o.itemPayment.amount,
            paidAt: new Date().toISOString(),
          },
          dispatchStatus: "awaiting_shipping_payment" as DispatchStatus,
        }
      : o,
  );
  setOrders(orders);
  return delay(orders.find((o) => o.id === orderId), 800);
}

/**
 * Owner enters the shipping/import cost for this specific customer.
 * TODO: replace with PATCH /api/orders/:id/shipping-cost
 */
export async function setShippingCost(
  orderId: string,
  amount: number,
): Promise<Order | undefined> {
  const orders = getOrders().map((o) =>
    o.id === orderId
      ? { ...o, shippingPayment: { ...o.shippingPayment, amount } }
      : o,
  );
  setOrders(orders);
  return delay(orders.find((o) => o.id === orderId));
}

/**
 * Generates the shipment payment link the owner sends to the customer.
 * TODO: replace with a real call to create a Paystack payment link for the
 * shipping amount and return its URL.
 */
export async function generateShipmentLink(
  orderId: string,
): Promise<{ url: string }> {
  return delay({ url: `https://mock-paystack.test/pay/shipping-${orderId}` });
}

/**
 * Demo-only helper standing in for the real Paystack webhook, which would
 * mark shipping as paid automatically once the customer pays the shipment
 * link. Kept here so the full flow can be demonstrated without a backend.
 * TODO: remove once real webhook handling marks shipping payments paid.
 */
export async function markShippingPaymentPaid(
  orderId: string,
): Promise<Order | undefined> {
  const orders = getOrders().map((o) =>
    o.id === orderId
      ? {
          ...o,
          shippingPayment: {
            ...o.shippingPayment,
            paid: true,
            paidAt: new Date().toISOString(),
          },
          dispatchStatus: "ready_to_dispatch" as DispatchStatus,
        }
      : o,
  );
  setOrders(orders);
  return delay(orders.find((o) => o.id === orderId));
}

/** TODO: replace with PATCH /api/orders/:id/dispatch-status */
export async function setDispatchStatus(
  orderId: string,
  status: DispatchStatus,
): Promise<Order | undefined> {
  const orders = getOrders().map((o) =>
    o.id === orderId ? { ...o, dispatchStatus: status } : o,
  );
  setOrders(orders);
  return delay(orders.find((o) => o.id === orderId));
}

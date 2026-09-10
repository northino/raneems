// Core data shapes shared by the mock API layer (lib/api.ts) and every
// component. A real backend should return data matching these exact shapes
// so the UI can be wired up without changes.

export interface Batch {
  id: string;
  name: string; // e.g. "Batch – September 2026"
  createdAt: string;
  status: "open" | "closed";
}

export interface ProductAttribute {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  batchId: string;
  name: string;
  description: string;
  attributes: ProductAttribute[]; // e.g. size, color
  price: number; // in Naira
  imageUrl: string;
  publicSlug: string; // used to build the public catalogue link
}

export interface PaymentInfo {
  paid: boolean;
  amount: number | null;
  paidAt: string | null;
}

export type DispatchStatus =
  | "awaiting_item_payment"
  | "awaiting_shipping_payment"
  | "ready_to_dispatch"
  | "dispatched"
  | "delivered";

export interface Order {
  id: string;
  orderReference: string;
  batchId: string;
  productId: string;
  productName: string;
  quantity: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddress: string;
  itemPayment: PaymentInfo;
  shippingPayment: PaymentInfo;
  dispatchStatus: DispatchStatus;
  createdAt: string;
}

export interface OrderFilters {
  batchId?: string;
  itemPaid?: boolean;
  shippingPaid?: boolean;
  dispatchStatus?: DispatchStatus;
  /**
   * Include orders still awaiting the item payment (unconfirmed checkout
   * attempts). Off by default so abandoned/failed checkouts don't clutter the
   * orders list. They're still reachable by filtering on the dispatch status.
   */
  includeUnconfirmed?: boolean;
}

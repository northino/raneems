// Shared server-side logic for applying a confirmed Paystack payment to an
// order. Used by BOTH the redirect callback and the webhook so they behave
// identically and idempotently (safe to run more than once for the same
// reference — Paystack may deliver a webhook and a callback for one payment).
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PaymentType = "item" | "shipping";

export interface PaymentHints {
  /** From Paystack metadata — used as a fallback if the reference lookup
   *  misses (e.g. the shipping link was regenerated and the stored reference
   *  was overwritten). */
  orderId?: string | null;
  type?: PaymentType | null;
}

interface OrderRow {
  id: string;
  item_paid: boolean;
  shipping_paid: boolean;
}

interface ApplyResult {
  orderId: string | null;
  applied: boolean; // false if it was already paid (idempotent no-op)
}

/**
 * Resolve the order + which payment this is, trying in order:
 *   1. the stored reference columns (the normal path), then
 *   2. the orderId from Paystack metadata (fallback). When resolved by
 *      orderId, the payment type comes from the metadata hint.
 */
async function resolveOrder(
  supabase: SupabaseClient,
  reference: string,
  hints: PaymentHints,
): Promise<{ order: OrderRow | null; type: PaymentType | null }> {
  // 1. By reference — item column.
  const { data: byItem } = await supabase
    .from("orders")
    .select("id, item_paid, shipping_paid")
    .eq("item_payment_reference", reference)
    .maybeSingle();
  if (byItem) return { order: byItem as OrderRow, type: "item" };

  // 1. By reference — shipping column.
  const { data: byShipping } = await supabase
    .from("orders")
    .select("id, item_paid, shipping_paid")
    .eq("shipping_payment_reference", reference)
    .maybeSingle();
  if (byShipping) return { order: byShipping as OrderRow, type: "shipping" };

  // 2. Fallback: by orderId from metadata (reference may have been overwritten
  //    by a regenerated link, or not stored yet). Requires the type hint so we
  //    know which payment to mark.
  if (hints.orderId && (hints.type === "item" || hints.type === "shipping")) {
    const { data: byId } = await supabase
      .from("orders")
      .select("id, item_paid, shipping_paid")
      .eq("id", hints.orderId)
      .maybeSingle();
    if (byId) return { order: byId as OrderRow, type: hints.type };
  }

  return { order: null, type: null };
}

/** Marks the given payment paid on the order and advances dispatch_status. */
async function applyToOrder(
  supabase: SupabaseClient,
  order: OrderRow,
  type: PaymentType,
): Promise<ApplyResult> {
  const now = new Date().toISOString();

  if (type === "item") {
    if (order.item_paid) return { orderId: order.id, applied: false };
    const { error } = await supabase
      .from("orders")
      .update({
        item_paid: true,
        item_paid_at: now,
        dispatch_status: "awaiting_shipping_payment",
      })
      .eq("id", order.id);
    if (error) throw error;
    return { orderId: order.id, applied: true };
  }

  // shipping
  if (order.shipping_paid) return { orderId: order.id, applied: false };
  const { error } = await supabase
    .from("orders")
    .update({
      shipping_paid: true,
      shipping_paid_at: now,
      dispatch_status: "ready_to_dispatch",
    })
    .eq("id", order.id);
  if (error) throw error;
  return { orderId: order.id, applied: true };
}

/**
 * Given a verified Paystack reference (and optional metadata hints), find the
 * matching order and mark the corresponding payment paid. Idempotent: if the
 * payment is already marked paid, it does nothing.
 */
export async function applyPaymentByReference(
  supabase: SupabaseClient,
  reference: string,
  hints: PaymentHints = {},
): Promise<ApplyResult> {
  const { order, type } = await resolveOrder(supabase, reference, hints);
  if (!order || !type) return { orderId: null, applied: false };
  return applyToOrder(supabase, order, type);
}

interface GafiaOrderRow extends OrderRow {
  item_provider: string | null;
  shipping_provider: string | null;
  item_gafia_account: string | null;
  shipping_gafia_account: string | null;
  item_amount: number | null;
  shipping_amount: number | null;
}

/**
 * Apply a confirmed GafiaPay transfer. GafiaPay reuses one virtual account per
 * customer email and doesn't echo our order metadata, so we correlate by the
 * virtual account number + the matching unpaid amount. Idempotent.
 *
 * Resolution:
 *   1. If metadata carries our orderId, use it directly.
 *   2. Otherwise find an order whose stored gafia account matches AND whose
 *      corresponding unpaid amount equals the paid amount.
 */
export async function applyGafiaPayment(
  supabase: SupabaseClient,
  params: {
    accountNumber?: string | null;
    amountNaira: number;
    orderId?: string | null;
    type?: PaymentType | null;
  },
): Promise<ApplyResult> {
  // 1. Direct by metadata orderId + type.
  if (params.orderId && (params.type === "item" || params.type === "shipping")) {
    const { data } = await supabase
      .from("orders")
      .select("id, item_paid, shipping_paid")
      .eq("id", params.orderId)
      .maybeSingle();
    if (data) return applyToOrder(supabase, data as OrderRow, params.type);
  }

  // 2. By virtual account number + matching unpaid amount.
  if (!params.accountNumber) return { orderId: null, applied: false };

  const { data: itemMatch } = await supabase
    .from("orders")
    .select("id, item_paid, shipping_paid, item_amount, shipping_amount")
    .eq("item_provider", "gafiapay")
    .eq("item_gafia_account", params.accountNumber)
    .eq("item_paid", false)
    .eq("item_amount", Math.round(params.amountNaira))
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (itemMatch) {
    return applyToOrder(supabase, itemMatch as GafiaOrderRow, "item");
  }

  const { data: shipMatch } = await supabase
    .from("orders")
    .select("id, item_paid, shipping_paid, item_amount, shipping_amount")
    .eq("shipping_provider", "gafiapay")
    .eq("shipping_gafia_account", params.accountNumber)
    .eq("shipping_paid", false)
    .eq("shipping_amount", Math.round(params.amountNaira))
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (shipMatch) {
    return applyToOrder(supabase, shipMatch as GafiaOrderRow, "shipping");
  }

  return { orderId: null, applied: false };
}

/**
 * Apply a confirmed Paystack Dedicated Virtual Account (DVA) transfer. Paystack
 * doesn't tie a DVA transfer to our order reference, so we correlate by the
 * receiver account number + matching unpaid amount (same approach as GafiaPay).
 * Idempotent.
 */
export async function applyDvaPayment(
  supabase: SupabaseClient,
  params: { accountNumber?: string | null; amountNaira: number },
): Promise<ApplyResult> {
  if (!params.accountNumber) return { orderId: null, applied: false };

  const { data: itemMatch } = await supabase
    .from("orders")
    .select("id, item_paid, shipping_paid, item_amount, shipping_amount")
    .eq("item_provider", "paystack_dva")
    .eq("item_dva_account", params.accountNumber)
    .eq("item_paid", false)
    .eq("item_amount", Math.round(params.amountNaira))
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (itemMatch) {
    return applyToOrder(supabase, itemMatch as OrderRow, "item");
  }

  const { data: shipMatch } = await supabase
    .from("orders")
    .select("id, item_paid, shipping_paid, item_amount, shipping_amount")
    .eq("shipping_provider", "paystack_dva")
    .eq("shipping_dva_account", params.accountNumber)
    .eq("shipping_paid", false)
    .eq("shipping_amount", Math.round(params.amountNaira))
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (shipMatch) {
    return applyToOrder(supabase, shipMatch as OrderRow, "shipping");
  }

  return { orderId: null, applied: false };
}

/** Parse the orderId + payment type out of a Paystack metadata object. */
export function hintsFromMetadata(metadata: unknown): PaymentHints {
  if (!metadata || typeof metadata !== "object") return {};
  const m = metadata as Record<string, unknown>;
  const orderId = typeof m.orderId === "string" ? m.orderId : null;
  const type =
    m.paymentType === "item" || m.paymentType === "shipping"
      ? (m.paymentType as PaymentType)
      : null;
  return { orderId, type };
}

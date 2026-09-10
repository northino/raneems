// GET /api/payments/callback?reference=...&trxref=...
//
// Paystack redirects the customer here after they complete (or abandon)
// checkout. We verify the transaction server-side and, if successful, mark the
// order paid. The webhook is the authoritative confirmation, but doing it here
// too gives the customer immediate feedback. Both paths are idempotent.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTransaction } from "@/lib/paystack";
import {
  applyPaymentByReference,
  hintsFromMetadata,
  type PaymentHints,
} from "@/lib/payments";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference =
    url.searchParams.get("reference") || url.searchParams.get("trxref");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;

  if (!reference) {
    return NextResponse.redirect(`${siteUrl}/?payment=error`);
  }

  try {
    const result = await verifyTransaction(reference);
    const supabase = createAdminClient();
    // metadata (orderId + paymentType) is echoed back on the verified txn, and
    // lets us resolve the order even if the stored reference was overwritten.
    const hints = hintsFromMetadata(
      (result.raw as { metadata?: unknown }).metadata,
    );

    if (result.status !== "success") {
      const orderId = await findOrderId(supabase, reference, hints);
      const dest = orderId
        ? `${siteUrl}/orders/${orderId}?payment=failed`
        : `${siteUrl}/?payment=failed`;
      return NextResponse.redirect(dest);
    }

    const { orderId } = await applyPaymentByReference(
      supabase,
      reference,
      hints,
    );

    const dest = orderId
      ? `${siteUrl}/payment/success?order=${orderId}`
      : `${siteUrl}/payment/success`;
    return NextResponse.redirect(dest);
  } catch {
    return NextResponse.redirect(`${siteUrl}/payment/success?status=pending`);
  }
}

/** Best-effort order lookup for the failure redirect: by reference, then by
 *  the orderId hint from metadata. */
async function findOrderId(
  supabase: ReturnType<typeof createAdminClient>,
  reference: string,
  hints: PaymentHints,
): Promise<string | null> {
  const { data: item } = await supabase
    .from("orders")
    .select("id")
    .eq("item_payment_reference", reference)
    .maybeSingle();
  if (item) return item.id;

  const { data: shipping } = await supabase
    .from("orders")
    .select("id")
    .eq("shipping_payment_reference", reference)
    .maybeSingle();
  if (shipping) return shipping.id;

  if (hints.orderId) {
    const { data: byId } = await supabase
      .from("orders")
      .select("id")
      .eq("id", hints.orderId)
      .maybeSingle();
    if (byId) return byId.id;
  }

  return null;
}

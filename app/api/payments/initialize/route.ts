// POST /api/payments/initialize
// Body: { orderId: string, type: "item" | "shipping" }
//
// Initializes a Paystack transaction for the given order and returns the
// hosted checkout URL. Runs server-side so the Paystack secret key never
// reaches the browser. Uses the admin Supabase client because the item flow
// is initiated by an anonymous customer (no session) and must both read the
// order and store the payment reference.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { initializeTransaction } from "@/lib/paystack";
import { computeFeeBreakdown, MIN_SHIPPING_NAIRA } from "@/lib/fees";

export async function POST(request: Request) {
  try {
    const { orderId, type } = (await request.json()) as {
      orderId?: string;
      type?: "item" | "shipping";
    };

    if (!orderId || (type !== "item" && type !== "shipping")) {
      return NextResponse.json(
        { error: "orderId and a valid type ('item'|'shipping') are required." },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (error) throw error;
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const amountNaira =
      type === "item" ? order.item_amount : order.shipping_amount;
    if (!amountNaira || amountNaira <= 0) {
      return NextResponse.json(
        { error: `No ${type} amount set on this order.` },
        { status: 400 },
      );
    }

    // Enforce a minimum shipping fee so the commission doesn't consume the
    // whole payment and leave the merchant nothing.
    if (type === "shipping" && amountNaira < MIN_SHIPPING_NAIRA) {
      return NextResponse.json(
        { error: `Shipping fee must be at least ₦${MIN_SHIPPING_NAIRA}.` },
        { status: 400 },
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const callbackUrl = `${siteUrl}/api/payments/callback`;

    // Split: the customer pays `amountNaira`; the platform keeps a commission
    // (₦150 + 8.5%), the merchant subaccount gets the rest. If no subaccount is
    // configured, the payment isn't split (all goes to the main account).
    const fees = computeFeeBreakdown(amountNaira);
    const rawSubaccount = process.env.PAYSTACK_SUBACCOUNT_CODE?.trim();
    // Guard against a common .env typo (e.g. a stray leading "=" or quotes):
    // a valid Paystack subaccount code starts with "ACCT_".
    if (rawSubaccount && !rawSubaccount.startsWith("ACCT_")) {
      return NextResponse.json(
        {
          error:
            "PAYSTACK_SUBACCOUNT_CODE is malformed — it must start with 'ACCT_'. Check .env.local for a stray '=' or quotes.",
        },
        { status: 500 },
      );
    }
    const subaccount = rawSubaccount || undefined;

    const { authorizationUrl, reference } = await initializeTransaction({
      email: order.customer_email,
      amountNaira,
      callbackUrl,
      subaccount,
      transactionChargeNaira: subaccount
        ? fees.platformCommissionNaira
        : undefined,
      metadata: {
        orderId: order.id,
        orderReference: order.order_reference,
        paymentType: type,
        platformCommission: fees.platformCommissionNaira,
        merchantAmount: fees.merchantAmountNaira,
      },
    });

    // Store the reference (for webhook/callback correlation) and the fee split
    // breakdown for this payment.
    const update =
      type === "item"
        ? {
            item_payment_reference: reference,
            item_platform_fee: fees.platformCommissionNaira,
            item_merchant_amount: fees.merchantAmountNaira,
          }
        : {
            shipping_payment_reference: reference,
            shipping_platform_fee: fees.platformCommissionNaira,
            shipping_merchant_amount: fees.merchantAmountNaira,
          };
    const { error: updateError } = await supabase
      .from("orders")
      .update(update)
      .eq("id", orderId);
    if (updateError) throw updateError;

    return NextResponse.json({ authorizationUrl, reference });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to initialize payment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

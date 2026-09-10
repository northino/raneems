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

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const callbackUrl = `${siteUrl}/api/payments/callback`;

    const { authorizationUrl, reference } = await initializeTransaction({
      email: order.customer_email,
      amountNaira,
      callbackUrl,
      metadata: {
        orderId: order.id,
        orderReference: order.order_reference,
        paymentType: type,
      },
    });

    // Store the reference so the callback + webhook can correlate it back.
    const refColumn =
      type === "item" ? "item_payment_reference" : "shipping_payment_reference";
    const { error: updateError } = await supabase
      .from("orders")
      .update({ [refColumn]: reference })
      .eq("id", orderId);
    if (updateError) throw updateError;

    return NextResponse.json({ authorizationUrl, reference });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to initialize payment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

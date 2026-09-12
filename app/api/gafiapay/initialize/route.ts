// POST /api/gafiapay/initialize
// Body: { orderId: string, type: "item" | "shipping", bvn?: string, nin?: string }
//
// Generates a GafiaPay virtual account for the customer to transfer into.
// GafiaPay confirms payment asynchronously via its webhook. Requires a BVN or
// NIN (GafiaPay's virtual-account KYC). Runs server-side (secret key) and uses
// the admin Supabase client (the item flow has no user session).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateVirtualAccount } from "@/lib/gafiapay";
import { computeGafiaFeeBreakdown, MIN_SHIPPING_NAIRA } from "@/lib/fees";

function validId(v: string | undefined): boolean {
  return !!v && /^\d{11}$/.test(v);
}

export async function POST(request: Request) {
  try {
    const { orderId, type, bvn, nin } = (await request.json()) as {
      orderId?: string;
      type?: "item" | "shipping";
      bvn?: string;
      nin?: string;
    };

    if (!orderId || (type !== "item" && type !== "shipping")) {
      return NextResponse.json(
        { error: "orderId and a valid type ('item'|'shipping') are required." },
        { status: 400 },
      );
    }
    if (!validId(bvn) && !validId(nin)) {
      return NextResponse.json(
        { error: "A valid 11-digit BVN or NIN is required." },
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
    if (type === "shipping" && amountNaira < MIN_SHIPPING_NAIRA) {
      return NextResponse.json(
        { error: `Shipping fee must be at least ₦${MIN_SHIPPING_NAIRA}.` },
        { status: 400 },
      );
    }

    // Generate (or reuse) the customer's virtual account.
    const account = await generateVirtualAccount({
      name: order.customer_name,
      email: order.customer_email,
      bvn: validId(bvn) ? bvn : undefined,
      nin: validId(nin) ? nin : undefined,
    });

    const fees = computeGafiaFeeBreakdown(amountNaira);

    // Record provider + virtual account details + intended split for this
    // payment. The webhook confirms and marks it paid.
    const update =
      type === "item"
        ? {
            item_provider: "gafiapay",
            item_gafia_account: account.accountNumber,
            item_gafia_bank: account.bankName,
            item_platform_fee: fees.platformCommissionNaira,
            item_merchant_amount: fees.merchantAmountNaira,
          }
        : {
            shipping_provider: "gafiapay",
            shipping_gafia_account: account.accountNumber,
            shipping_gafia_bank: account.bankName,
            shipping_platform_fee: fees.platformCommissionNaira,
            shipping_merchant_amount: fees.merchantAmountNaira,
          };
    const { error: updateError } = await supabase
      .from("orders")
      .update(update)
      .eq("id", orderId);
    if (updateError) throw updateError;

    return NextResponse.json({
      accountNumber: account.accountNumber,
      bankName: account.bankName,
      accountName: account.accountName,
      amount: amountNaira,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to start GafiaPay payment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

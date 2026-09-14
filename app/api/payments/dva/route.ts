// POST /api/payments/dva
// Body: { orderId: string, type: "item" | "shipping" }
//
// "Pay with bank transfer" via a Paystack Dedicated Virtual Account (DVA).
// Creates/reuses a bank account for the customer (split to the Raneems
// subaccount when configured) and returns the account details to show on the
// page. Payment is confirmed asynchronously by the charge.success webhook.
//
// Business category is e-commerce (optional compliance) so no BVN/customer
// validation is required — only email/name/phone.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateDedicatedAccount } from "@/lib/paystack";
import { computeFeeBreakdown, MIN_SHIPPING_NAIRA } from "@/lib/fees";

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

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
    if (type === "shipping" && amountNaira < MIN_SHIPPING_NAIRA) {
      return NextResponse.json(
        { error: `Shipping fee must be at least ₦${MIN_SHIPPING_NAIRA}.` },
        { status: 400 },
      );
    }

    // Contingency (option 4): a DVA is permanent per customer email, and the
    // webhook matches an incoming transfer by account + amount. To avoid a
    // stale/abandoned unpaid transfer catching a later payment, ensure this
    // customer has only ONE open unpaid DVA order of this type at a time —
    // remove their earlier unpaid DVA attempts (item: never paid & still
    // awaiting item payment) before starting this one.
    if (type === "item") {
      await supabase
        .from("orders")
        .delete()
        .eq("customer_email", order.customer_email)
        .eq("item_provider", "paystack_dva")
        .eq("item_paid", false)
        .eq("dispatch_status", "awaiting_item_payment")
        .neq("id", orderId);
    }

    const rawSubaccount = process.env.PAYSTACK_SUBACCOUNT_CODE?.trim();
    const subaccount =
      rawSubaccount && rawSubaccount.startsWith("ACCT_")
        ? rawSubaccount
        : undefined;

    const { firstName, lastName } = splitName(order.customer_name);
    const account = await getOrCreateDedicatedAccount({
      email: order.customer_email,
      firstName,
      lastName,
      phone: order.customer_phone,
      subaccount,
    });

    // Record split breakdown + the DVA details for correlation on the webhook.
    const fees = computeFeeBreakdown(amountNaira);
    const update =
      type === "item"
        ? {
            item_provider: "paystack_dva",
            item_dva_account: account.accountNumber,
            item_dva_bank: account.bankName,
            item_platform_fee: fees.platformCommissionNaira,
            item_merchant_amount: fees.merchantAmountNaira,
            paystack_customer_code: account.customerCode,
          }
        : {
            shipping_provider: "paystack_dva",
            shipping_dva_account: account.accountNumber,
            shipping_dva_bank: account.bankName,
            shipping_platform_fee: fees.platformCommissionNaira,
            shipping_merchant_amount: fees.merchantAmountNaira,
            paystack_customer_code: account.customerCode,
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
      err instanceof Error ? err.message : "Failed to set up bank transfer.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

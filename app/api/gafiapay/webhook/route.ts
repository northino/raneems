// POST /api/gafiapay/webhook
//
// GafiaPay notifies us here when a customer's transfer into their virtual
// account is confirmed. We verify the signature (HMAC-SHA256 of the timestamp
// per GafiaPay's docs) and, when configured, the source IP, then mark the
// matching order paid. Idempotent: safe if GafiaPay retries.
//
// Real payload shape (observed):
//   { event: "payment.received",
//     data: { transaction: { status: "completed", amount: 100,
//       metadata: { virtualAccountNo: "6659551022", netAmount, ... } } },
//     timestamp: "1789...", signature: "..." }
// Note: status is "completed" (not "success"), the account number lives at
// data.transaction.metadata.virtualAccountNo, and timestamp/signature are in
// the BODY (also possibly in headers).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedWebhookIp, verifyWebhookSignature } from "@/lib/gafiapay";
import { applyGafiaPayment } from "@/lib/payments";

interface GafiaTxnMetadata {
  virtualAccountNo?: string;
  virtualAccountName?: string;
  grossAmount?: number;
  netAmount?: number;
  orderId?: string;
  paymentType?: "item" | "shipping";
}

interface GafiaWebhook {
  event?: string;
  data?: {
    transaction?: {
      id?: string;
      orderNo?: string;
      email?: string;
      amount?: number;
      status?: string;
      metadata?: GafiaTxnMetadata;
    };
  };
  timestamp?: string;
  signature?: string;
}

const SUCCESS_STATES = new Set(["completed", "success", "successful", "paid"]);

export async function POST(request: Request) {
  const rawBody = await request.text();
  const ip =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");

  if (!isAllowedWebhookIp(ip)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: GafiaWebhook;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Signature + timestamp may arrive in headers or in the body. Prefer body
  // (that's where GafiaPay puts them), falling back to headers.
  const timestamp =
    payload.timestamp ?? request.headers.get("x-timestamp");
  const signature =
    payload.signature ?? request.headers.get("x-signature");

  if (!verifyWebhookSignature(timestamp, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const txn = payload.data?.transaction;
  if (txn && txn.status && SUCCESS_STATES.has(txn.status.toLowerCase())) {
    try {
      const supabase = createAdminClient();
      const meta = txn.metadata ?? {};
      await applyGafiaPayment(supabase, {
        accountNumber: meta.virtualAccountNo ?? null,
        // Match on the gross amount the customer transferred (what we stored
        // as the order amount), not the net after GafiaPay's fee.
        amountNaira: Number(meta.grossAmount ?? txn.amount) || 0,
        orderId: meta.orderId ?? null,
        type: meta.paymentType ?? null,
      });
    } catch {
      // 500 so GafiaPay retries if our DB write failed.
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

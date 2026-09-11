// POST /api/gafiapay/webhook
//
// GafiaPay notifies us here when a customer's transfer into their virtual
// account is confirmed. We verify the source IP and the signature (HMAC-SHA256
// of the timestamp per GafiaPay's docs), then mark the matching order paid.
// Idempotent: safe if GafiaPay retries.
//
// Configure this URL in the GafiaPay dashboard. It must be publicly reachable
// (tunnel with ngrok/cloudflared in local dev).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedWebhookIp, verifyWebhookSignature } from "@/lib/gafiapay";
import { applyGafiaPayment, hintsFromMetadata } from "@/lib/payments";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");
  const timestamp = request.headers.get("x-timestamp");
  const ip =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip");

  if (!isAllowedWebhookIp(ip)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!verifyWebhookSignature(timestamp, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    data?: {
      transaction?: {
        orderNo?: string;
        email?: string;
        amount?: number;
        currency?: string;
        status?: string;
        metadata?: unknown;
        // GafiaPay may include the credited virtual account number.
        accountNumber?: string;
        virtualAccount?: string;
      };
    };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const txn = payload.data?.transaction;
  // Only act on successful transfers. Ack everything else with 200.
  if (txn && (txn.status === "success" || txn.status === "successful")) {
    try {
      const supabase = createAdminClient();
      const hints = hintsFromMetadata(txn.metadata);
      await applyGafiaPayment(supabase, {
        accountNumber: txn.accountNumber || txn.virtualAccount || null,
        amountNaira: Number(txn.amount) || 0,
        orderId: hints.orderId,
        type: hints.type,
      });
    } catch {
      // 500 so GafiaPay retries if our DB write failed.
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

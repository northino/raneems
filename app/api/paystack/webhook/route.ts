// POST /api/paystack/webhook
//
// Authoritative payment confirmation from Paystack. Paystack signs each
// delivery with HMAC-SHA512 over the RAW body (hex) in x-paystack-signature.
// We verify against the raw string — never against re-serialized JSON — then
// mark the matching order paid. Idempotent: safe if Paystack retries.
//
// Handles two kinds of charge.success:
//   • Hosted checkout (redirect) — correlated by our stored transaction
//     reference (+ metadata orderId fallback).
//   • Dedicated Virtual Account transfer — channel "dedicated_nuban"; there's
//     no reference we set, so we correlate by the receiver account number +
//     amount.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/paystack";
import {
  applyDvaPayment,
  applyPaymentByReference,
  hintsFromMetadata,
} from "@/lib/payments";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    event?: string;
    data?: {
      reference?: string;
      status?: string;
      amount?: number; // kobo
      channel?: string;
      metadata?: unknown;
      authorization?: {
        channel?: string;
        receiver_bank_account_number?: string;
      };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = event.data;
  const isSuccess =
    event.event === "charge.success" &&
    (data?.status === "success" || !data?.status);

  if (isSuccess && data) {
    try {
      const supabase = createAdminClient();
      const isDva =
        data.channel === "dedicated_nuban" ||
        data.authorization?.channel === "dedicated_nuban";

      if (isDva) {
        // Bank transfer into a dedicated virtual account: match by the
        // receiver account number + the amount transferred (kobo → Naira).
        await applyDvaPayment(supabase, {
          accountNumber:
            data.authorization?.receiver_bank_account_number ?? null,
          amountNaira: (Number(data.amount) || 0) / 100,
        });
      } else if (data.reference) {
        // Hosted checkout: correlate by our stored reference (+ metadata).
        await applyPaymentByReference(
          supabase,
          data.reference,
          hintsFromMetadata(data.metadata),
        );
      }
    } catch {
      // Return 500 so Paystack retries later if our DB write failed.
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

// POST /api/paystack/webhook
//
// Authoritative payment confirmation from Paystack. Paystack signs each
// delivery with HMAC-SHA512 over the RAW body (hex) in x-paystack-signature.
// We verify against the raw string — never against re-serialized JSON — then
// mark the matching order paid. Idempotent: safe if Paystack retries.
//
// Configure this URL in the Paystack dashboard (Settings → API Keys &
// Webhooks). It must be publicly reachable, so in local dev tunnel it with a
// tool like ngrok/cloudflared and point Paystack at the tunnel URL.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/paystack";
import { applyPaymentByReference, hintsFromMetadata } from "@/lib/payments";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    event?: string;
    data?: { reference?: string; status?: string; metadata?: unknown };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only act on successful charges. Acknowledge everything else with 200 so
  // Paystack doesn't retry events we intentionally ignore.
  if (event.event === "charge.success" && event.data?.reference) {
    if (event.data.status === "success" || !event.data.status) {
      try {
        const supabase = createAdminClient();
        // Pass metadata hints so we can still resolve the order by id if the
        // stored reference was overwritten (e.g. a regenerated shipping link).
        await applyPaymentByReference(
          supabase,
          event.data.reference,
          hintsFromMetadata(event.data.metadata),
        );
      } catch {
        // Return 500 so Paystack retries later if our DB write failed.
        return NextResponse.json({ error: "Processing failed" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}

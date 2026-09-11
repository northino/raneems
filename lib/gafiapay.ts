// Server-only GafiaPay helpers. NEVER import into a Client Component — reads
// GAFIAPAY_SECRET_KEY. GafiaPay uses virtual accounts (bank transfer): you
// generate a 10-digit account number for the customer, they transfer to it,
// and GafiaPay webhooks you when the money lands.
//
// Auth (per docs): HMAC-SHA256 over `JSON.stringify(body) + timestamp` using
// the secret key, sent in x-signature; x-api-key + x-timestamp headers too.
import "server-only";
import crypto from "crypto";

function baseUrl(): string {
  return (
    process.env.GAFIAPAY_BASE_URL?.trim() ||
    "https://api.gafiapay.com/api/v1/external"
  );
}

function apiKey(): string {
  const k = process.env.GAFIAPAY_API_KEY?.trim();
  if (!k) throw new Error("GAFIAPAY_API_KEY is not set");
  return k;
}

function secretKey(): string {
  const k = process.env.GAFIAPAY_SECRET_KEY?.trim();
  if (!k) throw new Error("GAFIAPAY_SECRET_KEY is not set");
  return k;
}

/** Request signature: HMAC-SHA256 of (JSON body + timestamp), hex. */
function signRequest(body: unknown, timestamp: string): string {
  const payload = `${JSON.stringify(body)}${timestamp}`;
  return crypto.createHmac("sha256", secretKey()).update(payload).digest("hex");
}

async function signedPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const timestamp = Date.now().toString();
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey(),
      "x-signature": signRequest(body, timestamp),
      "x-timestamp": timestamp,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json()) as { status?: string; message?: string } & T;
  if (!res.ok || json.status === "fail") {
    const raw = json.message || "GafiaPay request failed";
    // Log the raw provider message for debugging, but throw a friendly one.
    console.error("[gafiapay] request failed:", raw);
    throw new Error(friendlyGafiaError(raw));
  }
  return json;
}

/**
 * Translate GafiaPay / upstream KYC error messages into customer-friendly
 * text. Verification failures (bad BVN/NIN) are the common case and shouldn't
 * leak raw provider wording like "LicenseNumber verification failed".
 */
export function friendlyGafiaError(raw: string): string {
  const m = raw.toLowerCase();
  if (
    m.includes("verification failed") ||
    m.includes("licensenumber") ||
    m.includes("not found") ||
    m.includes("invalid bvn") ||
    m.includes("invalid nin") ||
    m.includes("no record")
  ) {
    return "We couldn't verify that BVN or NIN. Please double-check the number and try again.";
  }
  if (m.includes("name") && m.includes("match")) {
    return "The BVN/NIN doesn't match the name entered. Please use the name registered to that ID.";
  }
  if (m.includes("timeout") || m.includes("unavailable") || m.includes("try again")) {
    return "The verification service is temporarily unavailable. Please try again in a moment.";
  }
  // Fallback: a generic, safe message (raw is still logged server-side).
  return "Unable to verify your details right now. Please try again or use card payment.";
}

export interface VirtualAccount {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface GenerateAccountInput {
  name: string;
  email: string;
  /** Send exactly one. If both, GafiaPay uses BVN. Both are 11 digits. */
  bvn?: string;
  nin?: string;
}

/**
 * Generate (or reuse) a virtual account for a customer. GafiaPay reuses an
 * existing account for the same email+business. Requires a BVN or NIN.
 */
export async function generateVirtualAccount(
  input: GenerateAccountInput,
): Promise<VirtualAccount> {
  const body: Record<string, unknown> = { name: input.name, email: input.email };
  if (input.bvn) body.bvn = input.bvn;
  else if (input.nin) body.nin = input.nin;
  else throw new Error("A BVN or NIN is required to generate a virtual account.");

  const json = await signedPost<{ data: VirtualAccount }>(
    "/account/generate",
    body,
  );
  return json.data;
}

/**
 * Verify a GafiaPay webhook signature. Per their docs the signature is
 * HMAC-SHA256 of the TIMESTAMP (not the body), hex-encoded, in x-signature.
 */
export function verifyWebhookSignature(
  timestamp: string | null,
  signature: string | null,
): boolean {
  if (!timestamp || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secretKey())
    .update(timestamp)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Whether the request IP is in the GafiaPay allowlist (spoofing guard). */
export function isAllowedWebhookIp(ip: string | null): boolean {
  const allow = (process.env.GAFIAPAY_WEBHOOK_IPS || "38.242.149.154")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allow.length === 0) return true;
  if (!ip) return false;
  // x-forwarded-for can be a comma-separated list; check each hop.
  const hops = ip.split(",").map((s) => s.trim());
  return hops.some((h) => allow.includes(h));
}

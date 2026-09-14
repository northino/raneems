// Server-only Paystack helpers. NEVER import this into a Client Component —
// it reads PAYSTACK_SECRET_KEY, which must stay on the server.
import "server-only";
import crypto from "crypto";

const PAYSTACK_BASE = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
  if (key.startsWith("pk_")) {
    // A public key (pk_...) can't call the server API — this is the usual cause
    // of Paystack's "Invalid key" error. The server needs the secret key (sk_).
    throw new Error(
      "PAYSTACK_SECRET_KEY is set to a PUBLIC key (pk_...). Use your SECRET key (sk_...) from Paystack → Settings → API Keys & Webhooks.",
    );
  }
  return key;
}

export interface InitializeParams {
  email: string;
  /** Amount in Naira (whole units). Converted to kobo for Paystack. */
  amountNaira: number;
  reference?: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
  /** Merchant subaccount code (ACCT_...). When set, the payment is split. */
  subaccount?: string;
  /** Platform commission in Naira routed to the MAIN account (the rest goes to
   *  the subaccount). Sent as `transaction_charge` (in kobo). Only used when a
   *  subaccount is provided. */
  transactionChargeNaira?: number;
}

export interface InitializeResult {
  authorizationUrl: string;
  reference: string;
  accessCode: string;
}

/**
 * Initialize a Paystack transaction. Returns the hosted checkout URL to
 * redirect the customer to. Amount is sent in kobo (Naira * 100).
 */
export async function initializeTransaction(
  params: InitializeParams,
): Promise<InitializeResult> {
  const body: Record<string, unknown> = {
    email: params.email,
    amount: Math.round(params.amountNaira * 100),
    reference: params.reference,
    callback_url: params.callbackUrl,
    metadata: params.metadata,
  };

  // Payment split: route `transaction_charge` (the platform commission) to the
  // MAIN account and the rest to the subaccount. bearer: "account" makes the
  // main account pay Paystack's transaction fee, so it comes out of our
  // commission and the merchant's share is untouched.
  if (params.subaccount) {
    body.subaccount = params.subaccount;
    if (params.transactionChargeNaira !== undefined) {
      body.transaction_charge = Math.round(params.transactionChargeNaira * 100);
    }
    body.bearer = "account";
  }

  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    // Never cache payment calls.
    cache: "no-store",
  });

  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Paystack initialize failed");
  }
  return {
    authorizationUrl: json.data.authorization_url,
    reference: json.data.reference,
    accessCode: json.data.access_code,
  };
}

export interface VerifyResult {
  status: string; // "success", "failed", etc.
  reference: string;
  amountNaira: number;
  raw: Record<string, unknown>;
}

/** Verify a transaction by reference (server-side, authoritative). */
export async function verifyTransaction(
  reference: string,
): Promise<VerifyResult> {
  const res = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${secretKey()}` },
      cache: "no-store",
    },
  );
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Paystack verify failed");
  }
  return {
    status: json.data.status,
    reference: json.data.reference,
    amountNaira: (json.data.amount ?? 0) / 100,
    raw: json.data,
  };
}

/**
 * Verify a webhook payload came from Paystack: HMAC-SHA512 of the RAW request
 * body using the secret key, hex-encoded, compared to the x-paystack-signature
 * header. The body MUST be the raw string, not re-serialized JSON.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha512", secretKey())
    .update(rawBody)
    .digest("hex");
  // Constant-time compare.
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Dedicated Virtual Accounts (DVA) — "pay with bank transfer" on-page flow.
// ---------------------------------------------------------------------------
// The customer is shown a dedicated bank account number and transfers into it;
// Paystack sends a charge.success webhook (channel "dedicated_nuban") when the
// money lands. Our business is e-commerce (optional compliance), so no BVN /
// customer validation is required — only email/name/phone.

async function paystackGet<T>(path: string): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Paystack request failed");
  }
  return json as T;
}

async function paystackPost<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Paystack request failed");
  }
  return json as T;
}

export interface DedicatedAccount {
  accountNumber: string;
  accountName: string;
  bankName: string;
  customerCode: string;
}

/**
 * Ensure a Paystack customer exists for this email and return the customer_code.
 * Creating a customer with an existing email returns the existing record.
 */
export async function ensureCustomer(input: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}): Promise<string> {
  const json = await paystackPost<{ data: { customer_code: string } }>(
    "/customer",
    {
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
    },
  );
  return json.data.customer_code;
}

/**
 * Request a dedicated virtual account for a customer (single-step assign).
 * Optionally attaches a subaccount so incoming transfers are split. This is
 * ASYNCHRONOUS — Paystack returns "assignment in progress" and creates the
 * account shortly after; use pollDedicatedAccount() to retrieve it.
 */
export async function assignDedicatedAccount(input: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  preferredBank?: string; // "wema-bank" (live) or "test-bank" (test mode)
  subaccount?: string; // ACCT_... to split incoming transfers
}): Promise<void> {
  const body: Record<string, unknown> = {
    email: input.email,
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
    preferred_bank: input.preferredBank || "wema-bank",
    country: "NG",
  };
  if (input.subaccount) body.subaccount = input.subaccount;
  await paystackPost("/dedicated_account/assign", body);
}

interface FetchCustomerResponse {
  data: {
    customer_code: string;
    dedicated_account?: {
      account_number: string;
      account_name: string;
      bank?: { name?: string };
    } | null;
  };
}

/**
 * Fetch a customer's currently-assigned dedicated account, or null if the
 * async assignment hasn't completed yet.
 */
export async function fetchCustomerDedicatedAccount(
  customerCode: string,
): Promise<DedicatedAccount | null> {
  const json = await paystackGet<FetchCustomerResponse>(
    `/customer/${encodeURIComponent(customerCode)}`,
  );
  const dva = json.data.dedicated_account;
  if (!dva?.account_number) return null;
  return {
    accountNumber: dva.account_number,
    accountName: dva.account_name,
    bankName: dva.bank?.name || "Bank",
    customerCode: json.data.customer_code,
  };
}

/**
 * Create (if needed) and retrieve a dedicated account for a customer. Handles
 * the async assignment by polling Fetch Customer a few times. If the customer
 * already has a DVA, it's returned immediately.
 */
export async function getOrCreateDedicatedAccount(input: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  subaccount?: string;
}): Promise<DedicatedAccount> {
  const testMode = secretKey().startsWith("sk_test");
  const customerCode = await ensureCustomer(input);

  // If a DVA already exists for this customer, reuse it.
  const existing = await fetchCustomerDedicatedAccount(customerCode);
  if (existing) return existing;

  // Otherwise request one and poll until it's assigned.
  await assignDedicatedAccount({
    ...input,
    preferredBank: testMode ? "test-bank" : "wema-bank",
  });

  for (let attempt = 0; attempt < 6; attempt++) {
    await new Promise((r) => setTimeout(r, 1500));
    const dva = await fetchCustomerDedicatedAccount(customerCode);
    if (dva) return dva;
  }

  throw new Error(
    "Your payment account is being set up. Please try again in a moment.",
  );
}

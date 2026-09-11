"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";
import {
  getOrder,
  getProductBySlug,
  initiateItemPayment,
  initiateItemPaymentGafia,
  submitOrder,
  type GafiaAccount,
} from "@/lib/api";
import { Order, Product } from "@/lib/types";
import { formatNaira } from "@/lib/format";
import { QuantityStepper } from "@/components/QuantityStepper";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

type Stage = "loading" | "not-found" | "form" | "redirecting" | "gafia-waiting";

export default function PublicProductPage() {
  const params = useParams<{ slug: string }>();
  const [stage, setStage] = useState<Stage>("loading");
  const [product, setProduct] = useState<Product | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [identityNumber, setIdentityNumber] = useState(""); // BVN or NIN (GafiaPay)

  const [gafiaAccount, setGafiaAccount] = useState<GafiaAccount | null>(null);
  const [gafiaPaid, setGafiaPaid] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      const p = await getProductBySlug(params.slug);
      if (p) {
        setProduct(p);
        setStage("form");
      } else {
        setStage("not-found");
      }
    })();
  }, [params.slug]);

  // Clean up any polling interval on unmount.
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function createOrder(): Promise<Order> {
    if (!product) throw new Error("No product");
    return submitOrder({
      batchId: product.batchId,
      productId: product.id,
      productName: product.name,
      quantity,
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      itemAmount: product.price * quantity,
    });
  }

  async function handlePaystack(e: FormEvent) {
    e.preventDefault();
    if (!product) return;
    setPaymentError(null);
    setStage("redirecting");
    try {
      const order = await createOrder();
      // Confirmation happens server-side (webhook + callback), which sends the
      // customer to /payment/success.
      const { redirectUrl } = await initiateItemPayment(order.id);
      window.location.href = redirectUrl;
    } catch (err) {
      setPaymentError(
        err instanceof Error ? err.message : "Could not start payment.",
      );
      setStage("form");
    }
  }

  async function handleGafiaPay() {
    if (!product) return;
    setPaymentError(null);
    // GafiaPay needs a BVN or NIN (11 digits).
    if (!/^\d{11}$/.test(identityNumber.trim())) {
      setPaymentError("Enter a valid 11-digit BVN or NIN to pay by transfer.");
      return;
    }
    setStage("redirecting");
    try {
      const order = await createOrder();
      const account = await initiateItemPaymentGafia(order.id, {
        bvn: identityNumber.trim(),
      });
      setGafiaAccount(account);
      setStage("gafia-waiting");
      // Poll the order until the GafiaPay webhook marks the item paid.
      pollRef.current = setInterval(async () => {
        const fresh = await getOrder(order.id);
        if (fresh?.itemPayment.paid) {
          if (pollRef.current) clearInterval(pollRef.current);
          setGafiaPaid(true);
        }
      }, 5000);
    } catch (err) {
      setPaymentError(
        err instanceof Error ? err.message : "Could not start GafiaPay payment.",
      );
      setStage("form");
    }
  }

  if (stage === "loading") {
    return (
      <PublicShell>
        <p className="text-ink-soft text-center py-16">Loading…</p>
      </PublicShell>
    );
  }

  if (stage === "not-found") {
    return (
      <PublicShell>
        <Card className="p-8 text-center">
          <p className="text-ink font-medium">Product not found</p>
          <p className="text-ink-soft text-sm mt-1">
            This link may have expired or been removed.
          </p>
        </Card>
      </PublicShell>
    );
  }

  if (stage === "redirecting") {
    return (
      <PublicShell>
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <Loader2 size={40} className="animate-spin text-primary" />
          <p className="text-ink font-medium">Setting up your payment…</p>
          <p className="text-ink-soft text-sm">Please don&apos;t close this window.</p>
        </div>
      </PublicShell>
    );
  }

  if (stage === "gafia-waiting" && gafiaAccount) {
    return (
      <PublicShell>
        <GafiaWaiting account={gafiaAccount} paid={gafiaPaid} />
      </PublicShell>
    );
  }

  if (!product) return null;

  const total = product.price * quantity;

  return (
    <PublicShell>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={product.imageUrl}
        alt={product.name}
        className="w-full aspect-square rounded-2xl object-cover border border-border"
      />
      <h1 className="text-2xl font-bold text-ink mt-4">{product.name}</h1>
      <p className="text-ink-soft mt-1">{product.description}</p>

      {product.attributes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {product.attributes.map((attr, i) => (
            <span key={i} className="badge badge-neutral">
              {attr.label}: {attr.value}
            </span>
          ))}
        </div>
      )}

      <p className="text-2xl font-bold text-primary-dark mt-3">{formatNaira(product.price)}</p>

      <form onSubmit={handlePaystack} className="flex flex-col gap-4 mt-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink">Quantity</span>
          <QuantityStepper value={quantity} onChange={setQuantity} />
        </div>

        <Card className="p-4 flex items-center justify-between bg-cream-dark border-none">
          <span className="text-sm font-medium text-ink-soft">Total</span>
          <span className="text-xl font-bold text-ink">{formatNaira(total)}</span>
        </Card>

        <hr className="border-border" />

        <PublicField label="Full name">
          <input
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Your name"
            className={inputClass}
          />
        </PublicField>
        <PublicField label="Phone number">
          <input
            required
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="e.g. 08031234567"
            className={inputClass}
          />
        </PublicField>
        <PublicField label="Email">
          <input
            required
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
          />
        </PublicField>
        <PublicField label="Delivery address">
          <textarea
            required
            rows={2}
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            placeholder="Street, city, state"
            className={`${inputClass} resize-none`}
          />
        </PublicField>

        <PublicField label="BVN or NIN (only needed to pay by bank transfer)">
          <input
            inputMode="numeric"
            value={identityNumber}
            onChange={(e) =>
              setIdentityNumber(e.target.value.replace(/\D/g, "").slice(0, 11))
            }
            placeholder="11-digit BVN or NIN"
            className={inputClass}
          />
        </PublicField>

        {paymentError && <p className="text-sm text-danger">{paymentError}</p>}

        {/* Two payment options */}
        <Button type="submit" fullWidth className="mt-1 text-lg py-4">
          Pay with Paystack · {formatNaira(total)}
        </Button>
        <div className="flex items-center gap-3 text-xs text-ink-soft">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>
        <Button
          type="button"
          variant="secondary"
          fullWidth
          className="text-lg py-4"
          onClick={handleGafiaPay}
        >
          Pay with GafiaPay (Bank Transfer)
        </Button>
      </form>
    </PublicShell>
  );
}

function GafiaWaiting({
  account,
  paid,
}: {
  account: GafiaAccount;
  paid: boolean;
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(account.accountNumber).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  if (paid) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-10">
        <CheckCircle2 size={52} className="text-success" />
        <h1 className="text-xl font-bold text-ink">Payment received!</h1>
        <p className="text-ink-soft text-sm max-w-xs">
          Thank you. Your transfer has been confirmed and your order is
          received. We&apos;ll reach out on WhatsApp about shipping.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <h1 className="text-xl font-bold text-ink">Transfer to pay</h1>
        <p className="text-ink-soft text-sm mt-1">
          Send exactly {formatNaira(account.amount)} to this account. We&apos;ll
          confirm automatically once it arrives.
        </p>
      </div>

      <Card className="p-5">
        <Row label="Bank" value={account.bankName} />
        <div className="flex items-center justify-between gap-3 py-2 border-t border-border/50">
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-soft">Account number</p>
            <p className="text-lg font-mono font-bold text-ink">
              {account.accountNumber}
            </p>
          </div>
          <button
            onClick={copy}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-cream-dark"
          >
            <Copy size={16} />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <Row label="Account name" value={account.accountName} />
        <Row label="Amount" value={formatNaira(account.amount)} />
      </Card>

      <div className="flex items-center justify-center gap-2 text-ink-soft text-sm py-2">
        <Loader2 size={18} className="animate-spin" />
        Waiting for your transfer…
      </div>
      <p className="text-xs text-ink-soft text-center">
        Keep this page open. It updates automatically when your payment is
        confirmed.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-t border-border/50 first:border-t-0">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="text-sm font-semibold text-ink">{value}</span>
    </div>
  );
}

function PublicField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex justify-center px-4 py-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-5">
          <span className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-sm">
            R
          </span>
          <span className="font-bold text-ink">Raneems</span>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-primary";

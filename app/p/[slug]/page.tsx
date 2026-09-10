"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  confirmMockItemPayment,
  getProductBySlug,
  initiateItemPayment,
  submitOrder,
} from "@/lib/api";
import { Order, Product } from "@/lib/types";
import { formatNaira } from "@/lib/format";
import { QuantityStepper } from "@/components/QuantityStepper";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

type Stage = "loading" | "not-found" | "form" | "redirecting" | "success";

export default function PublicProductPage() {
  const params = useParams<{ slug: string }>();
  const [stage, setStage] = useState<Stage>("loading");
  const [product, setProduct] = useState<Product | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

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

  async function handlePayNow(e: FormEvent) {
    e.preventDefault();
    if (!product) return;
    setStage("redirecting");

    // 1. Create the order (item payment still pending).
    // TODO: replace with real API call in lib/api.ts (submitOrder)
    const createdOrder = await submitOrder({
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

    // 2. Simulate redirecting to Paystack.
    // TODO: replace with a real Paystack redirect (window.location = authorization_url)
    await initiateItemPayment(createdOrder.id);

    // 3. Simulate the payment succeeding and the webhook confirming it.
    // TODO: replace with real payment verification / webhook handling
    const confirmed = await confirmMockItemPayment(createdOrder.id);

    setOrder(confirmed ?? createdOrder);
    setStage("success");
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
          <p className="text-ink font-medium">Redirecting to payment…</p>
          <p className="text-ink-soft text-sm">Please don&apos;t close this window.</p>
        </div>
      </PublicShell>
    );
  }

  if (stage === "success" && order) {
    return (
      <PublicShell>
        <div className="flex flex-col items-center text-center gap-3 py-10">
          <CheckCircle2 size={52} className="text-success" />
          <h1 className="text-xl font-bold text-ink">Payment successful!</h1>
          <p className="text-ink-soft text-sm max-w-xs">
            Thanks {order.customerName.split(" ")[0]}, your order{" "}
            <span className="font-semibold text-ink">{order.orderReference}</span> has been
            received. We&apos;ll reach out on WhatsApp about shipping.
          </p>
          <Card className="p-4 w-full text-left mt-4">
            <Row label="Order ref" value={order.orderReference} />
            <Row label="Product" value={`${order.productName} × ${order.quantity}`} />
            <Row label="Amount paid" value={formatNaira(order.itemPayment.amount)} />
          </Card>
        </div>
      </PublicShell>
    );
  }

  if (!product) return null;

  const total = product.price * quantity;

  return (
    <PublicShell>
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

      <form onSubmit={handlePayNow} className="flex flex-col gap-4 mt-6">
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

        <Button type="submit" fullWidth className="mt-2 text-lg py-4">
          Pay Now · {formatNaira(total)}
        </Button>
      </form>
    </PublicShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
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

"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  MessageCircle,
  PackageCheck,
  Truck,
} from "lucide-react";
import {
  generateShipmentLink,
  getOrder,
  setDispatchStatus,
  setShippingCost,
} from "@/lib/api";
import { Order } from "@/lib/types";
import { buildWhatsAppLink, formatDateTime, formatNaira } from "@/lib/format";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { DispatchBadge, PaymentBadge } from "@/components/Badges";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const [shippingAmount, setShippingAmount] = useState("");
  const [shipmentLink, setShipmentLink] = useState("");
  const [generating, setGenerating] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const o = await getOrder(params.id);
    setOrder(o ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (loading) return <p className="text-ink-soft text-sm">Loading…</p>;
  if (!order)
    return (
      <Card className="p-8 text-center">
        <p className="text-ink font-medium">Order not found</p>
        <Link href="/orders" className="text-primary text-sm font-medium mt-2 inline-block">
          Back to orders
        </Link>
      </Card>
    );

  const readyToDispatch = order.itemPayment.paid && order.shippingPayment.paid;

  async function handleGenerateLink(e: FormEvent) {
    e.preventDefault();
    if (!shippingAmount || !order) return;
    setGenerating(true);
    // TODO: replace with real API calls in lib/api.ts (setShippingCost, generateShipmentLink)
    const updated = await setShippingCost(order.id, Number(shippingAmount));
    const { url } = await generateShipmentLink(order.id);
    if (updated) setOrder(updated);
    setShipmentLink(url);
    setGenerating(false);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(shipmentLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    });
  }

  function handleSendWhatsApp() {
    if (!order) return;
    const message = `Hi ${order.customerName.split(" ")[0]}, here's your shipping payment link for order ${order.orderReference} (${formatNaira(
      Number(shippingAmount),
    )}): ${shipmentLink}`;
    window.open(buildWhatsAppLink(order.customerPhone, message), "_blank");
  }

  async function handleSetDispatch(status: "dispatched" | "delivered") {
    if (!order) return;
    setBusy(true);
    const updated = await setDispatchStatus(order.id, status);
    if (updated) setOrder(updated);
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
      >
        <ArrowLeft size={16} />
        Orders
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{order.orderReference}</h1>
          <p className="text-sm text-ink-soft mt-1">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <DispatchBadge status={order.dispatchStatus} />
      </div>

      {readyToDispatch && order.dispatchStatus !== "delivered" && (
        <Card className="p-4 bg-success-bg border-none flex items-center gap-3">
          <PackageCheck className="text-success shrink-0" size={22} />
          <div>
            <p className="font-semibold text-success">Ready to dispatch</p>
            <p className="text-sm text-ink mt-0.5">{order.deliveryAddress}</p>
          </div>
        </Card>
      )}

      {/* Customer */}
      <Card className="p-4">
        <SectionTitle>Customer</SectionTitle>
        <Row label="Name" value={order.customerName} />
        <Row label="Phone" value={order.customerPhone} />
        <Row label="Email" value={order.customerEmail} />
        <Row label="Delivery address" value={order.deliveryAddress} />
      </Card>

      {/* Product */}
      <Card className="p-4">
        <SectionTitle>Product</SectionTitle>
        <Row label="Item" value={order.productName} />
        <Row label="Quantity" value={String(order.quantity)} />
      </Card>

      {/* Item payment */}
      <Card className="p-4">
        <SectionTitle>Item payment</SectionTitle>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-sm text-ink-soft">Status</span>
          <PaymentBadge paid={order.itemPayment.paid} label="Item" />
        </div>
        <Row label="Amount" value={formatNaira(order.itemPayment.amount)} />
        <Row label="Paid at" value={formatDateTime(order.itemPayment.paidAt)} />
      </Card>

      {/* Shipping payment */}
      <Card className="p-4">
        <SectionTitle>Shipping payment</SectionTitle>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-sm text-ink-soft">Status</span>
          <PaymentBadge paid={order.shippingPayment.paid} label="Shipping" />
        </div>
        {order.shippingPayment.paid ? (
          <>
            <Row label="Amount" value={formatNaira(order.shippingPayment.amount)} />
            <Row label="Paid at" value={formatDateTime(order.shippingPayment.paidAt)} />
          </>
        ) : order.itemPayment.paid ? (
          <div className="flex flex-col gap-3 mt-2">
            <form onSubmit={handleGenerateLink} className="flex flex-col gap-2">
              <label htmlFor="ship-amount" className="text-sm font-medium text-ink">
                Shipping / import cost for this customer (₦)
              </label>
              <input
                id="ship-amount"
                type="number"
                min="0"
                required
                value={shippingAmount}
                onChange={(e) => setShippingAmount(e.target.value)}
                placeholder="e.g. 4500"
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button type="submit" disabled={generating || !shippingAmount}>
                <Truck size={18} />
                {generating ? "Generating…" : "Generate Shipment Link"}
              </Button>
            </form>

            {shipmentLink && (
              <div className="flex flex-col gap-2 bg-cream-dark rounded-xl p-3">
                <p className="text-xs font-medium text-ink-soft break-all">{shipmentLink}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleCopyLink}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium text-ink hover:bg-white/70"
                  >
                    {linkCopied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                    {linkCopied ? "Copied!" : "Copy Link"}
                  </button>
                  <button
                    onClick={handleSendWhatsApp}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] text-white px-3 py-2.5 text-sm font-semibold hover:opacity-90"
                  >
                    <MessageCircle size={16} />
                    Send via WhatsApp
                  </button>
                </div>
              </div>
            )}

            <p className="text-xs text-ink-soft border-t border-border pt-3 mt-1">
              Once the customer pays this link, Paystack confirms it
              automatically and the order moves to “ready to dispatch”.
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink-soft mt-2">
            Waiting on the item payment before shipping can be arranged.
          </p>
        )}
      </Card>

      {/* Dispatch controls */}
      <Card className="p-4">
        <SectionTitle>Dispatch</SectionTitle>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button
            variant={order.dispatchStatus === "dispatched" ? "secondary" : "primary"}
            disabled={!readyToDispatch || busy || order.dispatchStatus === "delivered"}
            onClick={() => handleSetDispatch("dispatched")}
          >
            <Truck size={18} />
            {order.dispatchStatus === "dispatched" || order.dispatchStatus === "delivered"
              ? "Dispatched"
              : "Mark Dispatched"}
          </Button>
          <Button
            variant={order.dispatchStatus === "delivered" ? "secondary" : "primary"}
            disabled={busy || order.dispatchStatus !== "dispatched"}
            onClick={() => handleSetDispatch("delivered")}
          >
            <PackageCheck size={18} />
            {order.dispatchStatus === "delivered" ? "Delivered" : "Mark Delivered"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">
      {children}
    </p>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-sm text-ink-soft shrink-0">{label}</span>
      <span className="text-sm font-medium text-ink text-right">{value}</span>
    </div>
  );
}

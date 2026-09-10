"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { getOrder } from "@/lib/api";
import { Order } from "@/lib/types";
import { formatNaira } from "@/lib/format";
import { Card } from "@/components/Card";

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={null}>
      <PaymentSuccessInner />
    </Suspense>
  );
}

function PaymentSuccessInner() {
  const params = useSearchParams();
  const orderId = params.get("order");
  const pending = params.get("status") === "pending";
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!orderId) return;
    getOrder(orderId).then((o) => setOrder(o ?? null));
  }, [orderId]);

  return (
    <div className="min-h-screen flex justify-center px-4 py-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-5">
          <span className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-sm">
            R
          </span>
          <span className="font-bold text-ink">Raneems</span>
        </div>

        <div className="flex flex-col items-center text-center gap-3 py-10">
          {pending ? (
            <>
              <Clock size={52} className="text-warning" />
              <h1 className="text-xl font-bold text-ink">Payment processing</h1>
              <p className="text-ink-soft text-sm max-w-xs">
                We&apos;re confirming your payment. This can take a moment — you&apos;ll
                get a WhatsApp message once it&apos;s confirmed.
              </p>
            </>
          ) : (
            <>
              <CheckCircle2 size={52} className="text-success" />
              <h1 className="text-xl font-bold text-ink">Payment successful!</h1>
              <p className="text-ink-soft text-sm max-w-xs">
                Thank you{order ? `, ${order.customerName.split(" ")[0]}` : ""}. Your
                payment has been received.
              </p>
            </>
          )}

          {order && (
            <Card className="p-4 w-full text-left mt-4">
              <Row label="Order ref" value={order.orderReference} />
              <Row
                label="Product"
                value={`${order.productName} × ${order.quantity}`}
              />
              {order.itemPayment.paid && (
                <Row label="Item paid" value={formatNaira(order.itemPayment.amount)} />
              )}
              {order.shippingPayment.paid && (
                <Row
                  label="Shipping paid"
                  value={formatNaira(order.shippingPayment.amount)}
                />
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
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

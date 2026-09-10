"use client";

import { useEffect, useState } from "react";
import { Printer, Truck } from "lucide-react";
import { listReadyToDispatch } from "@/lib/api";
import { Order } from "@/lib/types";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { DispatchBadge } from "@/components/Badges";

export default function DispatchPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listReadyToDispatch().then((data) => {
      setOrders(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-ink">Ready to Dispatch</h1>
          <p className="text-sm text-ink-soft mt-1">Hand this list to your delivery driver.</p>
        </div>
        {orders.length > 0 && (
          <Button variant="secondary" onClick={() => window.print()} className="!px-4 !py-2.5 text-sm">
            <Printer size={18} />
            Print
          </Button>
        )}
      </div>

      <div className="hidden print:block mb-2">
        <h1 className="text-xl font-bold">Raneems — Dispatch List</h1>
        <p className="text-sm text-ink-soft">{new Date().toLocaleString("en-NG")}</p>
      </div>

      {loading ? (
        <p className="text-ink-soft text-sm no-print">Loading…</p>
      ) : orders.length === 0 ? (
        <Card className="p-8 text-center no-print">
          <Truck className="mx-auto text-ink-soft mb-2" size={28} />
          <p className="text-ink font-medium">Nothing ready to dispatch right now</p>
          <p className="text-ink-soft text-sm mt-1">
            Orders appear here once both item and shipping payments are confirmed.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order, i) => (
            <Card key={order.id} className="p-4 print:border print:shadow-none break-inside-avoid">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">
                    {i + 1}. {order.customerName}
                  </p>
                  <p className="text-sm text-ink-soft">{order.customerPhone}</p>
                </div>
                <span className="no-print">
                  <DispatchBadge status={order.dispatchStatus} />
                </span>
              </div>
              <p className="text-sm text-ink mt-2">{order.deliveryAddress}</p>
              <p className="text-sm text-ink-soft mt-2">
                {order.productName} × {order.quantity} · {order.orderReference}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

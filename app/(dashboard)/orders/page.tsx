"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteAbandonedOrders, listBatches, listOrders } from "@/lib/api";
import { Batch, DispatchStatus, Order } from "@/lib/types";
import { OrderCard } from "@/components/OrderCard";
import { Card } from "@/components/Card";
import { useToast } from "@/lib/toast-context";

const DISPATCH_OPTIONS: { value: DispatchStatus; label: string }[] = [
  { value: "awaiting_item_payment", label: "Awaiting item payment" },
  { value: "awaiting_shipping_payment", label: "Awaiting shipping payment" },
  { value: "ready_to_dispatch", label: "Ready to dispatch" },
  { value: "dispatched", label: "Dispatched" },
  { value: "delivered", label: "Delivered" },
];

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersPageInner />
    </Suspense>
  );
}

function OrdersPageInner() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);

  const [batchId, setBatchId] = useState(searchParams.get("batchId") ?? "");
  const [itemPaid, setItemPaid] = useState(searchParams.get("itemPaid") ?? "");
  const [shippingPaid, setShippingPaid] = useState(searchParams.get("shippingPaid") ?? "");
  const [dispatchStatus, setDispatchStatus] = useState(searchParams.get("dispatchStatus") ?? "");

  useEffect(() => {
    listBatches().then(setBatches);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    return listOrders({
      batchId: batchId || undefined,
      itemPaid: itemPaid ? itemPaid === "true" : undefined,
      shippingPaid: shippingPaid ? shippingPaid === "true" : undefined,
      dispatchStatus: (dispatchStatus as DispatchStatus) || undefined,
    }).then((data) => {
      setOrders(data);
      setLoading(false);
    });
  }, [batchId, itemPaid, shippingPaid, dispatchStatus]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCleanup() {
    setCleaning(true);
    try {
      const removed = await deleteAbandonedOrders(60);
      toast.success(
        removed > 0
          ? `Removed ${removed} abandoned ${removed === 1 ? "order" : "orders"}`
          : "No abandoned orders to remove",
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cleanup failed.");
    } finally {
      setCleaning(false);
    }
  }

  const viewingUnconfirmed = dispatchStatus === "awaiting_item_payment";
  const hasFilters = batchId || itemPaid || shippingPaid || dispatchStatus;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold text-ink">Orders</h1>

      <Card className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Select label="Batch" value={batchId} onChange={setBatchId}>
            <option value="">All batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select label="Item payment" value={itemPaid} onChange={setItemPaid}>
            <option value="">Any</option>
            <option value="true">Paid</option>
            <option value="false">Unpaid</option>
          </Select>
          <Select label="Shipping payment" value={shippingPaid} onChange={setShippingPaid}>
            <option value="">Any</option>
            <option value="true">Paid</option>
            <option value="false">Unpaid</option>
          </Select>
          <Select label="Dispatch status" value={dispatchStatus} onChange={setDispatchStatus}>
            <option value="">Any</option>
            {DISPATCH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        {hasFilters && (
          <button
            onClick={() => {
              setBatchId("");
              setItemPaid("");
              setShippingPaid("");
              setDispatchStatus("");
            }}
            className="text-sm font-medium text-primary mt-3"
          >
            Clear filters
          </button>
        )}
      </Card>

      {viewingUnconfirmed && (
        <Card className="p-4 flex items-start justify-between gap-3 bg-warning-bg border-none">
          <p className="text-sm text-ink">
            These are unconfirmed checkout attempts — orders where the customer
            started but never completed the item payment. Clear out old ones to
            keep things tidy.
          </p>
          <button
            onClick={handleCleanup}
            disabled={cleaning}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-cream-dark disabled:opacity-50"
          >
            <Trash2 size={16} />
            {cleaning ? "Cleaning…" : "Clean up (1h+)"}
          </button>
        </Card>
      )}

      {loading ? (
        <p className="text-ink-soft text-sm">Loading orders…</p>
      ) : orders.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-ink font-medium">No orders match these filters</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-white px-2.5 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {children}
      </select>
    </label>
  );
}

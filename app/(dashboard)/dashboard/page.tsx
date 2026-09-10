"use client";

import { useEffect, useState } from "react";
import { Package, Truck, Clock } from "lucide-react";
import Link from "next/link";
import { listBatches, listOrders } from "@/lib/api";
import { Card } from "@/components/Card";
import { LinkButton } from "@/components/Button";

export default function DashboardHomePage() {
  const [loading, setLoading] = useState(true);
  const [openBatches, setOpenBatches] = useState(0);
  const [awaitingShipping, setAwaitingShipping] = useState(0);
  const [readyToDispatch, setReadyToDispatch] = useState(0);

  useEffect(() => {
    (async () => {
      const [batches, orders] = await Promise.all([listBatches(), listOrders()]);
      setOpenBatches(batches.filter((b) => b.status === "open").length);
      setAwaitingShipping(
        orders.filter((o) => o.dispatchStatus === "awaiting_shipping_payment").length,
      );
      setReadyToDispatch(
        orders.filter(
          (o) =>
            o.itemPayment.paid && o.shippingPayment.paid && o.dispatchStatus !== "delivered",
        ).length,
      );
      setLoading(false);
    })();
  }, []);

  const stats = [
    {
      label: "Open batches",
      value: openBatches,
      icon: Package,
      color: "text-primary",
      bg: "bg-primary-light",
      href: "/batches",
    },
    {
      label: "Awaiting shipping payment",
      value: awaitingShipping,
      icon: Clock,
      color: "text-warning",
      bg: "bg-warning-bg",
      href: "/orders?shippingPaid=false&itemPaid=true",
    },
    {
      label: "Ready to dispatch",
      value: readyToDispatch,
      icon: Truck,
      color: "text-info",
      bg: "bg-info-bg",
      href: "/dispatch",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Welcome back 👋</h1>
        <p className="text-ink-soft mt-1">Here&apos;s what&apos;s happening today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link key={label} href={href} className="block">
            <Card className="p-5 w-full flex items-center gap-4 hover:border-primary/40 transition-colors">
              <span className={`w-11 h-11 rounded-xl ${bg} ${color} flex items-center justify-center shrink-0`}>
                <Icon size={22} />
              </span>
              <span className="flex flex-col text-left">
                <span className="text-2xl font-bold text-ink leading-none">
                  {loading ? "…" : value}
                </span>
                <span className="text-sm text-ink-soft mt-1">{label}</span>
              </span>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <LinkButton href="/batches?new=true" fullWidth className="py-5 text-lg">
          + New Batch
        </LinkButton>
        <LinkButton href="/orders" variant="secondary" fullWidth className="py-5 text-lg">
          View Orders
        </LinkButton>
      </div>
    </div>
  );
}

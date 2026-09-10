import Link from "next/link";
import { Order } from "@/lib/types";
import { DispatchBadge, PaymentBadge } from "@/components/Badges";
import { Card } from "@/components/Card";

export function OrderCard({ order }: { order: Order }) {
  return (
    <Link href={`/orders/${order.id}`}>
      <Card className="p-4 hover:border-primary/40 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-ink truncate">{order.customerName}</p>
            <p className="text-sm text-ink-soft">{order.customerPhone}</p>
          </div>
          <span className="text-xs font-mono text-ink-soft shrink-0 mt-0.5">
            {order.orderReference}
          </span>
        </div>
        <p className="text-sm text-ink mt-2">
          {order.productName} <span className="text-ink-soft">× {order.quantity}</span>
        </p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <PaymentBadge paid={order.itemPayment.paid} label="Item" />
          <PaymentBadge paid={order.shippingPayment.paid} label="Shipping" />
          <DispatchBadge status={order.dispatchStatus} />
        </div>
      </Card>
    </Link>
  );
}

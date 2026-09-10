import { DispatchStatus } from "@/lib/types";

export function PaymentBadge({ paid, label }: { paid: boolean; label: string }) {
  return (
    <span className={`badge ${paid ? "badge-success" : "badge-danger"}`}>
      <span className="badge-dot" />
      {label}: {paid ? "Paid" : "Unpaid"}
    </span>
  );
}

const DISPATCH_LABELS: Record<DispatchStatus, string> = {
  awaiting_item_payment: "Awaiting item payment",
  awaiting_shipping_payment: "Awaiting shipping payment",
  ready_to_dispatch: "Ready to dispatch",
  dispatched: "Dispatched",
  delivered: "Delivered",
};

const DISPATCH_STYLES: Record<DispatchStatus, string> = {
  awaiting_item_payment: "badge-danger",
  awaiting_shipping_payment: "badge-warning",
  ready_to_dispatch: "badge-info",
  dispatched: "badge-info",
  delivered: "badge-success",
};

export function DispatchBadge({ status }: { status: DispatchStatus }) {
  return (
    <span className={`badge ${DISPATCH_STYLES[status]}`}>
      <span className="badge-dot" />
      {DISPATCH_LABELS[status]}
    </span>
  );
}

export function BatchStatusBadge({ status }: { status: "open" | "closed" }) {
  return (
    <span className={`badge ${status === "open" ? "badge-success" : "badge-neutral"}`}>
      <span className="badge-dot" />
      {status === "open" ? "Open" : "Closed"}
    </span>
  );
}

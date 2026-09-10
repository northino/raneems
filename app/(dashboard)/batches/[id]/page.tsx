"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { getBatch, listProducts, setBatchStatus } from "@/lib/api";
import { Batch, Product } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { BatchStatusBadge } from "@/components/Badges";
import { ProductCard } from "@/components/ProductCard";
import { Card } from "@/components/Card";
import { LinkButton } from "@/components/Button";

export default function BatchDetailPage() {
  const params = useParams<{ id: string }>();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingStatus, setTogglingStatus] = useState(false);

  async function load() {
    setLoading(true);
    const [b, p] = await Promise.all([getBatch(params.id), listProducts(params.id)]);
    setBatch(b ?? null);
    setProducts(p);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function toggleStatus() {
    if (!batch) return;
    setTogglingStatus(true);
    const next = batch.status === "open" ? "closed" : "open";
    const updated = await setBatchStatus(batch.id, next);
    if (updated) setBatch(updated);
    setTogglingStatus(false);
  }

  if (loading) return <p className="text-ink-soft text-sm">Loading…</p>;
  if (!batch)
    return (
      <Card className="p-8 text-center">
        <p className="text-ink font-medium">Batch not found</p>
        <Link href="/batches" className="text-primary text-sm font-medium mt-2 inline-block">
          Back to batches
        </Link>
      </Card>
    );

  return (
    <div className="flex flex-col gap-5">
      <Link href="/batches" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft size={16} />
        Batches
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{batch.name}</h1>
          <p className="text-sm text-ink-soft mt-1">Created {formatDate(batch.createdAt)}</p>
        </div>
        <button
          onClick={toggleStatus}
          disabled={togglingStatus}
          className="shrink-0"
          title="Toggle batch status"
        >
          <BatchStatusBadge status={batch.status} />
        </button>
      </div>

      <LinkButton href={`/batches/${batch.id}/new-product`} fullWidth>
        <Plus size={20} />
        Add Product
      </LinkButton>

      {products.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-ink font-medium">No products in this batch yet</p>
          <p className="text-ink-soft text-sm mt-1">Tap &quot;Add Product&quot; to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Package, Plus, X } from "lucide-react";
import { countProductsInBatch, createBatch, listBatches } from "@/lib/api";
import { Batch } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { BatchStatusBadge } from "@/components/Badges";

export default function BatchesPage() {
  return (
    <Suspense fallback={null}>
      <BatchesPageInner />
    </Suspense>
  );
}

function BatchesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(searchParams.get("new") === "true");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const data = await listBatches();
    setBatches(data);
    const entries = await Promise.all(
      data.map(async (b) => [b.id, await countProductsInBatch(b.id)] as const),
    );
    setCounts(Object.fromEntries(entries));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    // TODO: replace with real API call in lib/api.ts (createBatch)
    const batch = await createBatch(name.trim());
    setSaving(false);
    setShowForm(false);
    setName("");
    router.push(`/batches/${batch.id}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Batches</h1>
        <Button onClick={() => setShowForm((s) => !s)} className="!px-4 !py-2.5 text-sm">
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? "Cancel" : "New Batch"}
        </Button>
      </div>

      {showForm && (
        <Card className="p-5">
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <label htmlFor="batch-name" className="text-sm font-medium text-ink">
              Batch name
            </label>
            <input
              id="batch-name"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Batch – October 2026"
              className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Creating…" : "Create Batch"}
            </Button>
          </form>
        </Card>
      )}

      {loading ? (
        <p className="text-ink-soft text-sm">Loading batches…</p>
      ) : batches.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-3">
          {batches.map((batch) => (
            <Link key={batch.id} href={`/batches/${batch.id}`}>
              <Card className="p-4 flex items-center gap-4 hover:border-primary/40 transition-colors">
                <span className="w-11 h-11 rounded-xl bg-primary-light text-primary-dark flex items-center justify-center shrink-0">
                  <Package size={20} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink truncate">{batch.name}</p>
                  <p className="text-sm text-ink-soft">
                    {formatDate(batch.createdAt)} · {counts[batch.id] ?? 0} product
                    {counts[batch.id] === 1 ? "" : "s"}
                  </p>
                </div>
                <BatchStatusBadge status={batch.status} />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="p-8 text-center">
      <p className="text-ink font-medium">No batches yet</p>
      <p className="text-ink-soft text-sm mt-1">
        Create your first batch to start adding products.
      </p>
    </Card>
  );
}

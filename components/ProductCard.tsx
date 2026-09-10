"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Pencil,
  Trash2,
} from "lucide-react";
import { Product } from "@/lib/types";
import { formatNaira } from "@/lib/format";
import { deleteProduct } from "@/lib/api";
import { Card } from "@/components/Card";
import { useToast } from "@/lib/toast-context";

export function ProductCard({
  product,
  batchId,
  onDeleted,
}: {
  product: Product;
  /** Enables Edit/Delete actions when provided (owner dashboard). */
  batchId?: string;
  onDeleted?: (productId: string) => void;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteProduct(product.id);
      toast.success("Product deleted");
      onDeleted?.(product.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete product.");
      setDeleting(false);
      setConfirming(false);
    }
  }

  function publicUrl() {
    if (typeof window === "undefined") return `/p/${product.publicSlug}`;
    return `${window.location.origin}/p/${product.publicSlug}`;
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(publicUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard API unavailable — no-op, user can still see/copy the link manually
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex gap-4 p-4">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-20 h-20 rounded-xl object-cover border border-border shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink truncate">{product.name}</p>
          <p className="text-sm text-ink-soft line-clamp-2 mt-0.5">{product.description}</p>
          <p className="font-bold text-primary-dark mt-1.5">{formatNaira(product.price)}</p>
        </div>
      </div>

      {product.attributes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {product.attributes.map((attr, i) => (
            <span key={i} className="badge badge-neutral">
              {attr.label}: {attr.value}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 px-4 pb-4">
        <button
          onClick={handleCopy}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium text-ink hover:bg-cream-dark transition-colors"
        >
          {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
          {copied ? "Copied!" : "Copy Link"}
        </button>
        <button
          onClick={() => setPreviewOpen((o) => !o)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium text-ink hover:bg-cream-dark transition-colors"
        >
          {previewOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {previewOpen ? "Hide Preview" : "Preview"}
        </button>
      </div>

      {batchId && (
        <div className="px-4 pb-4">
          {confirming ? (
            <div className="rounded-lg border border-danger/30 bg-danger-bg p-3">
              <p className="text-sm text-ink font-medium">Delete this product?</p>
              <p className="text-xs text-ink-soft mt-0.5">
                This also removes its image and can&apos;t be undone.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  onClick={() => setConfirming(false)}
                  disabled={deleting}
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium text-ink hover:bg-cream-dark"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-danger text-white px-3 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link
                href={`/batches/${batchId}/products/${product.id}/edit`}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium text-ink hover:bg-cream-dark transition-colors"
              >
                <Pencil size={16} />
                Edit
              </Link>
              <button
                onClick={() => setConfirming(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium text-danger hover:bg-danger-bg hover:border-danger/40 transition-colors"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      {previewOpen && (
        <div className="border-t border-border bg-cream-dark p-4">
          <p className="text-xs font-medium text-ink-soft mb-2 uppercase tracking-wide">
            Public page preview
          </p>
          <div className="bg-white rounded-xl border border-border p-4 max-w-xs mx-auto">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full aspect-square rounded-lg object-cover mb-3"
            />
            <p className="font-bold text-ink">{product.name}</p>
            <p className="text-sm text-ink-soft mt-1">{product.description}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {product.attributes.map((attr, i) => (
                <span key={i} className="badge badge-neutral">
                  {attr.label}: {attr.value}
                </span>
              ))}
            </div>
            <p className="font-bold text-primary-dark text-lg mt-2">
              {formatNaira(product.price)}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

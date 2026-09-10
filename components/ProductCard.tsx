"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { Product } from "@/lib/types";
import { formatNaira } from "@/lib/format";
import { Card } from "@/components/Card";

export function ProductCard({ product }: { product: Product }) {
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

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

"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { createProduct } from "@/lib/api";
import { ProductAttribute } from "@/lib/types";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

export default function NewProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [attributes, setAttributes] = useState<ProductAttribute[]>([
    { label: "", value: "" },
  ]);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [saving, setSaving] = useState(false);

  function updateAttribute(index: number, field: keyof ProductAttribute, value: string) {
    setAttributes((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)),
    );
  }

  function addAttribute() {
    setAttributes((prev) => [...prev, { label: "", value: "" }]);
  }

  function removeAttribute(index: number) {
    setAttributes((prev) => prev.filter((_, i) => i !== index));
  }

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Mock upload: just preview locally via a data URL. A real backend
    // would upload this file and store the returned hosted URL instead.
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !price) return;
    setSaving(true);
    const cleanAttributes = attributes.filter((a) => a.label.trim() && a.value.trim());
    // TODO: replace with real API call in lib/api.ts (createProduct)
    const product = await createProduct({
      batchId: params.id,
      name: name.trim(),
      description: description.trim(),
      attributes: cleanAttributes,
      price: Number(price),
      imageUrl: imageUrl || placeholderFallback(name),
    });
    setSaving(false);
    router.push(`/batches/${product.batchId}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={`/batches/${params.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
      >
        <ArrowLeft size={16} />
        Back to batch
      </Link>

      <h1 className="text-2xl font-bold text-ink">Add Product</h1>

      <Card className="p-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Image */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Product image</label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-square max-w-[220px] rounded-xl border-2 border-dashed border-border bg-cream-dark flex flex-col items-center justify-center gap-2 text-ink-soft overflow-hidden"
            >
              {imageUrl ? (
                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <>
                  <ImagePlus size={28} />
                  <span className="text-sm font-medium">Tap to upload</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>

          {/* Name */}
          <Field label="Name" htmlFor="p-name">
            <input
              id="p-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Quilted Tote Bag"
              className={inputClass}
            />
          </Field>

          {/* Description */}
          <Field label="Description" htmlFor="p-desc">
            <textarea
              id="p-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description customers will see"
              className={`${inputClass} resize-none`}
            />
          </Field>

          {/* Attributes */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Attributes (optional)
            </label>
            <div className="flex flex-col gap-2">
              {attributes.map((attr, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={attr.label}
                    onChange={(e) => updateAttribute(i, "label", e.target.value)}
                    placeholder="Label (e.g. Size)"
                    className={inputClass}
                  />
                  <input
                    value={attr.value}
                    onChange={(e) => updateAttribute(i, "value", e.target.value)}
                    placeholder="Value (e.g. L)"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => removeAttribute(i)}
                    className="shrink-0 w-11 rounded-xl border border-border bg-white flex items-center justify-center text-ink-soft hover:text-danger hover:border-danger/40"
                    aria-label="Remove attribute"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addAttribute}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary"
            >
              <Plus size={16} />
              Add attribute
            </button>
          </div>

          {/* Price */}
          <Field label="Price (₦)" htmlFor="p-price">
            <input
              id="p-price"
              type="number"
              min="0"
              step="1"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 18500"
              className={inputClass}
            />
          </Field>

          <Button type="submit" disabled={saving || !name.trim() || !price} fullWidth>
            {saving ? "Saving…" : "Save Product"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function placeholderFallback(name: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'>
    <rect width='600' height='600' fill='#d9622b'/>
    <text x='50%' y='50%' font-family='Arial, sans-serif' font-size='36' fill='#fff'
      text-anchor='middle' dominant-baseline='middle'>${name.slice(0, 16) || "Product"}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const inputClass =
  "w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-primary";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { getProduct, updateProduct, uploadProductImage } from "@/lib/api";
import { ProductAttribute } from "@/lib/types";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useToast } from "@/lib/toast-context";

export default function EditProductPage() {
  const params = useParams<{ id: string; productId: string }>();
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  // currentImageUrl = what's saved now; previewUrl = what to show; imageFile =
  // a newly picked file (null means keep the current image).
  const [currentImageUrl, setCurrentImageUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const product = await getProduct(params.productId);
      if (!product) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setName(product.name);
      setDescription(product.description);
      setPrice(String(product.price));
      setAttributes(
        product.attributes.length ? product.attributes : [{ label: "", value: "" }],
      );
      setCurrentImageUrl(product.imageUrl);
      setPreviewUrl(product.imageUrl);
      setLoading(false);
    })();
  }, [params.productId]);

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
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !price) return;
    setSaving(true);
    setError(null);
    const cleanAttributes = attributes.filter((a) => a.label.trim() && a.value.trim());
    try {
      // Only upload if the user picked a new file; otherwise keep the current
      // image. updateProduct() deletes the old storage image when it changes.
      const hostedImageUrl = imageFile
        ? await uploadProductImage(imageFile)
        : currentImageUrl;
      await updateProduct(params.productId, {
        name: name.trim(),
        description: description.trim(),
        attributes: cleanAttributes,
        price: Number(price),
        imageUrl: hostedImageUrl,
      });
      toast.success("Product updated");
      router.push(`/batches/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update product.");
      setSaving(false);
    }
  }

  if (loading) return <p className="text-ink-soft text-sm">Loading…</p>;
  if (notFound)
    return (
      <Card className="p-8 text-center">
        <p className="text-ink font-medium">Product not found</p>
        <Link
          href={`/batches/${params.id}`}
          className="text-primary text-sm font-medium mt-2 inline-block"
        >
          Back to batch
        </Link>
      </Card>
    );

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={`/batches/${params.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
      >
        <ArrowLeft size={16} />
        Back to batch
      </Link>

      <h1 className="text-2xl font-bold text-ink">Edit Product</h1>

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
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <>
                  <ImagePlus size={28} />
                  <span className="text-sm font-medium">Tap to upload</span>
                </>
              )}
            </button>
            <p className="text-xs text-ink-soft mt-1.5">
              Tap the image to replace it. The old one is removed automatically.
            </p>
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

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="submit" disabled={saving || !name.trim() || !price} fullWidth>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </form>
      </Card>
    </div>
  );
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

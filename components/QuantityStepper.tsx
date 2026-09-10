"use client";

import { Minus, Plus } from "lucide-react";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="inline-flex items-center border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-11 h-11 flex items-center justify-center text-ink disabled:opacity-40 hover:bg-cream-dark"
        aria-label="Decrease quantity"
      >
        <Minus size={18} />
      </button>
      <span className="w-12 text-center font-semibold text-ink tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-11 h-11 flex items-center justify-center text-ink disabled:opacity-40 hover:bg-cream-dark"
        aria-label="Increase quantity"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}

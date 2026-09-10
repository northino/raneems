"use client";

import Link from "next/link";
import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-dark active:bg-primary-dark disabled:opacity-50",
  secondary:
    "bg-white text-ink border border-border hover:bg-cream-dark active:bg-cream-dark disabled:opacity-50",
  danger:
    "bg-danger text-white hover:opacity-90 active:opacity-90 disabled:opacity-50",
  ghost:
    "bg-transparent text-ink-soft hover:bg-cream-dark active:bg-cream-dark disabled:opacity-50",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-base px-5 py-3.5 transition-colors select-none";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  fullWidth,
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      className={`${BASE} ${VARIANT_CLASSES[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  fullWidth,
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${BASE} ${VARIANT_CLASSES[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {children}
    </Link>
  );
}

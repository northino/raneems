import { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-card border border-border rounded-2xl shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

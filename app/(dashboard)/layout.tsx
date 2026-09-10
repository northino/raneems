"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DashboardNav } from "@/components/DashboardNav";

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Wait for the session check, and don't flash protected UI when signed out.
  if (loading || !user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardNav />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-5 pb-24 md:px-6 md:pb-10">
        {children}
      </main>
    </div>
  );
}

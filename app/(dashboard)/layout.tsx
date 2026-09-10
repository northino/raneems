"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/api";
import { DashboardNav } from "@/components/DashboardNav";

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardNav />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-5 pb-24 md:px-6 md:pb-10">
        {children}
      </main>
    </div>
  );
}

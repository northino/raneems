"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Truck,
  Users,
  LogOut,
} from "lucide-react";
import { logout } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/batches", label: "Batches", icon: Package },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/dispatch", label: "Dispatch", icon: Truck },
  { href: "/admin/users", label: "Team", icon: Users },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <>
      {/* Top bar */}
      <header className="no-print sticky top-0 z-20 bg-cream/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3 md:px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold">
              R
            </span>
            <span className="font-bold text-lg text-ink">Raneems</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(pathname, href)
                    ? "bg-primary-light text-primary-dark"
                    : "text-ink-soft hover:bg-cream-dark"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
          </nav>
          <button
            onClick={handleLogout}
            className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-ink-soft hover:bg-cream-dark"
          >
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="no-print md:hidden fixed bottom-0 left-0 right-0 z-20 bg-card border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium ${
                  active ? "text-primary" : "text-ink-soft"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

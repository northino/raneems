"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // TODO: replace with real authentication in lib/api.ts
    const result = await login(email, password);
    setLoading(false);
    if (result.ok) {
      router.push("/dashboard");
    } else {
      setError(result.message ?? "Could not sign in. Try again.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <span className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center font-bold text-2xl mb-3">
            R
          </span>
          <h1 className="text-2xl font-bold text-ink">Raneems</h1>
          <p className="text-ink-soft text-sm mt-1">Manage batches &amp; orders</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@raneems.com"
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button type="submit" fullWidth disabled={loading} className="mt-2">
              {loading ? "Signing in…" : "Log In"}
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-ink-soft mt-6">
          Demo login — any email &amp; password works.
        </p>
      </div>
    </div>
  );
}

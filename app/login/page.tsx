"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { login } from "@/lib/api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useToast } from "@/lib/toast-context";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await login(email, password);
    if (result.ok) {
      toast.success("Signed in successfully");
      router.push("/dashboard");
    } else {
      setLoading(false);
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
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 pr-12 text-base text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center px-3.5 text-ink-soft hover:text-ink"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button type="submit" fullWidth disabled={loading} className="mt-2">
              {loading ? "Signing in…" : "Log In"}
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-ink-soft mt-6">
          Sign in with your Raneems account.
        </p>
      </div>
    </div>
  );
}

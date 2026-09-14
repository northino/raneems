"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, LogOut } from "lucide-react";
import { changePassword, logout } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useToast } from "@/lib/toast-context";

export default function AccountPage() {
  const toast = useToast();
  const router = useRouter();
  const { user } = useAuth();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (next !== confirm) {
      setError("New password and confirmation don't match.");
      return;
    }
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    const result = await changePassword(current, next);
    setSaving(false);

    if (result.ok) {
      toast.success("Password updated");
      setCurrent("");
      setNext("");
      setConfirm("");
    } else {
      setError(result.message ?? "Could not update password.");
    }
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">Account</h1>
        {user?.email && (
          <p className="text-ink-soft mt-1 text-sm">
            Signed in as <span className="font-medium text-ink">{user.email}</span>
          </p>
        )}
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound size={18} className="text-primary" />
          <h2 className="font-semibold text-ink">Change password</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Current password">
            <PasswordInput
              value={current}
              onChange={setCurrent}
              show={show}
              autoComplete="current-password"
              placeholder="Your current password"
            />
          </Field>
          <Field label="New password">
            <PasswordInput
              value={next}
              onChange={setNext}
              show={show}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </Field>
          <Field label="Confirm new password">
            <PasswordInput
              value={confirm}
              onChange={setConfirm}
              show={show}
              autoComplete="new-password"
              placeholder="Re-enter new password"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
              className="rounded border-border"
            />
            Show passwords
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button
            type="submit"
            disabled={saving || !current || !next || !confirm}
          >
            {saving ? "Updating…" : "Update password"}
          </Button>
        </form>
      </Card>

      {/* Logout — handy on mobile, where the top-bar logout is hidden. */}
      <Button
        variant="secondary"
        onClick={handleLogout}
        className="md:hidden"
        fullWidth
      >
        <LogOut size={18} />
        Log out
      </Button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  show,
  autoComplete,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  autoComplete: string;
  placeholder: string;
}) {
  const [localShow, setLocalShow] = useState(false);
  const visible = show || localShow;
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-white px-4 py-3 pr-12 text-base text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <button
        type="button"
        onClick={() => setLocalShow((s) => !s)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex items-center px-3.5 text-ink-soft hover:text-ink"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { Check, Copy, UserPlus } from "lucide-react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useToast } from "@/lib/toast-context";

interface CreatedUser {
  email: string;
  password: string;
}

export default function AdminUsersPage() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedUser | null>(null);
  const [copied, setCopied] = useState<"email" | "password" | "both" | null>(
    null,
  );

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    setCreated(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not create user.");
      setCreated({ email: json.email, password: json.password });
      setEmail("");
      toast.success("User created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create user.");
    } finally {
      setSaving(false);
    }
  }

  function copy(text: string, which: "email" | "password" | "both") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(null), 1800);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">Team members</h1>
        <p className="text-ink-soft mt-1 text-sm">
          Create a login for someone on your team. A secure password is
          generated automatically — copy and share it with them.
        </p>
      </div>

      <Card className="p-5">
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <label htmlFor="new-user-email" className="text-sm font-medium text-ink">
            Email address
          </label>
          <input
            id="new-user-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@raneems.com"
            className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Button type="submit" disabled={saving || !email.trim()}>
            <UserPlus size={18} />
            {saving ? "Creating…" : "Create user"}
          </Button>
        </form>
      </Card>

      {created && (
        <Card className="p-5 bg-success-bg border-none">
          <p className="font-semibold text-success mb-1">User created</p>
          <p className="text-sm text-ink-soft mb-4">
            Share these credentials with the new team member. This password
            won&apos;t be shown again — copy it now.
          </p>

          <CredentialRow
            label="Email"
            value={created.email}
            copied={copied === "email"}
            onCopy={() => copy(created.email, "email")}
          />
          <CredentialRow
            label="Password"
            value={created.password}
            mono
            copied={copied === "password"}
            onCopy={() => copy(created.password, "password")}
          />

          <button
            onClick={() =>
              copy(
                `Email: ${created.email}\nPassword: ${created.password}`,
                "both",
              )
            }
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary"
          >
            {copied === "both" ? (
              <Check size={16} className="text-success" />
            ) : (
              <Copy size={16} />
            )}
            {copied === "both" ? "Copied!" : "Copy both"}
          </button>
        </Card>
      )}
    </div>
  );
}

function CredentialRow({
  label,
  value,
  mono,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-t border-border/50 first:border-t-0">
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-soft">{label}</p>
        <p className={`text-sm text-ink truncate ${mono ? "font-mono" : ""}`}>
          {value}
        </p>
      </div>
      <button
        onClick={onCopy}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-cream-dark"
      >
        {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

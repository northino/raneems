"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, Copy, Trash2, UserPlus, Users } from "lucide-react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useToast } from "@/lib/toast-context";
import { formatDate } from "@/lib/format";

interface CreatedUser {
  email: string;
  password: string;
}

interface TeamUser {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  isSelf: boolean;
}

export default function AdminUsersPage() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedUser | null>(null);
  const [copied, setCopied] = useState<"email" | "password" | "both" | null>(
    null,
  );

  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load users.");
      setUsers(json.users as TeamUser[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load users.");
    } finally {
      setLoadingUsers(false);
    }
  }, [toast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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
      loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create user.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not delete user.");
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success("User deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete user.");
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
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

      {/* Existing users */}
      <div>
        <h2 className="text-lg font-bold text-ink mb-2">
          Users {users.length > 0 && (
            <span className="text-ink-soft font-medium">({users.length})</span>
          )}
        </h2>

        {loadingUsers ? (
          <p className="text-ink-soft text-sm">Loading users…</p>
        ) : users.length === 0 ? (
          <Card className="p-8 text-center">
            <Users className="mx-auto text-ink-soft mb-2" size={26} />
            <p className="text-ink font-medium">No users yet</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {users.map((u) => (
              <Card key={u.id} className="p-4">
                {confirmingId === u.id ? (
                  <div>
                    <p className="text-sm text-ink font-medium">
                      Delete {u.email}?
                    </p>
                    <p className="text-xs text-ink-soft mt-0.5">
                      They&apos;ll lose access immediately. This can&apos;t be undone.
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button
                        onClick={() => setConfirmingId(null)}
                        disabled={deletingId === u.id}
                        className="inline-flex items-center justify-center rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium text-ink hover:bg-cream-dark"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(u.id)}
                        disabled={deletingId === u.id}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-danger text-white px-3 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                        {deletingId === u.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink truncate">
                        {u.email}
                        {u.isSelf && (
                          <span className="ml-2 badge badge-neutral">You</span>
                        )}
                      </p>
                      <p className="text-xs text-ink-soft mt-0.5">
                        Added {formatDate(u.createdAt)} ·{" "}
                        {u.lastSignInAt
                          ? `last sign-in ${formatDate(u.lastSignInAt)}`
                          : "never signed in"}
                      </p>
                    </div>
                    {!u.isSelf && (
                      <button
                        onClick={() => setConfirmingId(u.id)}
                        aria-label={`Delete ${u.email}`}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-danger hover:bg-danger-bg hover:border-danger/40"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
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

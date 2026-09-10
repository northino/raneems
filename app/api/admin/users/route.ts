// POST /api/admin/users
// Body: { email: string, password?: string }
//
// Creates a new dashboard user via the Supabase admin API. Only an already
// authenticated user may call this (checked via the cookie-based server
// client). The account is created with email_confirm: true so the new user can
// sign in immediately (no confirmation email needed). If no password is
// provided, a strong one is generated and returned so the admin can share it.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Returns the authenticated caller, or null if not signed in. */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function generatePassword(length = 16): string {
  // URL-safe, mixed-character password from cryptographic randomness.
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

// GET /api/admin/users — list all dashboard users.
export async function GET() {
  try {
    const caller = await requireUser();
    if (!caller) {
      return NextResponse.json({ error: "Not authorized." }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const users = data.users
      .map((u) => ({
        id: u.id,
        email: u.email ?? "",
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        isSelf: u.id === caller.id,
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return NextResponse.json({ users });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load users.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/admin/users?id=<userId> — remove a dashboard user.
export async function DELETE(request: Request) {
  try {
    const caller = await requireUser();
    if (!caller) {
      return NextResponse.json({ error: "Not authorized." }, { status: 401 });
    }

    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "A user id is required." },
        { status: 400 },
      );
    }
    // Don't let someone delete their own account and lock themselves out.
    if (id === caller.id) {
      return NextResponse.json(
        { error: "You can't delete your own account." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete user.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // 1. Require an authenticated caller.
    const caller = await requireUser();
    if (!caller) {
      return NextResponse.json({ error: "Not authorized." }, { status: 401 });
    }

    // 2. Validate input.
    const { email, password } = (await request.json()) as {
      email?: string;
      password?: string;
    };
    const cleanEmail = email?.trim().toLowerCase();
    if (!cleanEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      return NextResponse.json(
        { error: "A valid email is required." },
        { status: 400 },
      );
    }

    const finalPassword =
      password && password.length >= 8 ? password : generatePassword();

    // 3. Create the user with the service-role admin API.
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password: finalPassword,
      email_confirm: true,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Return the credentials so the admin can copy + share them once.
    return NextResponse.json({
      user: { id: data.user?.id, email: data.user?.email },
      email: cleanEmail,
      password: finalPassword,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create user.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

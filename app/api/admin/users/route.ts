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

export async function POST(request: Request) {
  try {
    // 1. Require an authenticated caller.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
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

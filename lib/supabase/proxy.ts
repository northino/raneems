// Shared logic for proxy.ts: refreshes the Supabase auth session cookie on
// every matched request so server-side reads never see a stale token.
//
// Note: this app guards routes on the client (app/(dashboard)/layout.tsx)
// and has public routes (/p/[slug], /login), so we intentionally do NOT
// redirect here — we only keep the session fresh. Keep the getUser() call:
// removing it makes session refresh unreliable.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Do not run code between createServerClient and getUser().
  // IMPORTANT: Do not remove getUser() — it drives the token refresh.
  await supabase.auth.getUser();

  return supabaseResponse;
}

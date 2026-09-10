// Server Supabase client — for Server Components, Route Handlers, and
// Server Actions. Reads/writes the auth session from Next.js cookies.
// Uses ONLY getAll/setAll (get/set/remove are deprecated and break sessions).
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore because
            // proxy.ts refreshes the session on every request.
          }
        },
      },
    },
  );
}

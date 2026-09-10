// Browser Supabase client — used by Client Components (the whole dashboard
// UI runs client-side). Reads the public env vars bundled into the browser
// build. Auth session is stored in cookies and kept fresh by proxy.ts.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

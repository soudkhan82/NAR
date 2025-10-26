// config/supabase-config.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Call this ONLY at runtime (browser or server) — not during module import. */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_API_KEY ||
    "";

  if (!url || !key) {
    // Do NOT throw during static import; throw only when actually used.
    throw new Error(
      "Supabase env missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  client = createClient(url, key);
  return client;
}

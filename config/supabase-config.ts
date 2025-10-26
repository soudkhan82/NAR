import { createClient } from "@supabase/supabase-js";

// In client components, only NEXT_PUBLIC_* are exposed.
// Fallbacks allow this same file to also work on the server.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_API_KEY ||
  "";

if (!supabaseUrl)
  throw new Error("Missing SUPABASE URL (set NEXT_PUBLIC_SUPABASE_URL)");
if (!supabaseKey)
  throw new Error(
    "Missing SUPABASE ANON KEY (set NEXT_PUBLIC_SUPABASE_ANON_KEY)"
  );

const supabase = createClient(supabaseUrl, supabaseKey);
export default supabase;

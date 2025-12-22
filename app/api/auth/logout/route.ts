import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/app/lib/supabase/server-admin";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "nr_session";

export async function POST() {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;

  if (token) {
    const sb = supabaseAdmin();
    await sb
      .from("portal_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("session_token", token);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}

import { cookies } from "next/headers";
import { supabaseAdmin } from "@/app/lib/supabase/server-admin";

export type AuthedUser = {
  id: number;
  username: string;
  is_active: boolean;
};

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "nr_session";

export async function getSessionToken() {
  const c = await cookies();
  return c.get(COOKIE_NAME)?.value ?? null;
}

export async function getAuthedUser(): Promise<AuthedUser | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const sb = supabaseAdmin();

  const { data: session } = await sb
    .from("portal_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("session_token", token)
    .maybeSingle();

  if (!session) return null;

  if (session.revoked_at) return null;
  const expiresAt = new Date(session.expires_at);
  if (expiresAt.getTime() <= Date.now()) return null;

  const { data: user } = await sb
    .from("portal_users")
    .select("id, username, is_active")
    .eq("id", session.user_id)
    .maybeSingle();

  if (!user) return null;
  if (!user.is_active) return null;

  return user as AuthedUser;
}

export function isAdminUsername(username: string) {
  const raw = process.env.PORTAL_ADMINS || "";
  const admins = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return admins.includes(username.trim().toLowerCase());
}

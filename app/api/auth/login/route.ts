import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { supabaseAdmin } from "@/app/lib/supabase/server-admin";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "nr_session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const sb = supabaseAdmin();

    const { data: user } = await sb
      .from("portal_users")
      .select("id, username, password_hash, is_active")
      .eq("username", username)
      .maybeSingle();

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json({ error: "User is disabled" }, { status: 403 });
    }

    /* =====================================================
       PASSWORD CHECK (HYBRID MODE)
       - If stored value looks like bcrypt → verify hash
       - Else → treat as plain text
       ===================================================== */

    let ok = false;

    if (
      typeof user.password_hash === "string" &&
      user.password_hash.startsWith("$2")
    ) {
      // bcrypt hash
      ok = bcrypt.compareSync(password, user.password_hash);
    } else {
      // plain-text password
      ok = password === user.password_hash;
    }

    if (!ok) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    /* =====================================================
       CREATE SESSION
       ===================================================== */

    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { error: sErr } = await sb.from("portal_sessions").insert({
      user_id: user.id,
      session_token: sessionToken,
      expires_at: expiresAt.toISOString(),
      revoked_at: null,
    });

    if (sErr) {
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, username: user.username },
    });

    res.cookies.set(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (e) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

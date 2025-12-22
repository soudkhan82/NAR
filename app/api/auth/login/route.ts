import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import supabase from "@/app/config/supabase-config";

const COOKIE_NAME = "nr_session";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Missing credentials" },
        { status: 400 }
      );
    }

    const { data: user, error } = await supabase
      .from("portal_users")
      .select("id, username, password_hash, is_active")
      .eq("username", username)
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json({ error: "User disabled" }, { status: 403 });
    }

    // Hybrid password check (plain OR bcrypt)
    let ok = false;
    if (user.password_hash.startsWith("$2")) {
      ok = bcrypt.compareSync(password, user.password_hash);
    } else {
      ok = password === user.password_hash;
    }

    if (!ok) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Create simple session token
    const token = crypto.randomBytes(32).toString("hex");

    const res = NextResponse.json({ ok: true });

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day
    });

    return res;
  } catch (e) {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

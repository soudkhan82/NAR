import { NextResponse } from "next/server";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "nr_session";

export async function GET(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const hasSession = cookie.split(";").some((c) => c.trim().startsWith(`${COOKIE_NAME}=`));

  if (!hasSession) {
    return NextResponse.json({ authed: false }, { status: 401 });
  }

  // simplest mode: cookie existence = authed
  return NextResponse.json({ authed: true }, { status: 200 });
}

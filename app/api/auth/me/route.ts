import { NextResponse } from "next/server";
import { getAuthedUser } from "@/app/lib/auth/server";

export async function GET() {
  const user = await getAuthedUser();
  return NextResponse.json({
    user: user ? { id: user.id, username: user.username } : null,
  });
}

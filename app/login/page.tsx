"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const j = await r.json();
      if (!r.ok) {
        setErr(j?.error || "Login failed");
        setBusy(false);
        return;
      }

      router.replace(next);
    } catch {
      setErr("Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border bg-white shadow-sm p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Network Reporting</h1>
          <p className="text-sm text-gray-600 mt-1">
            Sign in with your portal credentials
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Username</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Password</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {err && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}

          <button
            disabled={busy}
            className="w-full rounded-md bg-black text-white py-2 disabled:opacity-60"
          >
            {busy ? "Signing in..." : "Login"}
          </button>
        </form>

        <div className="mt-6 text-xs text-gray-500">
          Contact admin if you need access.
        </div>
      </div>
    </div>
  );
}

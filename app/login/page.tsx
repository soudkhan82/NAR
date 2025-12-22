"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const j = await r.json();

      if (!r.ok) {
        setError(j?.error || "Invalid credentials");
        setBusy(false);
        return;
      }

      router.replace(next);
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[100dvh] grid place-items-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-xl p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight">Login</h1>
          <p className="mt-1 text-sm text-slate-300">
            Sign in to access Network Reporting portal.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-slate-300">Username</label>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-fuchsia-500/60"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div>
            <label className="text-xs text-slate-300">Password</label>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-fuchsia-500/60"
              placeholder="Enter password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            disabled={busy}
            className="w-full rounded-lg bg-fuchsia-500/90 hover:bg-fuchsia-500 px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-60"
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-5 text-xs text-slate-400">
          © {new Date().getFullYear()} GeoIntel360
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  // Suspense boundary required for useSearchParams() in Next 15 build
  return (
    <Suspense
      fallback={
        <main className="min-h-[100dvh] grid place-items-center bg-slate-950 text-white">
          Loading…
        </main>
      }
    >
      <LoginInner />
    </Suspense>
  );
}

"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function AuthShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    async function check() {
      try {
        const r = await fetch("/api/auth/me", {
          method: "GET",
          cache: "no-store",
        });
        const ok = r.ok;

        // if not logged in -> only allow /login
        if (!ok && pathname !== "/login") {
          router.replace("/login");
          return;
        }

        // if logged in -> prevent visiting /login
        if (ok && pathname === "/login") {
          router.replace("/");
          return;
        }

        if (alive) setReady(true);
      } catch {
        // if API fails, treat as logged out
        if (pathname !== "/login") router.replace("/login");
      }
    }

    check();

    return () => {
      alive = false;
    };
  }, [pathname, router]);

  if (!ready && pathname !== "/login") {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-slate-950 text-white">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}

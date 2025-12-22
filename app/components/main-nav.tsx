"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

type NavItem = { href: string; label: string };

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/GIS", label: "GIS" },
  { href: "/complaints", label: "Complaints" },
  { href: "/Reports", label: "Auto-Reports" },
  { href: "/ANOps", label: "Access Network" },
  { href: "/traffic", label: "Traffic" },
  { href: "/Lpa", label: "LPA" },
  { href: "/eas", label: "EAS" },
  { href: "/isp", label: "ISP" },
  { href: "/CU", label: "Cell Utilization" },
  { href: "/RANExpansion", label: "RAN Expansion" },
  { href: "/PSCore/Subscribers", label: "PSCore-Subs" },
  { href: "/PSCore/Traffic", label: "PSCore-Traffic" },
  { href: "/Rms", label: "RMS" },
];

export default function MainNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false); // mobile menu
  const [menuOpen, setMenuOpen] = useState(false); // dropdown
  const [authed, setAuthed] = useState(false);

  // IMPORTANT: do not early-return before hooks
  const hideNav = pathname === "/login";

  useEffect(() => {
    let alive = true;

    async function check() {
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        if (!alive) return;
        setAuthed(r.ok);
      } catch {
        if (!alive) return;
        setAuthed(false);
      }
    }

    check();
    return () => {
      alive = false;
    };
  }, [pathname]);

  async function handleLogout() {
    setMenuOpen(false);
    setOpen(false);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Logged out");
    } catch {
      toast.error("Logout failed");
    } finally {
      router.replace("/login");
    }
  }

  if (hideNav) return null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-950/70 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <Link
          href="/"
          className="text-sm font-semibold text-white/90 hover:text-white"
        >
          Network Reporting
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-2">
          <nav className="flex gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white"
                >
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="active-pill"
                      className="absolute inset-0 -z-10 rounded-lg bg-white/10"
                      transition={{
                        type: "spring",
                        bounce: 0.25,
                        duration: 0.4,
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Dropdown (snackbar-style) */}
          {authed && (
            <div className="relative ml-2">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm border border-white/15 bg-white/5 text-white hover:bg-white/10 transition"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90 shadow-[0_0_18px_rgba(52,211,153,0.35)]" />
                <span>Account</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    d="M6 9l6 6 6-6"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-slate-950/95 backdrop-blur shadow-xl"
                  >
                    <div className="px-4 py-3 text-xs text-slate-300 border-b border-white/10">
                      Session active
                    </div>

                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-3 text-left text-sm text-white hover:bg-fuchsia-500/10 transition flex items-center gap-2"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1"
                        />
                      </svg>
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-slate-200 hover:bg-white/10"
          aria-label="Toggle Menu"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              d="M3 6h18M3 12h18M3 18h18"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Mobile sheet */}
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden border-t border-white/10 bg-slate-950"
          >
            <ul className="px-4 py-2">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`block rounded-md px-3 py-2 text-sm ${
                        active
                          ? "bg-white/10 text-white"
                          : "text-slate-300 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}

              {authed && (
                <li className="mt-2 border-t border-white/10 pt-2">
                  <button
                    onClick={handleLogout}
                    className="w-full rounded-md px-3 py-2 text-sm text-white border border-white/15 bg-white/5 hover:bg-fuchsia-500/10 transition"
                  >
                    Logout
                  </button>
                </li>
              )}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

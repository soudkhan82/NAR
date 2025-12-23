"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

type NavItem = {
  href: string;
  label: string;
  gradient: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", gradient: "from-sky-400 to-blue-500" },
  { href: "/GIS", label: "GIS", gradient: "from-emerald-400 to-teal-500" },
  {
    href: "/complaints",
    label: "Complaints",
    gradient: "from-rose-400 to-pink-500",
  },
  {
    href: "/Reports",
    label: "Auto-Reports",
    gradient: "from-indigo-400 to-violet-500",
  },
  {
    href: "/ANOps",
    label: "Access Network",
    gradient: "from-amber-400 to-orange-500",
  },
  { href: "/traffic", label: "Traffic", gradient: "from-cyan-400 to-sky-500" },
  { href: "/Lpa", label: "LPA", gradient: "from-fuchsia-400 to-purple-500" },
  { href: "/isp", label: "ISP", gradient: "from-lime-400 to-green-500" },
  { href: "/Rms", label: "RMS", gradient: "from-red-400 to-rose-500" },
  {
    href: "/KPI/DG",
    label: "DG KPI",
    gradient: "from-violet-400 to-fuchsia-500",
  },
];

export default function MainNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false); // mobile
  const [menuOpen, setMenuOpen] = useState(false); // account
  const [authed, setAuthed] = useState(false);

  // command palette
  const [cmdOpen, setCmdOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // for portal safety in Next.js
  const [mounted, setMounted] = useState(false);

  const hideNav = pathname === "/login";

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        if (!alive) return;
        setAuthed(r.ok);
      } catch {
        if (!alive) return;
        setAuthed(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [pathname]);

  // keyboard shortcuts: "/" open, Esc close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      const typing =
        tag === "input" || tag === "textarea" || el?.isContentEditable;

      if (e.key === "/" && !typing && !cmdOpen) {
        e.preventDefault();
        setCmdOpen(true);
        return;
      }

      if (e.key === "Escape") {
        setCmdOpen(false);
        setQuery("");
        setMenuOpen(false);
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cmdOpen]);

  useEffect(() => {
    if (!cmdOpen) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [cmdOpen]);

  useEffect(() => {
    if (!cmdOpen) return;

    // prevent background scrolling when palette is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [cmdOpen]);

  async function handleLogout() {
    setMenuOpen(false);
    setOpen(false);
    setCmdOpen(false);
    setQuery("");

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Logged out");
    } catch {
      toast.error("Logout failed");
    } finally {
      router.replace("/login");
    }
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV_ITEMS;
    return NAV_ITEMS.filter((x) => x.label.toLowerCase().includes(q));
  }, [query]);

  const onNavigate = (href: string) => {
    router.push(href);
    setCmdOpen(false);
    setQuery("");
    setOpen(false);
    setMenuOpen(false);
  };

  if (hideNav) return null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Desktop nav (equal spacing) */}
        <nav className="hidden md:grid grid-flow-col auto-cols-fr gap-2 flex-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className="relative group">
                <div className="relative z-10 flex justify-center rounded-xl px-3 py-2 text-sm font-medium text-slate-200 group-hover:text-white transition">
                  {item.label}
                </div>

                <div
                  className={`absolute inset-0 rounded-xl bg-gradient-to-r ${item.gradient} opacity-0 group-hover:opacity-20 transition`}
                />

                {active && (
                  <motion.div
                    layoutId="active-nav-pill"
                    className={`absolute inset-0 rounded-xl bg-gradient-to-r ${item.gradient} opacity-30`}
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Search button */}
          <button
            onClick={() => setCmdOpen(true)}
            className="hidden md:inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 transition"
            title="Search navigation (Press /)"
          >
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 opacity-90">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 21l-4.3-4.3m1.8-5.2a7 7 0 11-14 0 7 7 0 0114 0z"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="text-white/90">Search</span>
            <span className="ml-1 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70">
              /
            </span>
          </button>

          {/* Account dropdown */}
          {authed && (
            <div className="hidden md:block relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm border border-white/15 bg-white/5 text-white hover:bg-white/10 transition"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.5)]" />
                <span>Account</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
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

          {/* Mobile icons */}
          <button
            onClick={() => setCmdOpen(true)}
            className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-slate-200 hover:bg-white/10 transition"
            aria-label="Search navigation"
            title="Search"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 21l-4.3-4.3m1.8-5.2a7 7 0 11-14 0 7 7 0 0114 0z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <button
            onClick={() => setOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-slate-200 hover:bg-white/10 transition"
            aria-label="Toggle Menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 6h18M3 12h18M3 18h18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
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
            <ul className="grid grid-cols-2 gap-2 px-4 py-4">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`block rounded-lg px-3 py-2 text-sm text-center text-white bg-gradient-to-r ${
                        item.gradient
                      } ${
                        active ? "opacity-100" : "opacity-80 hover:opacity-100"
                      } transition`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}

              {authed && (
                <li className="col-span-2 mt-2">
                  <button
                    onClick={handleLogout}
                    className="w-full rounded-lg px-3 py-2 text-sm text-white border border-white/15 bg-white/5 hover:bg-fuchsia-500/10 transition"
                  >
                    Logout
                  </button>
                </li>
              )}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Command palette rendered in a PORTAL to guarantee foreground */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {cmdOpen && (
              <>
                {/* Backdrop (very high z-index) */}
                <motion.div
                  className="fixed inset-0 bg-black/55"
                  style={{ zIndex: 2147483646 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => {
                    setCmdOpen(false);
                    setQuery("");
                  }}
                />

                {/* Panel */}
                <motion.div
                  initial={{ opacity: 0, y: -18, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -18, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                  className="fixed left-1/2 top-20 w-[92%] max-w-md -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur shadow-2xl"
                  style={{ zIndex: 2147483647 }}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Search navigation"
                >
                  <div className="border-b border-white/10 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-white/10">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M21 21l-4.3-4.3m1.8-5.2a7 7 0 11-14 0 7 7 0 0114 0z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>

                      <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search modules… (e.g. GIS, Traffic, RMS)"
                        className="w-full bg-transparent text-sm text-white placeholder:text-slate-400 outline-none"
                      />

                      <span className="rounded-md bg-white/10 px-2 py-1 text-[10px] text-white/70">
                        Esc
                      </span>
                    </div>
                  </div>

                  <div className="max-h-[360px] overflow-y-auto py-1">
                    {results.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-slate-400">
                        No results
                      </div>
                    ) : (
                      results.map((item) => (
                        <button
                          key={item.href}
                          onClick={() => onNavigate(item.href)}
                          className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition"
                        >
                          <span
                            className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${item.gradient}`}
                          />
                          <span className="text-sm text-white/90 group-hover:text-white">
                            {item.label}
                          </span>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="border-t border-white/10 px-4 py-2 text-xs text-slate-400">
                    Tip: Press{" "}
                    <span className="rounded bg-white/10 px-1">/</span> to open
                    search
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </header>
  );
}

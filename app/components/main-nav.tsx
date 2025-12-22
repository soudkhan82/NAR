"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setOpen(false);
      router.replace("/login");
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-950/70 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand (optional) */}
        <Link href="/" className="text-sm font-semibold text-white/90 hover:text-white">
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
                      transition={{ type: "spring", bounce: 0.25, duration: 0.4 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Fancy Logout button (desktop) */}
          <button
            onClick={handleLogout}
            className="
              ml-2 inline-flex items-center gap-2
              rounded-full px-4 py-2
              text-sm font-medium text-white
              border border-white/20
              bg-white/5 backdrop-blur
              transition-all duration-300
              hover:bg-fuchsia-500/10
              hover:border-fuchsia-400/40
              hover:shadow-[0_0_20px_rgba(217,70,239,0.35)]
              hover:-translate-y-[1px]
              active:translate-y-0
            "
            aria-label="Logout"
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
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-slate-200 hover:bg-white/10"
          aria-label="Toggle Menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 6h18M3 12h18M3 18h18" strokeWidth="2" strokeLinecap="round" />
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

              {/* Mobile logout */}
              <li className="mt-2 border-t border-white/10 pt-2">
                <button
                  onClick={handleLogout}
                  className="
                    w-full inline-flex items-center justify-center gap-2
                    rounded-md px-3 py-2 text-sm font-medium
                    text-white border border-white/15 bg-white/5
                    hover:bg-fuchsia-500/10 hover:border-fuchsia-400/40
                    transition
                  "
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
              </li>
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

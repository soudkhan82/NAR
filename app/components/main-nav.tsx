"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type NavItem = { href: string; label: string };

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/ANOps", label: "Access Network" },

  { href: "/traffic", label: "Traffic" },
  { href: "/Lpa", label: "LPA" },
  { href: "/eas", label: "EAS" },
  { href: "/isp", label: "ISP" },
  { href: "/CU", label: "Cell Utilization" },
  { href: "/complaints", label: "Complaints" },
  { href: "/PSCore/Subscribers", label: "PSCore-Subs" },
  { href: "/PSCore/Traffic", label: "PSCore-Traffic" },

  { href: "/GIS/", label: "GIS" },
];

export default function MainNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-950/70 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}

        {/* Desktop nav */}
        <nav className="hidden gap-1 md:flex">
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
                          : "text-slate-300 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

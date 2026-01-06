"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  LogOut,
  ChevronDown,
  ArrowRight,
  CalendarDays,
} from "lucide-react";

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
    href: "/franchise",
    label: "Franchise",
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
  { href: "/DG", label: "DG KPI", gradient: "from-violet-400 to-fuchsia-500" },
  {
    href: "/Availability_KPI",
    label: "Availability KPI",
    gradient: "from-violet-400 to-fuchsia-500",
  },
  {
    href: "/cpunits",
    label: "CP Units",
    gradient: "from-blue-500 to-indigo-600",
  },
];

export default function MainNav() {
  const pathname = usePathname();
  const router = useRouter();

  // UI States
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  // Simple Auth Check
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => setAuthed(r.ok))
      .catch(() => setAuthed(false));
  }, [pathname]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !isSearchOpen) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === "Escape") {
        setIsSearchOpen(false);
        setAccountMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        accountRef.current &&
        !accountRef.current.contains(e.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input
  useEffect(() => {
    if (isSearchOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isSearchOpen]);

  const filteredItems = useMemo(() => {
    return NAV_ITEMS.filter((item) =>
      item.label.toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  if (pathname === "/login") return null;

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-slate-950/80 backdrop-blur-md border-b border-white/5 font-sans">
        <div className="relative mx-auto flex h-16 max-w-[1800px] items-center justify-between px-4 lg:px-10">
          <div className="flex-shrink-0 mr-8">
            <Link
              href="/"
              className="text-white font-black tracking-tighter text-xl hover:opacity-80 transition"
            >
              KPI<span className="text-blue-500">.</span>
            </Link>
          </div>

          <nav className="hidden xl:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="relative px-3 py-2 group"
              >
                <span
                  className={cn(
                    "relative z-10 text-[13px] font-bold transition-colors duration-200",
                    pathname === item.href
                      ? "text-white"
                      : "text-slate-400 group-hover:text-slate-100"
                  )}
                >
                  {item.label}
                </span>
                {pathname === item.href && (
                  <motion.div
                    layoutId="active-pill"
                    className={cn(
                      "absolute inset-0 rounded-xl bg-gradient-to-r opacity-20",
                      item.gradient
                    )}
                  />
                )}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3 ml-8">
            {/* SEARCH TRIGGER */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="hidden lg:flex items-center gap-8 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold hover:bg-white/10 transition-all text-slate-400 group"
            >
              <div className="flex items-center gap-3">
                <Search className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
                <span>Search...</span>
              </div>
              <span className="bg-slate-900 border border-white/10 px-1.5 py-0.5 rounded text-[10px] opacity-50">
                /
              </span>
            </button>

            {/* SIMPLE ACCOUNT MENU */}
            {authed && (
              <div className="relative" ref={accountRef}>
                <button
                  onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                  className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 pl-3 pr-2 py-2 text-xs font-bold text-white hover:bg-white/10 transition-all shadow-lg"
                >
                  <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="uppercase tracking-wider">Account</span>
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 text-slate-500 transition-transform duration-300",
                      accountMenuOpen && "rotate-180"
                    )}
                  />
                </button>

                <AnimatePresence>
                  {accountMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-40 overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] shadow-2xl z-50 p-1"
                    >
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center justify-between px-4 py-3 text-[11px] font-bold text-rose-400 hover:bg-rose-500/10 transition-colors rounded-xl group"
                      >
                        Logout
                        <LogOut className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* SEARCH COMMAND PALETTE */}
      <AnimatePresence>
        {isSearchOpen && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSearchOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -10 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f1a] shadow-2xl"
            >
              <div className="flex items-center border-b border-white/5 px-4 py-4 bg-slate-900/20">
                <Search className="mr-3 h-5 w-5 text-slate-500" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search modules..."
                  className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                />
                <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 uppercase">
                  Esc
                </kbd>
              </div>
              <div className="max-h-[360px] overflow-y-auto p-2 custom-scrollbar">
                {filteredItems.length > 0 ? (
                  <div className="space-y-0.5">
                    {filteredItems.map((item) => (
                      <button
                        key={item.href}
                        onClick={() => {
                          router.push(item.href);
                          setIsSearchOpen(false);
                          setQuery("");
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-bold text-slate-300 hover:bg-white/5 hover:text-white transition-all group"
                      >
                        <div
                          className={cn(
                            "h-2.5 w-2.5 rounded-full bg-gradient-to-r",
                            item.gradient
                          )}
                        />
                        {item.label}
                        <ArrowRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-blue-500" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center text-xs text-slate-600 font-medium">
                    No results found for "{query}"
                  </div>
                )}
              </div>
              <div className="flex items-center border-t border-white/5 bg-slate-950/50 px-4 py-2.5">
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">
                  Press <span className="text-slate-400">Enter</span> to select
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
      `}</style>
    </>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}

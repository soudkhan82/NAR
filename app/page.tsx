// app/home/page.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useMemo } from "react";

// Feel free to swap images with your own assets or CDN
const TILES = [
  {
    key: "eutran",
    href: "/Eutran",
    title: "EUTRAN",
    subtitle: "High-utilization insights",
    img: "/images/highU.jpg",
  },
  {
    key: "eas",
    href: "/eas",
    title: "EAS",
    subtitle: "Energy & power dashboard",
    img: "/images/eas.jpg",
  },
  {
    key: "isp",
    href: "/isp",
    title: "ISP",
    subtitle: "Internet service KPIs",
    img: "/images/traffic.jpg",
  },
  {
    key: "availability",
    href: "/Availability",
    title: "Availability",
    subtitle: "Site uptime & trends",
    img: "/images/avail.jpg",
  },
  // NEW: ANOps tile
  {
    key: "anops",
    href: "/ANOps",
    title: "Access Network Operations",
    subtitle: "Acceptance & Network Ops",
    img: "/images/digital.jpg", // from public/image/digital.jpg
  },
  {
    key: "traffic",
    href: "/traffic",
    title: "Traffic",
    subtitle: "Voice & data loads",
    img: "/images/traffic.jpg",
  },
  {
    key: "lpa",
    href: "/Lpa",
    title: "LPA",
    subtitle: "Power alarms & aging",
    img: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1600&auto=format&fit=crop",
  },
] as const;

export default function HomeLanding() {
  const rows = useMemo(() => {
    // 2 rows on xl, 1 row on small, auto on medium
    return TILES;
  }, []);

  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <section className="relative overflow-hidden">
        {/* subtle glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-[60rem] rounded-full bg-fuchsia-500/20 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-6 pt-14 pb-10 sm:pt-16 sm:pb-12">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight"
          >
            Network Analytics Portal
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-3 max-w-2xl text-slate-300"
          >
            Explore Cell Utilization, EAS, ISP, Availability, Traffic,RMS ,
            Geo-Analytics and LPA—each module powered by your Supabase + Next.js
            stack.
          </motion.p>
        </div>
      </section>

      {/* Tiles */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((tile, i) => (
            <motion.div
              key={tile.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <Link
                href={tile.href}
                className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 rounded-3xl"
              >
                <article className="relative h-56 sm:h-64 md:h-72 overflow-hidden rounded-3xl shadow-lg ring-1 ring-white/10 bg-slate-800">
                  {/* Background image */}
                  <Image
                    src={tile.img}
                    alt={tile.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    priority={i < 3}
                    className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
                  />

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent" />

                  {/* Content */}
                  <div className="absolute inset-0 p-5 flex flex-col justify-end">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-fuchsia-400/90 shadow-[0_0_24px_theme(colors.fuchsia.400)]" />
                      <h3 className="text-lg sm:text-xl font-semibold tracking-wide">
                        {tile.title}
                      </h3>
                    </div>
                    <p className="mt-1 text-sm text-slate-300/90">
                      {tile.subtitle}
                    </p>
                    <div className="mt-4">
                      <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-200/90">
                        Open module
                        <svg
                          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </div>

                  {/* Subtle border glow on hover */}
                  <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/10 group-hover:ring-fuchsia-400/40" />
                </article>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-8 text-sm text-slate-400">
          © {new Date().getFullYear()} GeoIntel360 · Built with Next.js +
          Supabase
        </div>
      </footer>
    </main>
  );
}

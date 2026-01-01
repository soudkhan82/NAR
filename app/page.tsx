"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useMemo } from "react";

// Tiles config
const TILES = [
  {
    key: "GIS",
    href: "/GIS",
    title: "Geospatial - Analysis",
    subtitle: "Geographical insights",
    img: "/images/avail.jpg",
  },
  {
    key: "RAN Expansion",
    href: "/RANExpansion",
    title: "RAN Expansion",
    subtitle: "Traffic insights",
    img: "/images/highU.jpg",
  },
  {
    key: "RMS",
    href: "/Rms",
    title: "RMS",
    subtitle: "Remote Monitoring System",
    img: "/images/eas.jpg",
  },
  {
    key: "ISP",
    href: "/isp",
    title: "ISP",
    subtitle: "Internet service KPIs",
    img: "/images/digital.jpg",
  },
  {
    key: "Availability",
    href: "/Availability",
    title: "Availability",
    subtitle: "Site uptime & trends",
    img: "/images/avail.jpg",
  },
  {
    key: "ANOps",
    href: "/ANOps",
    title: "Access Network Operations",
    subtitle: "Acceptance & Network Ops",
    img: "/images/digital.jpg",
  },
  {
    key: "Complaints",
    href: "/complaints",
    title: "Complaints",
    subtitle: "Level-3 Engineering Complaints",
    img: "/images/complaint.avif",
  },
  {
    key: "PSCore",
    href: "/PSCore",
    title: "Packet Switched Core",
    subtitle: "Users & Traffic",
    img: "/images/pscore.avif",
  },
  {
    key: "Traffic",
    href: "/traffic",
    title: "Traffic",
    subtitle: "Voice & data loads",
    img: "/images/traffic.jpg",
  },
  {
    key: "LPA",
    href: "/Lpa",
    title: "LPA",
    subtitle: "Power alarms & aging",
    img: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1600&auto=format&fit=crop",
    external: true,
  },
] as const;

export default function HomeLanding() {
  const rows = useMemo(() => TILES, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <section className="mx-auto max-w-7xl px-6 pt-14 pb-10">
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
          Explore Access Network Operations, Cell Utilization, EAS, ISP,
          Availability, Traffic, RMS and other key performance indicators.
        </motion.p>
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
              <Link href={tile.href} className="group block rounded-3xl">
                <article className="relative h-56 sm:h-64 md:h-72 overflow-hidden rounded-3xl ring-1 ring-white/10 bg-slate-800">
                  <Image
                    src={tile.img}
                    alt={tile.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    priority={i < 3}
                    className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
                    // KEY FIX: bypass optimizer (prevents /_next/image 400)
                    unoptimized={!("external" in tile && tile.external)}
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent" />

                  <div className="absolute inset-0 p-5 flex flex-col justify-end">
                    <h3 className="text-lg sm:text-xl font-semibold">
                      {tile.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-300">
                      {tile.subtitle}
                    </p>
                  </div>
                </article>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10"></footer>
    </main>
  );
}

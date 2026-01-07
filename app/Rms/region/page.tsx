"use client";
import React from "react";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import supabase from "@/app/config/supabase-config";
import RmsHeaderSearch from "@/app/Rms/RmsHeaderSearch";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
  PieChart,
  Pie,
} from "recharts";

/* =========================
   Types
========================= */

type RegionRow = {
  region: string | null;

  overall_sites_count: number | null;
  rms_sites_count: number | null;
  rms_disconnected_count: number | null;

  ip_connectivity_yes: number | null;
  ip_connectivity_no: number | null;

  phase_1_missing: number | null;
  phase_2_missing: number | null;

  battery_health_lt70: number | null;

  smr_shortfall_count: number | null;
  critical_shortfall_count: number | null;
  extra_smr_count: number | null;

  ac_spd_normal: number | null;
  ac_spd_abnormal: number | null;
};

type SubregionRow = RegionRow & {
  subregion: string | null;
};

/* =========================
   KPI options (same as your drilldown indicators)
========================= */

const KPI_OPTIONS = [
  {
    key: "rms_disconnected_count",
    label: "RMS Disconnected",
    indicator: "rms_disconnected",
  },
  { key: "ip_connectivity_yes", label: "IP Yes", indicator: "ip_yes" },
  { key: "ip_connectivity_no", label: "IP No", indicator: "ip_no" },
  {
    key: "phase_1_missing",
    label: "1 Phase Missing",
    indicator: "phase_1_missing",
  },
  {
    key: "phase_2_missing",
    label: "2 Phase Missing",
    indicator: "phase_2_missing",
  },
  {
    key: "battery_health_lt70",
    label: "Battery <70% (Yes)",
    indicator: "battery_lt70",
  },
  {
    key: "smr_shortfall_count",
    label: "Shortfall",
    indicator: "smr_shortfall",
  },
  {
    key: "critical_shortfall_count",
    label: "Critical (<95%)",
    indicator: "critical_shortfall",
  },
  { key: "extra_smr_count", label: "Extra", indicator: "extra_smr" },
  { key: "ac_spd_normal", label: "AC SPD Normal", indicator: "ac_spd_normal" },
  {
    key: "ac_spd_abnormal",
    label: "AC SPD Abnormal",
    indicator: "ac_spd_abnormal",
  },
] as const;

type KpiKey = (typeof KPI_OPTIONS)[number]["key"];
function kpiMeta(k: KpiKey) {
  return KPI_OPTIONS.find((x) => x.key === k)!;
}

/* =========================
   Helpers
========================= */

function safeText(v: string | null | undefined, fallback = "-") {
  const t = String(v ?? "").trim();
  return t ? t : fallback;
}
function n(v: number | null | undefined) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}
function fmt(v: number | null | undefined) {
  return n(v).toLocaleString();
}
function clamp(x: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, x));
}
function pct(value: number, maxValue: number) {
  if (!maxValue || maxValue <= 0) return 0;
  return clamp((value / maxValue) * 100);
}

function rgbaFromHex(hex: string, a: number) {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function detailsHref(
  subregion: string | null,
  indicator: string,
  label: string
) {
  const sr = encodeURIComponent((subregion ?? "").trim());
  const ind = encodeURIComponent(indicator);
  const lab = encodeURIComponent(label);
  return `/Rms?subregion=${sr}&indicator=${ind}&label=${lab}`;
}

/* =========================
   Region colors (consistent everywhere)
========================= */

const REGION_HEX: Record<"central" | "north" | "south", string> = {
  central: "#22d3ee", // neon cyan
  north: "#f59e0b", // amber
  south: "#10b981", // emerald
};

function regionKey(name: string) {
  const r = name.toLowerCase();
  if (r.includes("north")) return "north";
  if (r.includes("south")) return "south";
  return "central";
}
function regionHex(name: string) {
  return REGION_HEX[regionKey(name)];
}

function glow(hex: string) {
  return `0 0 0 1px ${rgbaFromHex(hex, 0.18)}, 0 18px 45px rgba(0,0,0,0.55)`;
}

function chipDot(hex: string) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{
        background: hex,
        boxShadow: `0 0 14px ${rgbaFromHex(hex, 0.45)}`,
      }}
    />
  );
}
function DonutLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, percent, name, value } = props;

  const RADIAN = Math.PI / 180;

  // where the label sits
  const r = outerRadius + 16;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);

  // where the line starts (near arc)
  const x2 = cx + (outerRadius + 6) * Math.cos(-midAngle * RADIAN);
  const y2 = cy + (outerRadius + 6) * Math.sin(-midAngle * RADIAN);

  const pctText = `${Math.round((percent ?? 0) * 100)}%`;
  const anchor = x > cx ? "start" : "end";

  return (
    <g>
      {/* leader line */}
      <line
        x1={x2}
        y1={y2}
        x2={x}
        y2={y}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={1}
      />

      {/* Region + % */}
      <text
        x={x + (anchor === "start" ? 6 : -6)}
        y={y}
        textAnchor={anchor}
        dominantBaseline="central"
        fill="rgba(255,255,255,0.92)"
        fontSize={12}
        fontWeight={800}
      >
        {String(name)} {pctText}
      </text>

      {/* value (optional) */}
      <text
        x={x + (anchor === "start" ? 6 : -6)}
        y={y + 14}
        textAnchor={anchor}
        dominantBaseline="central"
        fill="rgba(255,255,255,0.55)"
        fontSize={11}
        fontWeight={700}
      >
        {Number(value ?? 0).toLocaleString()}
      </text>
    </g>
  );
}

/* =========================
   Clickable indicator cell (SubRegion only)
========================= */

function cellGradient(value: number, maxValue: number, accentHex: string) {
  const p = pct(value, maxValue);
  const fill = rgbaFromHex(accentHex, 0.28);
  const base = `rgba(255,255,255,0.05)`;
  return {
    backgroundImage: `linear-gradient(90deg, ${fill} ${p}%, ${base} ${p}%)`,
  } as React.CSSProperties;
}

function IndicatorCell(props: {
  subregion: string | null;
  indicator: string;
  label: string;
  value: number | null | undefined;
  maxValue: number;
  accentHex: string;
}) {
  const v = n(props.value);
  const disabled = !props.subregion || v <= 0;

  const base =
    "w-full inline-flex items-center justify-end px-2 py-1 rounded-md transition select-none";

  const style = cellGradient(v, props.maxValue, props.accentHex);

  if (disabled) {
    return (
      <span
        className={`${base} text-white/80`}
        style={style}
        title={props.label}
      >
        {fmt(v)}
      </span>
    );
  }

  return (
    <Link
      href={detailsHref(props.subregion, props.indicator, props.label)}
      className={`${base} text-white hover:opacity-95 hover:ring-1 hover:ring-white/15 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.10),0_16px_38px_rgba(0,0,0,0.55)]`}
      style={style}
      title={`Open sites: ${props.label} • ${props.subregion}`}
    >
      {fmt(v)}
    </Link>
  );
}

/* =========================
   Pretty tooltip (bar + pie)
========================= */

function PrettyTooltip(props: any) {
  if (!props?.active || !props?.payload?.length) return null;

  const p = props.payload[0];
  const name = String(props.label ?? p?.name ?? "");
  const value = Number(p?.value ?? p?.payload?.value ?? 0);

  const meta = props?.meta as {
    title: string;
    kpi: string;
    accentHex: string;
    lookup?: Record<string, { overall: number; rms: number } | undefined>;
  };

  const info = meta?.lookup?.[name];

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3 shadow-2xl backdrop-blur">
      <div className="text-white/60 text-xs">{meta?.title}</div>
      <div className="text-white font-semibold">{name}</div>

      <div className="mt-2 text-xs text-white/60">KPI</div>
      <div className="text-white font-semibold">
        {meta?.kpi}:{" "}
        <span className="font-extrabold" style={{ color: meta?.accentHex }}>
          {value.toLocaleString()}
        </span>{" "}
        <span className="text-white/70">sites</span>
      </div>

      {info && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5">
            <div className="text-white/60">Overall</div>
            <div className="text-white font-semibold">
              {info.overall.toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5">
            <div className="text-white/60">RMS Sites</div>
            <div className="text-white font-semibold">
              {info.rms.toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   Page
========================= */

export default function RmsRegionDashboardPage() {
  const [regionRows, setRegionRows] = useState<RegionRow[]>([]);
  const [subRowsAll, setSubRowsAll] = useState<SubregionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // One-row filters
  const [kpiKey, setKpiKey] = useState<KpiKey>("rms_disconnected_count");

  // Accordion selection (this controls cards, charts, and expanded table)
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);

  const meta = useMemo(() => kpiMeta(kpiKey), [kpiKey]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr(null);

      try {
        const [reg, sub] = await Promise.all([
          supabase.rpc("fetch_rms_region_summary"),
          supabase.rpc("fetch_rms_subregion_summary"),
        ]);

        if (reg.error) throw new Error(reg.error.message);
        if (sub.error) throw new Error(sub.error.message);

        if (!cancelled) {
          setRegionRows((reg.data ?? []) as RegionRow[]);
          setSubRowsAll((sub.data ?? []) as SubregionRow[]);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // region lookup for tooltip info
  const regionLookup = useMemo(() => {
    const map: Record<string, { overall: number; rms: number } | undefined> =
      {};
    for (const r of regionRows) {
      const k = safeText(r.region, "(Blank)");
      map[k] = { overall: n(r.overall_sites_count), rms: n(r.rms_sites_count) };
    }
    return map;
  }, [regionRows]);

  const subLookup = useMemo(() => {
    const map: Record<string, { overall: number; rms: number } | undefined> =
      {};
    for (const r of subRowsAll) {
      const k = safeText(r.subregion, "(Blank)");
      map[k] = { overall: n(r.overall_sites_count), rms: n(r.rms_sites_count) };
    }
    return map;
  }, [subRowsAll]);

  // Filter subregions based on expanded region
  const activeSubRows = useMemo(() => {
    if (!expandedRegion) return [];
    const target = expandedRegion.trim().toLowerCase();
    return subRowsAll.filter(
      (r) => (r.region ?? "").trim().toLowerCase() === target
    );
  }, [expandedRegion, subRowsAll]);

  // Bar chart: if a region is expanded => show subregions of that region, else show regions.
  const barMode: "region" | "subregion" = expandedRegion
    ? "subregion"
    : "region";

  const barData = useMemo(() => {
    if (barMode === "region") {
      return regionRows
        .map((r) => ({
          name: safeText(r.region, "(Blank)"),
          value: n((r as any)[kpiKey]),
        }))
        .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
    }
    return activeSubRows
      .map((r) => ({
        name: safeText(r.subregion, "(Blank)"),
        value: n((r as any)[kpiKey]),
        region: safeText(r.region, ""),
      }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  }, [barMode, regionRows, activeSubRows, kpiKey]);

  // Donut: always show region distribution (modern snapshot)
  const donutData = useMemo(() => {
    return regionRows
      .map((r) => ({
        name: safeText(r.region, "(Blank)"),
        value: n((r as any)[kpiKey]),
        hex: regionHex(safeText(r.region, "")),
      }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [regionRows, kpiKey]);

  // Max values for clickable gradient cells (subregion rows)
  const subMax = useMemo(() => {
    const rows: any[] = (expandedRegion ? activeSubRows : subRowsAll) as any[];
    const getMax = (k: string) => Math.max(...rows.map((r) => n(r?.[k])), 0);

    return {
      rms_disconnected_count: getMax("rms_disconnected_count"),
      ip_connectivity_yes: getMax("ip_connectivity_yes"),
      ip_connectivity_no: getMax("ip_connectivity_no"),
      phase_1_missing: getMax("phase_1_missing"),
      phase_2_missing: getMax("phase_2_missing"),
      battery_health_lt70: getMax("battery_health_lt70"),
      smr_shortfall_count: getMax("smr_shortfall_count"),
      critical_shortfall_count: getMax("critical_shortfall_count"),
      extra_smr_count: getMax("extra_smr_count"),
      ac_spd_normal: getMax("ac_spd_normal"),
      ac_spd_abnormal: getMax("ac_spd_abnormal"),
    };
  }, [activeSubRows, subRowsAll, expandedRegion]);

  function toggleRegion(name: string) {
    setExpandedRegion((prev) =>
      prev?.toLowerCase() === name.toLowerCase() ? null : name
    );
  }

  /* ===== Cards data ===== */
  const regionCards = useMemo(() => {
    // keep stable order: Central, North, South (even if rpc order changes)
    const byName = new Map<string, RegionRow>();
    for (const r of regionRows)
      byName.set(safeText(r.region, "").toLowerCase(), r);

    const names = ["Central", "North", "South"];
    return names
      .map((name) => {
        const row =
          byName.get(name.toLowerCase()) ??
          regionRows.find((x) =>
            safeText(x.region, "").toLowerCase().includes(name.toLowerCase())
          ) ??
          null;

        const overall = row ? n(row.overall_sites_count) : 0;
        const rms = row ? n(row.rms_sites_count) : 0;
        const kpi = row ? n((row as any)[kpiKey]) : 0;

        return { name, overall, rms, kpi, hex: regionHex(name) };
      })
      .filter((x) => x.name);
  }, [regionRows, kpiKey]);

  const valueLabelProps = {
    position: "top" as const,
    fill: "rgba(255,255,255,0.92)",
    fontSize: 11,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="p-6 space-y-4">
        {/* Header + ONE row filters */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
              <div className="h-2.5 w-2.5 rounded-full bg-cyan-300/90 shadow-[0_0_18px_rgba(34,211,238,0.55)]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-white">
                RMS Regional Dashboard
              </h1>
            </div>
          </div>

          {/* Filters row wrapper (IMPORTANT) */}
          <div className="relative z-0">
            <div className="relative z-[70] overflow-visible rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
              <div className="mt-4 flex flex-wrap items-stretch gap-2">
                {/* KPI */}
                <div className="min-w-[260px]">
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur px-4 py-2">
                    <div className="text-[11px] text-white/60">KPI</div>

                    <div className="mt-1 relative">
                      <select
                        value={kpiKey}
                        onChange={(e) => setKpiKey(e.target.value as KpiKey)}
                        className="w-full appearance-none bg-transparent pr-9 outline-none text-sm text-white"
                      >
                        {KPI_OPTIONS.map((k) => (
                          <option
                            key={k.key}
                            value={k.key}
                            className="bg-slate-950 text-white"
                          >
                            {k.label}
                          </option>
                        ))}
                      </select>

                      <svg
                        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* ✅ Search - force above everything */}
                <div className="flex-1 min-w-[320px] relative z-[90] overflow-visible">
                  <RmsHeaderSearch />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setKpiKey("rms_disconnected_count");
                    setExpandedRegion(null);
                  }}
                  className="shrink-0 rounded-2xl border border-white/10 bg-white/5 backdrop-blur px-4 py-3 text-sm font-semibold text-white/90 hover:bg-white/10 transition"
                >
                  Reset
                </button>
              </div>
            </div>

            {loading && (
              <div className="mt-3 text-sm text-white/60">Loading…</div>
            )}
            {!loading && err && (
              <div className="mt-3 text-sm text-rose-200">Error: {err}</div>
            )}
          </div>
        </div>

        {/* ===== Region cards (REQUIRED) ===== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {regionCards.map((c) => {
            const selected =
              expandedRegion?.toLowerCase() === c.name.toLowerCase();
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => toggleRegion(c.name)}
                className={[
                  "text-left rounded-2xl border bg-white/5 backdrop-blur p-4 transition",
                  "hover:bg-white/7 hover:border-white/15",
                  selected ? "border-white/20" : "border-white/10",
                ].join(" ")}
                style={{
                  boxShadow: selected ? glow(c.hex) : undefined,
                }}
                title="Click to expand subregions"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      {chipDot(c.hex)}
                      <div className="text-white font-semibold text-lg">
                        {c.name}
                      </div>
                    </div>
                    <div className="text-xs text-white/60 mt-1">
                      {meta.label}
                    </div>
                  </div>

                  <div
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                    style={{
                      boxShadow: `0 0 0 1px ${rgbaFromHex(c.hex, 0.12)}`,
                    }}
                  >
                    {selected ? "Selected" : "View"}
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <div className="text-4xl font-extrabold text-white leading-none">
                    {c.kpi.toLocaleString()}
                  </div>
                  <div className="text-white/60 text-sm pb-1">sites</div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <div className="text-[11px] text-white/55">Overall</div>
                    <div className="text-white font-semibold">
                      {c.overall.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <div className="text-[11px] text-white/55">RMS Sites</div>
                    <div className="text-white font-semibold">
                      {c.rms.toLocaleString()}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ===== Charts (60/40): Bar + Donut ===== */}
        <div className="grid grid-cols-12 gap-3">
          {/* Bar (60%) */}
          <div className="col-span-12 lg:col-span-7 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
            <div className="flex items-end justify-between gap-3 mb-3">
              <div>
                <div className="text-white font-semibold text-lg">
                  {barMode === "region"
                    ? "Region-wise Distribution"
                    : `SubRegion-wise • ${expandedRegion}`}
                </div>
                <div className="text-xs text-white/60">
                  KPI:{" "}
                  <span className="text-white/90 font-semibold">
                    {meta.label}
                  </span>
                </div>
              </div>
              <div className="text-xs text-white/60">
                {barData.length} bar(s)
              </div>
            </div>

            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  margin={{ top: 18, right: 10, bottom: 10, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.08)"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                    tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                    tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
                  />

                  <Tooltip
                    content={(p) => (
                      <PrettyTooltip
                        {...p}
                        meta={{
                          title: barMode === "region" ? "Region" : "SubRegion",
                          kpi: meta.label,
                          accentHex:
                            barMode === "region"
                              ? "#22d3ee"
                              : regionHex(expandedRegion ?? "Central"),
                          lookup:
                            barMode === "region" ? regionLookup : subLookup,
                        }}
                      />
                    )}
                  />

                  <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                    {barData.map((d: any) => {
                      const fill =
                        barMode === "region"
                          ? regionHex(String(d.name))
                          : regionHex(expandedRegion ?? "Central");
                      return <Cell key={String(d.name)} fill={fill} />;
                    })}
                    <LabelList
                      dataKey="value"
                      position="top"
                      fill="rgba(255,255,255,0.92)"
                      fontSize={11}
                      formatter={(v: any) => Number(v ?? 0).toLocaleString()}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 text-xs text-white/60">
              Tip: Click a Region (card or table) to switch this chart into
              SubRegion view.
            </div>
          </div>

          {/* Donut (40%) */}
          {/* Donut (40%) */}
          <div className="col-span-12 lg:col-span-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
            <div className="flex items-end justify-between gap-3 mb-3">
              <div>
                <div className="text-white font-semibold text-lg">
                  Region Share
                </div>
                <div className="text-xs text-white/60">
                  KPI:{" "}
                  <span className="text-white/90 font-semibold">
                    {meta.label}
                  </span>
                </div>
              </div>
              <div className="text-xs text-white/60">
                {donutData.length} slice(s)
              </div>
            </div>

            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={(p) => (
                      <PrettyTooltip
                        {...p}
                        meta={{
                          title: "Region",
                          kpi: meta.label,
                          accentHex: "#22d3ee",
                          lookup: regionLookup,
                        }}
                      />
                    )}
                  />

                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="84%"
                    paddingAngle={4}
                    stroke="rgba(255,255,255,0.08)"
                    labelLine={false}
                    label={DonutLabel}
                  >
                    {donutData.map((d) => (
                      <Cell key={d.name} fill={d.hex} />
                    ))}
                  </Pie>

                  {/* Center text: total */}
                  <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="rgba(255,255,255,0.92)"
                    fontSize={18}
                    fontWeight={900}
                  >
                    {donutData
                      .reduce((s, d) => s + Number(d.value ?? 0), 0)
                      .toLocaleString()}
                  </text>
                  <text
                    x="50%"
                    y="50%"
                    dy={22}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="rgba(255,255,255,0.55)"
                    fontSize={12}
                    fontWeight={700}
                  >
                    total
                  </text>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ===== MERGED TABLE (Region -> Subregion accordion, modern UI) ===== */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div>
              <div className="text-white font-semibold">Region Summary</div>
              <div className="text-xs text-white/60">
                Click a{" "}
                <span className="text-white/80 font-semibold">Region</span> row
                to expand. Drilldown remains on{" "}
                <span className="text-white/80 font-semibold">
                  SubRegion KPI
                </span>{" "}
                cells.
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {expandedRegion ? (
                <>
                  <span className="text-white/60">Focused:</span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/90">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        background: regionHex(expandedRegion),
                        boxShadow: `0 0 10px ${rgbaFromHex(
                          regionHex(expandedRegion),
                          0.45
                        )}`,
                      }}
                    />
                    {expandedRegion}
                  </span>

                  <button
                    type="button"
                    onClick={() => toggleRegion(expandedRegion)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/80 hover:bg-white/10 transition"
                    title="Collapse"
                  >
                    Collapse
                  </button>
                </>
              ) : (
                <span className="text-white/55">Focused: none</span>
              )}
            </div>
          </div>

          <div className="overflow-auto">
            <table className="min-w-[1650px] w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-950/70 backdrop-blur text-white/85">
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left font-semibold">Name</th>

                  <th className="px-3 py-3 text-right font-semibold">
                    Overall
                  </th>
                  <th className="px-3 py-3 text-right font-semibold">RMS</th>

                  <th className="px-3 py-3 text-right font-semibold">
                    Disconnected
                  </th>
                  <th className="px-3 py-3 text-right font-semibold">IP Yes</th>
                  <th className="px-3 py-3 text-right font-semibold">IP No</th>
                  <th className="px-3 py-3 text-right font-semibold">1P</th>
                  <th className="px-3 py-3 text-right font-semibold">2P</th>
                  <th className="px-3 py-3 text-right font-semibold">
                    Batt&lt;70
                  </th>
                  <th className="px-3 py-3 text-right font-semibold">
                    Shortfall
                  </th>
                  <th className="px-3 py-3 text-right font-semibold">
                    Critical
                  </th>
                  <th className="px-3 py-3 text-right font-semibold">Extra</th>
                  <th className="px-3 py-3 text-right font-semibold">
                    AC Norm
                  </th>
                  <th className="px-3 py-3 text-right font-semibold">AC Abn</th>
                </tr>
              </thead>

              <tbody className="text-white/90">
                {(() => {
                  const visibleRegions = expandedRegion
                    ? regionRows.filter(
                        (r) =>
                          safeText(r.region, "").toLowerCase() ===
                          expandedRegion.toLowerCase()
                      )
                    : regionRows;

                  const regionKpiMax = Math.max(
                    ...regionRows.map((x) => n((x as any)[kpiKey])),
                    0
                  );

                  return visibleRegions.map((rr, idx) => {
                    const name = safeText(rr.region, "-");
                    const hex = regionHex(name);
                    const isOpen =
                      expandedRegion?.toLowerCase() === name.toLowerCase();

                    const subRows = subRowsAll.filter(
                      (s) =>
                        safeText(s.region, "").toLowerCase() ===
                        name.toLowerCase()
                    );

                    return (
                      <React.Fragment key={`${name}-${idx}`}>
                        {/* ================= REGION ROW ================= */}
                        <tr
                          onClick={() => toggleRegion(name)}
                          className={[
                            "border-b border-white/5 cursor-pointer transition",
                            "hover:bg-white/[0.06]",
                            isOpen ? "bg-white/[0.05]" : "bg-white/[0.02]",
                          ].join(" ")}
                          style={{
                            boxShadow: isOpen ? glow(hex) : undefined,
                          }}
                          title="Click to expand subregions"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className="h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{
                                    background: hex,
                                    boxShadow: `0 0 12px ${rgbaFromHex(
                                      hex,
                                      0.45
                                    )}`,
                                  }}
                                />
                                <div className="min-w-0">
                                  <div className="font-semibold text-white truncate">
                                    {name}
                                  </div>
                                  <div className="text-[11px] text-white/55">
                                    Region
                                  </div>
                                </div>
                              </div>

                              <span
                                className={[
                                  "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                                  isOpen
                                    ? "border-white/15 bg-white/10 text-white"
                                    : "border-white/10 bg-white/5 text-white/70",
                                ].join(" ")}
                              >
                                {isOpen ? "Expanded" : "Expand"}
                              </span>
                            </div>
                          </td>

                          {/* Region numbers (not clickable) */}
                          <td className="px-3 py-3 text-right text-white/80">
                            {fmt(rr.overall_sites_count)}
                          </td>
                          <td className="px-3 py-3 text-right text-white/80">
                            {fmt(rr.rms_sites_count)}
                          </td>

                          {/* KPI pill gradient (region-level, not drilldown) */}
                          <td className="px-3 py-3 text-right">
                            <span
                              className="inline-flex min-w-[132px] justify-end px-2 py-1 rounded-md text-white/95"
                              style={cellGradient(
                                n((rr as any)[kpiKey]),
                                regionKpiMax,
                                hex
                              )}
                              title={kpiMeta(kpiKey).label}
                            >
                              {n((rr as any)[kpiKey]).toLocaleString()}
                            </span>
                          </td>

                          <td className="px-3 py-3 text-right text-white/70">
                            {fmt(rr.ip_connectivity_yes)}
                          </td>
                          <td className="px-3 py-3 text-right text-white/70">
                            {fmt(rr.ip_connectivity_no)}
                          </td>
                          <td className="px-3 py-3 text-right text-white/70">
                            {fmt(rr.phase_1_missing)}
                          </td>
                          <td className="px-3 py-3 text-right text-white/70">
                            {fmt(rr.phase_2_missing)}
                          </td>
                          <td className="px-3 py-3 text-right text-white/70">
                            {fmt(rr.battery_health_lt70)}
                          </td>
                          <td className="px-3 py-3 text-right text-white/70">
                            {fmt(rr.smr_shortfall_count)}
                          </td>
                          <td className="px-3 py-3 text-right text-white/70">
                            {fmt(rr.critical_shortfall_count)}
                          </td>
                          <td className="px-3 py-3 text-right text-white/70">
                            {fmt(rr.extra_smr_count)}
                          </td>
                          <td className="px-3 py-3 text-right text-white/70">
                            {fmt(rr.ac_spd_normal)}
                          </td>
                          <td className="px-3 py-3 text-right text-white/70">
                            {fmt(rr.ac_spd_abnormal)}
                          </td>
                        </tr>

                        {/* ================= SUBREGION ROWS (ONLY WHEN OPEN) ================= */}
                        {isOpen &&
                          subRows.map((sr, i) => (
                            <tr
                              key={`${name}-${safeText(
                                sr.subregion,
                                "-"
                              )}-${i}`}
                              className="border-b border-white/5 bg-slate-950/20 hover:bg-white/[0.04] transition"
                              title="SubRegion (KPI cells clickable)"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <span
                                    className="h-1.5 w-6 rounded-full"
                                    style={{
                                      background: rgbaFromHex(hex, 0.75),
                                      boxShadow: `0 0 10px ${rgbaFromHex(
                                        hex,
                                        0.25
                                      )}`,
                                    }}
                                  />
                                  <div>
                                    <div className="font-semibold text-white">
                                      {safeText(sr.subregion, "-")}
                                    </div>
                                    <div className="text-[11px] text-white/55">
                                      SubRegion
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="px-3 py-3 text-right text-white/80">
                                {fmt(sr.overall_sites_count)}
                              </td>
                              <td className="px-3 py-3 text-right text-white/80">
                                {fmt(sr.rms_sites_count)}
                              </td>

                              {/* ✅ drilldown stays here */}
                              <td className="px-3 py-3 text-right">
                                <IndicatorCell
                                  subregion={sr.subregion}
                                  indicator="rms_disconnected"
                                  label="RMS Disconnected"
                                  value={sr.rms_disconnected_count}
                                  maxValue={subMax.rms_disconnected_count}
                                  accentHex={hex}
                                />
                              </td>
                              <td className="px-3 py-3 text-right">
                                <IndicatorCell
                                  subregion={sr.subregion}
                                  indicator="ip_yes"
                                  label="IP Connectivity (Yes)"
                                  value={sr.ip_connectivity_yes}
                                  maxValue={subMax.ip_connectivity_yes}
                                  accentHex={hex}
                                />
                              </td>
                              <td className="px-3 py-3 text-right">
                                <IndicatorCell
                                  subregion={sr.subregion}
                                  indicator="ip_no"
                                  label="IP Connectivity (No)"
                                  value={sr.ip_connectivity_no}
                                  maxValue={subMax.ip_connectivity_no}
                                  accentHex={hex}
                                />
                              </td>
                              <td className="px-3 py-3 text-right">
                                <IndicatorCell
                                  subregion={sr.subregion}
                                  indicator="phase_1_missing"
                                  label="1 Phase Missing"
                                  value={sr.phase_1_missing}
                                  maxValue={subMax.phase_1_missing}
                                  accentHex={hex}
                                />
                              </td>
                              <td className="px-3 py-3 text-right">
                                <IndicatorCell
                                  subregion={sr.subregion}
                                  indicator="phase_2_missing"
                                  label="2 Phase Missing"
                                  value={sr.phase_2_missing}
                                  maxValue={subMax.phase_2_missing}
                                  accentHex={hex}
                                />
                              </td>
                              <td className="px-3 py-3 text-right">
                                <IndicatorCell
                                  subregion={sr.subregion}
                                  indicator="battery_lt70"
                                  label="Battery Bank Health <70% (Yes)"
                                  value={sr.battery_health_lt70}
                                  maxValue={subMax.battery_health_lt70}
                                  accentHex={hex}
                                />
                              </td>
                              <td className="px-3 py-3 text-right">
                                <IndicatorCell
                                  subregion={sr.subregion}
                                  indicator="smr_shortfall"
                                  label="SMR Shortfall"
                                  value={sr.smr_shortfall_count}
                                  maxValue={subMax.smr_shortfall_count}
                                  accentHex={hex}
                                />
                              </td>
                              <td className="px-3 py-3 text-right">
                                <IndicatorCell
                                  subregion={sr.subregion}
                                  indicator="critical_shortfall"
                                  label="Critical Shortfall (<95%)"
                                  value={sr.critical_shortfall_count}
                                  maxValue={subMax.critical_shortfall_count}
                                  accentHex={hex}
                                />
                              </td>
                              <td className="px-3 py-3 text-right">
                                <IndicatorCell
                                  subregion={sr.subregion}
                                  indicator="extra_smr"
                                  label="Extra SMR"
                                  value={sr.extra_smr_count}
                                  maxValue={subMax.extra_smr_count}
                                  accentHex={hex}
                                />
                              </td>
                              <td className="px-3 py-3 text-right">
                                <IndicatorCell
                                  subregion={sr.subregion}
                                  indicator="ac_spd_normal"
                                  label="AC SPD Normal"
                                  value={sr.ac_spd_normal}
                                  maxValue={subMax.ac_spd_normal}
                                  accentHex={hex}
                                />
                              </td>
                              <td className="px-3 py-3 text-right">
                                <IndicatorCell
                                  subregion={sr.subregion}
                                  indicator="ac_spd_abnormal"
                                  label="AC SPD Abnormal"
                                  value={sr.ac_spd_abnormal}
                                  maxValue={subMax.ac_spd_abnormal}
                                  accentHex={hex}
                                />
                              </td>
                            </tr>
                          ))}

                        {/* empty state when expanded but no subregions */}
                        {isOpen && subRows.length === 0 && (
                          <tr className="border-b border-white/5 bg-slate-950/20">
                            <td
                              className="px-4 py-4 text-white/60"
                              colSpan={14}
                            >
                              No subregions found for{" "}
                              <span className="text-white font-semibold">
                                {name}
                              </span>
                              .
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  });
                })()}

                {!loading && regionRows.length === 0 && (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-white/60"
                      colSpan={14}
                    >
                      No data found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 text-xs text-white/55 border-t border-white/10">
            Tip: Expand a Region to focus. Collapse to see all Regions again.
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Fragment row (Region + expandable SubRegions)
========================= */
/* =========================
   Region + expandable SubRegions row (single component)
========================= */

function RegionExpandableRow(props: {
  regionName: string;
  regionHex: string;
  isOpen: boolean;
  onToggle: () => void;

  regionRow: RegionRow;
  regionKpi: number;
  regionKpiMax: number;

  kpiKey: KpiKey;
  subRows: SubregionRow[];
  subMax: Record<string, number>;
}) {
  const {
    regionName,
    regionHex,
    isOpen,
    onToggle,
    regionRow,
    regionKpi,
    regionKpiMax,
    kpiKey,
    subRows,
    subMax,
  } = props;

  const meta = kpiMeta(kpiKey);

  return (
    <React.Fragment>
      {/* REGION ROW */}
      <tr
        className={[
          "border-b border-white/5 transition cursor-pointer",
          "hover:bg-white/5",
          isOpen ? "bg-white/[0.04]" : "",
        ].join(" ")}
        onClick={onToggle}
        title="Click to expand subregions"
        style={{ boxShadow: isOpen ? glow(regionHex) : undefined }}
      >
        <td className="px-4 py-3 text-white/70">Region</td>

        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {chipDot(regionHex)}
            <span className="text-white font-semibold">{regionName}</span>
            <span className="ml-2 text-xs text-white/60">
              {isOpen ? "▼ Expanded" : "▶ Expand"}
            </span>
          </div>
        </td>

        <td className="px-3 py-3 text-right text-white/80">
          {fmt(regionRow.overall_sites_count)}
        </td>
        <td className="px-3 py-3 text-right text-white/80">
          {fmt(regionRow.rms_sites_count)}
        </td>

        {/* Region KPI gradient (not drilldown) */}
        <td className="px-3 py-3 text-right">
          <span
            className="inline-flex min-w-[130px] justify-end px-2 py-1 rounded-md text-white"
            style={cellGradient(regionKpi, regionKpiMax, regionHex)}
            title={meta.label}
          >
            {regionKpi.toLocaleString()}
          </span>
        </td>

        {/* Remaining columns (region-level not clickable) */}
        <td className="px-3 py-3 text-right text-white/70">
          {fmt(regionRow.ip_connectivity_yes)}
        </td>
        <td className="px-3 py-3 text-right text-white/70">
          {fmt(regionRow.ip_connectivity_no)}
        </td>
        <td className="px-3 py-3 text-right text-white/70">
          {fmt(regionRow.phase_1_missing)}
        </td>
        <td className="px-3 py-3 text-right text-white/70">
          {fmt(regionRow.phase_2_missing)}
        </td>
        <td className="px-3 py-3 text-right text-white/70">
          {fmt(regionRow.battery_health_lt70)}
        </td>
        <td className="px-3 py-3 text-right text-white/70">
          {fmt(regionRow.smr_shortfall_count)}
        </td>
        <td className="px-3 py-3 text-right text-white/70">
          {fmt(regionRow.critical_shortfall_count)}
        </td>
        <td className="px-3 py-3 text-right text-white/70">
          {fmt(regionRow.extra_smr_count)}
        </td>
        <td className="px-3 py-3 text-right text-white/70">
          {fmt(regionRow.ac_spd_normal)}
        </td>
        <td className="px-3 py-3 text-right text-white/70">
          {fmt(regionRow.ac_spd_abnormal)}
        </td>
      </tr>

      {/* SUBREGION ROWS (EXPANDED) */}
      {isOpen &&
        subRows.map((sr, i) => {
          const subName = safeText(sr.subregion, "-");

          return (
            <tr
              key={`${regionName}-${subName}-${i}`}
              className="border-b border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition"
              title="SubRegion row (KPI cells are clickable)"
            >
              <td className="px-4 py-3 text-white/65">SubRegion</td>

              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{
                      background: regionHex,
                      boxShadow: `0 0 12px ${rgbaFromHex(regionHex, 0.4)}`,
                    }}
                  />
                  <span className="text-white font-semibold">{subName}</span>
                </div>
              </td>

              <td className="px-3 py-3 text-right text-white/80">
                {fmt(sr.overall_sites_count)}
              </td>
              <td className="px-3 py-3 text-right text-white/80">
                {fmt(sr.rms_sites_count)}
              </td>

              <td className="px-3 py-3 text-right">
                <IndicatorCell
                  subregion={sr.subregion}
                  indicator="rms_disconnected"
                  label="RMS Disconnected"
                  value={sr.rms_disconnected_count}
                  maxValue={subMax.rms_disconnected_count}
                  accentHex={regionHex}
                />
              </td>

              <td className="px-3 py-3 text-right">
                <IndicatorCell
                  subregion={sr.subregion}
                  indicator="ip_yes"
                  label="IP Connectivity (Yes)"
                  value={sr.ip_connectivity_yes}
                  maxValue={subMax.ip_connectivity_yes}
                  accentHex={regionHex}
                />
              </td>

              <td className="px-3 py-3 text-right">
                <IndicatorCell
                  subregion={sr.subregion}
                  indicator="ip_no"
                  label="IP Connectivity (No)"
                  value={sr.ip_connectivity_no}
                  maxValue={subMax.ip_connectivity_no}
                  accentHex={regionHex}
                />
              </td>

              <td className="px-3 py-3 text-right">
                <IndicatorCell
                  subregion={sr.subregion}
                  indicator="phase_1_missing"
                  label="1 Phase Missing"
                  value={sr.phase_1_missing}
                  maxValue={subMax.phase_1_missing}
                  accentHex={regionHex}
                />
              </td>

              <td className="px-3 py-3 text-right">
                <IndicatorCell
                  subregion={sr.subregion}
                  indicator="phase_2_missing"
                  label="2 Phase Missing"
                  value={sr.phase_2_missing}
                  maxValue={subMax.phase_2_missing}
                  accentHex={regionHex}
                />
              </td>

              <td className="px-3 py-3 text-right">
                <IndicatorCell
                  subregion={sr.subregion}
                  indicator="battery_lt70"
                  label="Battery Bank Health <70% (Yes)"
                  value={sr.battery_health_lt70}
                  maxValue={subMax.battery_health_lt70}
                  accentHex={regionHex}
                />
              </td>

              <td className="px-3 py-3 text-right">
                <IndicatorCell
                  subregion={sr.subregion}
                  indicator="smr_shortfall"
                  label="SMR Shortfall"
                  value={sr.smr_shortfall_count}
                  maxValue={subMax.smr_shortfall_count}
                  accentHex={regionHex}
                />
              </td>

              <td className="px-3 py-3 text-right">
                <IndicatorCell
                  subregion={sr.subregion}
                  indicator="critical_shortfall"
                  label="Critical Shortfall (<95%)"
                  value={sr.critical_shortfall_count}
                  maxValue={subMax.critical_shortfall_count}
                  accentHex={regionHex}
                />
              </td>

              <td className="px-3 py-3 text-right">
                <IndicatorCell
                  subregion={sr.subregion}
                  indicator="extra_smr"
                  label="Extra SMR"
                  value={sr.extra_smr_count}
                  maxValue={subMax.extra_smr_count}
                  accentHex={regionHex}
                />
              </td>

              <td className="px-3 py-3 text-right">
                <IndicatorCell
                  subregion={sr.subregion}
                  indicator="ac_spd_normal"
                  label="AC SPD Normal"
                  value={sr.ac_spd_normal}
                  maxValue={subMax.ac_spd_normal}
                  accentHex={regionHex}
                />
              </td>

              <td className="px-3 py-3 text-right">
                <IndicatorCell
                  subregion={sr.subregion}
                  indicator="ac_spd_abnormal"
                  label="AC SPD Abnormal"
                  value={sr.ac_spd_abnormal}
                  maxValue={subMax.ac_spd_abnormal}
                  accentHex={regionHex}
                />
              </td>
            </tr>
          );
        })}

      {isOpen && subRows.length === 0 && (
        <tr className="border-b border-white/5 bg-white/[0.02]">
          <td className="px-4 py-4 text-white/60" colSpan={15}>
            No subregions found for{" "}
            <span className="text-white font-semibold">{regionName}</span>.
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

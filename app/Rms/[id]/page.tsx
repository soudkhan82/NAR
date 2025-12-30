"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import supabase from "@/app/config/supabase-config";

/**
 * We don’t hardcode the full RMS schema here because it’s huge and may evolve.
 * Instead, we keep it type-safe by:
 *  - modeling known keys we use directly
 *  - allowing additional fields as unknown
 */
type RmsRecord = {
  id?: number;
  DeviceName?: string | null;
  SiteName?: string | null;
  Region?: string | null;
  SubRegion?: string | null;
  RMS?: string | null;
} & Record<string, unknown>;

type Entry = readonly [key: string, value: unknown];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeRows(data: unknown): RmsRecord[] {
  if (!Array.isArray(data)) return [];
  const rows: RmsRecord[] = [];
  for (const item of data) {
    if (isRecord(item)) rows.push(item as RmsRecord);
  }
  return rows;
}

function prettyLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function formatValue(v: unknown) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.trim() === "" ? "—" : v;
  if (typeof v === "number")
    return Number.isFinite(v) ? v.toLocaleString() : String(v);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function isFilled(v: unknown) {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  return true;
}

/* ---------- Category detection ---------- */
function groupKey(col: string) {
  const k = col.toLowerCase();

  if (
    k === "rms" ||
    k.includes("sitename") ||
    k.includes("devicename") ||
    k.includes("region") ||
    k.includes("subregion")
  )
    return "Identity";

  if (
    k.includes("ip") ||
    k.includes("connectivity") ||
    k.includes("rmsstatus") ||
    k.includes("currentrmstype")
  )
    return "Connectivity";

  if (
    k.includes("voltage") ||
    k.includes("current") ||
    k.includes("phase") ||
    k.includes("spd") ||
    k.includes("load")
  )
    return "Power & Electrical";

  if (
    k.includes("smr") ||
    k.includes("rectifier") ||
    k.includes("shortfall") ||
    k.includes("sleep") ||
    k.includes("capacity")
  )
    return "Rectifier & SMR";

  if (
    k.includes("battery") ||
    k.includes("agm") ||
    k.includes("liion") ||
    k.includes("li_ion") ||
    k.includes("bb") ||
    k.includes("cells")
  )
    return "Battery";

  if (
    k.includes("target") ||
    k.includes("dayscount") ||
    k.includes("missingdays")
  )
    return "Targets & Compliance";

  if (
    k.includes("abnormal") ||
    k.includes("reason") ||
    k.includes("health") ||
    k.includes("status")
  )
    return "Health & Alarms";

  return "Other";
}

const GROUP_ORDER = [
  "Identity",
  "Connectivity",
  "Power & Electrical",
  "Rectifier & SMR",
  "Battery",
  "Targets & Compliance",
  "Health & Alarms",
  "Other",
];

function sortGroups(a: string, b: string) {
  return GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b);
}

/* ---------- Light UI palettes per category ---------- */
const CAT: Record<
  string,
  {
    bg: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    title: string;
    meta: string;
    itemBg: string;
    itemBorder: string;
    label: string;
    value: string;
  }
> = {
  Identity: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    badgeBg: "bg-slate-900",
    badgeText: "text-white",
    title: "text-slate-900",
    meta: "text-slate-600",
    itemBg: "bg-white",
    itemBorder: "border-slate-200",
    label: "text-slate-600",
    value: "text-slate-900",
  },
  Connectivity: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    badgeBg: "bg-blue-700",
    badgeText: "text-white",
    title: "text-blue-950",
    meta: "text-blue-700",
    itemBg: "bg-white",
    itemBorder: "border-blue-200",
    label: "text-blue-800",
    value: "text-slate-900",
  },
  "Power & Electrical": {
    bg: "bg-amber-50",
    border: "border-amber-200",
    badgeBg: "bg-amber-700",
    badgeText: "text-white",
    title: "text-amber-950",
    meta: "text-amber-700",
    itemBg: "bg-white",
    itemBorder: "border-amber-200",
    label: "text-amber-800",
    value: "text-slate-900",
  },
  "Rectifier & SMR": {
    bg: "bg-violet-50",
    border: "border-violet-200",
    badgeBg: "bg-violet-700",
    badgeText: "text-white",
    title: "text-violet-950",
    meta: "text-violet-700",
    itemBg: "bg-white",
    itemBorder: "border-violet-200",
    label: "text-violet-800",
    value: "text-slate-900",
  },
  Battery: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    badgeBg: "bg-emerald-700",
    badgeText: "text-white",
    title: "text-emerald-950",
    meta: "text-emerald-700",
    itemBg: "bg-white",
    itemBorder: "border-emerald-200",
    label: "text-emerald-800",
    value: "text-slate-900",
  },
  "Targets & Compliance": {
    bg: "bg-cyan-50",
    border: "border-cyan-200",
    badgeBg: "bg-cyan-700",
    badgeText: "text-white",
    title: "text-cyan-950",
    meta: "text-cyan-700",
    itemBg: "bg-white",
    itemBorder: "border-cyan-200",
    label: "text-cyan-800",
    value: "text-slate-900",
  },
  "Health & Alarms": {
    bg: "bg-rose-50",
    border: "border-rose-200",
    badgeBg: "bg-rose-700",
    badgeText: "text-white",
    title: "text-rose-950",
    meta: "text-rose-700",
    itemBg: "bg-white",
    itemBorder: "border-rose-200",
    label: "text-rose-800",
    value: "text-slate-900",
  },
  Other: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    badgeBg: "bg-gray-800",
    badgeText: "text-white",
    title: "text-gray-900",
    meta: "text-gray-600",
    itemBg: "bg-white",
    itemBorder: "border-gray-200",
    label: "text-gray-700",
    value: "text-slate-900",
  },
};

export default function RmsQueryPage() {
  // ✅ Client-safe: no Promise params. Works in Next 14/15.
  const params = useParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params?.id) ? params?.id?.[0] : params?.id;

  const siteName = useMemo(() => {
    const v = String(rawId ?? "").trim();
    return v ? decodeURIComponent(v).trim() : "";
  }, [rawId]);

  const [rows, setRows] = useState<RmsRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [onlyFilled, setOnlyFilled] = useState(true);

  useEffect(() => {
    if (!siteName) return;

    const run = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        const { data, error } = await supabase
          .from("RMS")
          .select("*")
          .eq("SiteName", siteName);

        if (error) throw new Error(error.message);
        setRows(normalizeRows(data));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load RMS data.";
        setErrorMsg(msg);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [siteName]);

  const q = query.trim().toLowerCase();

  const processed = useMemo(() => {
    return rows.map((row) => {
      const record = row as Record<string, unknown>;
      const entries: Entry[] = Object.entries(record)
        .filter(([k]) => k !== "id")
        .map(([k, v]) => [k, v] as const);

      const filtered: Entry[] = entries.filter(([k, v]) => {
        if (onlyFilled && !isFilled(v)) return false;
        if (!q) return true;
        const label = prettyLabel(k).toLowerCase();
        const value = formatValue(v).toLowerCase();
        return (
          label.includes(q) || value.includes(q) || k.toLowerCase().includes(q)
        );
      });

      const grouped: Record<string, Entry[]> = {};
      for (const [k, v] of filtered) {
        const g = groupKey(k);
        if (!grouped[g]) grouped[g] = [];
        grouped[g].push([k, v] as const);
      }

      const groupNames = Object.keys(grouped).sort(sortGroups);
      for (const gn of groupNames) {
        grouped[gn].sort((a, b) =>
          prettyLabel(a[0]).localeCompare(prettyLabel(b[0]))
        );
      }

      return { row, groupNames, grouped };
    });
  }, [rows, q, onlyFilled]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs text-white">
                  RMS Indicators
                </div>

                <h1 className="mt-3 text-3xl font-semibold text-slate-900">
                  RMS Query
                </h1>

                <p className="mt-1 text-sm text-slate-600">
                  SiteName:{" "}
                  <span className="font-semibold text-slate-900">
                    {siteName || "-"}
                  </span>
                  {" • "}
                  Records:{" "}
                  <span className="font-semibold text-slate-900">
                    {rows.length}
                  </span>
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Grouped view with high readability. Search and filter
                  indicators instantly.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/Rms"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 hover:bg-slate-50"
                >
                  Back to RMS
                </Link>
              </div>
            </div>

            {/* Controls */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs text-slate-500">Search</div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Voltage, SMR, Battery, IP, Abnormal..."
                  className="mt-1 w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <button
                type="button"
                onClick={() => setOnlyFilled((v) => !v)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 hover:bg-slate-50"
              >
                {onlyFilled ? "Filled only" : "All fields"}
              </button>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {loading
                  ? "Loading…"
                  : errorMsg
                  ? `Error: ${errorMsg}`
                  : "Ready"}
              </div>
            </div>
          </div>
        </div>

        {/* Empty state */}
        {!loading && !errorMsg && rows.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm">
            No RMS record found for this SiteName.
          </div>
        )}

        {/* Records */}
        {!loading && !errorMsg && rows.length > 0 && (
          <div className="space-y-4">
            {processed.map(({ row, groupNames, grouped }, idx) => {
              const deviceName =
                typeof row.DeviceName === "string" ? row.DeviceName : null;
              const recordTitle =
                rows.length > 1
                  ? `RMS Record ${idx + 1}${
                      deviceName ? ` • ${deviceName}` : ""
                    }`
                  : `RMS Indicators${deviceName ? ` • ${deviceName}` : ""}`;

              return (
                <div
                  key={String(row.id ?? idx)}
                  className="rounded-3xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        {recordTitle}
                      </h2>
                      {typeof row.id === "number" && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          id:{" "}
                          <span className="font-semibold text-slate-700">
                            {row.id}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-5 space-y-5">
                    {groupNames.map((gname) => {
                      const ui = CAT[gname] ?? CAT.Other;
                      const items = grouped[gname] ?? [];

                      return (
                        <div
                          key={gname}
                          className={`rounded-3xl border ${ui.border} ${ui.bg}`}
                        >
                          <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${ui.badgeBg} ${ui.badgeText}`}
                              >
                                {gname}
                              </span>
                              <span
                                className={`text-sm font-semibold ${ui.title}`}
                              >
                                {gname}
                              </span>
                            </div>
                            <div className={`text-xs ${ui.meta}`}>
                              Fields:{" "}
                              <span className={`font-semibold ${ui.title}`}>
                                {items.length}
                              </span>
                            </div>
                          </div>

                          <div className="p-5">
                            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                              {items.map(([k, v]) => (
                                <div
                                  key={k}
                                  className={`rounded-2xl border ${ui.itemBorder} ${ui.itemBg} p-3 hover:shadow-sm transition`}
                                >
                                  <div
                                    className={`text-[11px] leading-4 ${ui.label}`}
                                  >
                                    {prettyLabel(k)}
                                  </div>
                                  <div
                                    className={`mt-1 text-sm font-semibold ${ui.value} break-words`}
                                  >
                                    {formatValue(v)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-xs text-slate-500 px-1">
          Tip: Search{" "}
          <span className="font-semibold text-slate-800">Voltage</span>,{" "}
          <span className="font-semibold text-slate-800">SMR</span>,{" "}
          <span className="font-semibold text-slate-800">Battery</span>,{" "}
          <span className="font-semibold text-slate-800">IP</span>.
        </div>
      </div>
    </div>
  );
}

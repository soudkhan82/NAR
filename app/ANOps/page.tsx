// app/ANOps/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";

/* ---------------- Types (mirror your RPC shapes) ---------------- */
type SiteClass = "PGS" | "SB" | "ALL";

type SiteRow = { SubRegion: string | null };
type SiteDetailRow = {
  SiteName: string;
  ProjectName: string | null;
  Status: string | null;
  Attempt_date: string | null;
  v2g: number | null;
  v3g: number | null;
  v4g: number | null;
  voverall: number | null; // NEW
};
type TimeseriesRow = {
  dt: string;
  v2g?: number | null;
  v3g?: number | null;
  v4g?: number | null;
  voverall?: number | null; // NEW
};
type AttemptStatusRow = {
  dt: string;
  attempted?: number | null;
  resolved?: number | null;
};

type FilterState = {
  projects: string[];
  siteClass: SiteClass;
  subregion: string | null;
  district: string | null;
  grid: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  site: string | null;
  search: string | null;
};

type SortKey = "v2g" | "v3g" | "v4g" | "voverall";
type SortDirection = "asc" | "desc";
type SortConfig = {
  key: SortKey;
  direction: SortDirection;
} | null;

/* --------------- Dynamic RPC loader (client-only) --------------- */
type RpcModule = {
  fetchProjectNames: () => Promise<string[]>;
  fetchFilterOptions: (
    projects: string[] | null,
    siteClass: SiteClass
  ) => Promise<{ subregions: string[]; districts: string[]; grids: string[] }>;
  fetchSites: (args: {
    projects: string[];
    siteClass: SiteClass;
    subregion: string | null;
    district: string | null;
    grid: string | null;
    search: string | null;
  }) => Promise<SiteRow[]>;
  fetchSitesDetail: (args: {
    projects: string[];
    siteClass: SiteClass;
    subregion: string | null;
    district: string | null;
    grid: string | null;
    dateFrom: string | null;
    dateTo: string | null;
    search: string | null;
  }) => Promise<SiteDetailRow[]>;
  fetchTimeseries: (args: {
    dateFrom: string | null;
    dateTo: string | null;
    projects: string[];
    site: string | null;
    siteClass: SiteClass;
    subregion: string | null;
    district: string | null;
    grid: string | null;
  }) => Promise<TimeseriesRow[]>;
  fetchAttemptStatus: (args: {
    dateFrom: string | null;
    dateTo: string | null;
    projects: string[];
    siteClass: SiteClass;
    subregion: string | null;
    district: string | null;
    grid: string | null;
  }) => Promise<AttemptStatusRow[]>;
};

async function loadRpc(): Promise<RpcModule> {
  const mod = await import("@/app/lib/rpc/anops");
  return {
    fetchProjectNames: mod.fetchProjectNames,
    fetchFilterOptions: mod.fetchFilterOptions,
    fetchSites: mod.fetchSites,
    fetchSitesDetail: mod.fetchSitesDetail,
    fetchTimeseries: mod.fetchTimeseries,
    fetchAttemptStatus: mod.fetchAttemptStatus,
  };
}

/* ---------------- Helpers ---------------- */
const DEFAULT_SUBREGION = "South-1";

const computeOverall = (
  v2g: number | null | undefined,
  v3g: number | null | undefined,
  v4g: number | null | undefined
): number | null => {
  const vals = [v2g, v3g, v4g].filter(
    (x): x is number => typeof x === "number" && Number.isFinite(x)
  );
  if (!vals.length) return null;
  return vals.reduce((s, x) => s + x, 0) / vals.length;
};

const emptyFilters: FilterState = {
  projects: [],
  siteClass: "ALL", // default to ALL
  subregion: DEFAULT_SUBREGION,
  district: null,
  grid: null,
  dateFrom: null,
  dateTo: null,
  site: null,
  search: null,
};

const pct = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(2)}%` : "—";

const heat = (
  v: number | null | undefined,
  tech: "2g" | "3g" | "4g" | "overall"
): string => {
  if (typeof v !== "number" || !Number.isFinite(v)) return "transparent";
  const val = Math.max(0, Math.min(100, v));
  const rgb =
    tech === "2g"
      ? [37, 99, 235] // blue
      : tech === "3g"
      ? [5, 150, 105] // green
      : tech === "4g"
      ? [245, 158, 11] // amber
      : [139, 92, 246]; // overall: violet
  const alpha = 0.08 + (val / 100) * 0.22;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
};

const Spinner = () => (
  <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
);

// CSV escaping helper
const toCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/* ---------------- Page ---------------- */
export default function Page() {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [opts, setOpts] = useState<{
    subregions: string[];
    districts: string[];
    grids: string[];
  }>({
    subregions: [],
    districts: [],
    grids: [],
  });
  const [rows, setRows] = useState<SiteDetailRow[]>([]);
  const [ts, setTs] = useState<TimeseriesRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptStatusRow[]>([]);
  const [sitesPool, setSitesPool] = useState<SiteRow[]>([]);

  // sorting only for 2G/3G/4G/Overall
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const rpcRef = useRef<RpcModule | null>(null);
  const getRpc = async () => (rpcRef.current ??= await loadRpc());

  // default last 180 days (client-only)
  useEffect(() => {
    setFilters((f) => {
      if (f.dateFrom || f.dateTo) return f;
      const today = new Date();
      const to = today.toISOString().slice(0, 10);
      const fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - 180);
      const from = fromDate.toISOString().slice(0, 10);
      return { ...f, dateFrom: from, dateTo: to };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Projects
  useEffect(() => {
    (async () => {
      const rpc = await getRpc();
      setProjects(await rpc.fetchProjectNames());
    })();
  }, []);

  // Options; respect "All" (subregion = null)
  useEffect(() => {
    (async () => {
      const rpc = await getRpc();
      const o = await rpc.fetchFilterOptions(
        filters.projects.length ? filters.projects : null,
        filters.siteClass
      );
      setOpts(o);
      setFilters((f) => {
        // If user explicitly chose All (null), keep it
        if (f.subregion === null) {
          return { ...f, site: null };
        }

        // If subregion is non-null but not in the latest list, pick a safe default
        if (!f.subregion || !o.subregions.includes(f.subregion)) {
          const next = o.subregions.includes(DEFAULT_SUBREGION)
            ? DEFAULT_SUBREGION
            : o.subregions[0] ?? null;
          return { ...f, subregion: next ?? null, site: null };
        }
        return f;
      });
    })();
  }, [filters.projects, filters.siteClass]);

  // Sites pool (ignores subregion to compare regions)
  useEffect(() => {
    (async () => {
      if (!filters.projects.length) {
        setSitesPool([]);
        return;
      }
      const rpc = await getRpc();
      const list = await rpc.fetchSites({
        projects: filters.projects,
        siteClass: filters.siteClass,
        subregion: null,
        district: filters.district,
        grid: filters.grid,
        search: filters.search,
      });
      setSitesPool(list);
    })();
  }, [
    filters.projects,
    filters.siteClass,
    filters.district,
    filters.grid,
    filters.search,
  ]);

  // Main data
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (!filters.projects.length) {
          setRows([]);
          setTs([]);
          setAttempts([]);
          return;
        }
        const rpc = await getRpc();
        const [list, tsData, attData] = await Promise.all([
          rpc.fetchSitesDetail({
            projects: filters.projects,
            siteClass: filters.siteClass,
            subregion: filters.subregion,
            district: filters.district,
            grid: filters.grid,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            search: filters.search,
          }),
          rpc.fetchTimeseries({
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            projects: filters.projects,
            site: filters.site,
            siteClass: filters.siteClass,
            subregion: filters.subregion,
            district: filters.district,
            grid: filters.grid,
          }),
          rpc.fetchAttemptStatus({
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            projects: filters.projects,
            siteClass: filters.siteClass,
            subregion: filters.subregion,
            district: filters.district,
            grid: filters.grid,
          }),
        ]);
        setRows(list);
        setTs(tsData);
        setAttempts(attData);
      } finally {
        setLoading(false);
      }
    })();
  }, [filters]);

  /* ---------------- Derived ---------------- */
  const { avg2g, avg3g, avg4g, avgOverall } = useMemo(() => {
    const v2 = ts
      .map((r) => (typeof r.v2g === "number" ? r.v2g : null))
      .filter((n): n is number => n !== null);
    const v3 = ts
      .map((r) => (typeof r.v3g === "number" ? r.v3g : null))
      .filter((n): n is number => n !== null);
    const v4 = ts
      .map((r) => (typeof r.v4g === "number" ? r.v4g : null))
      .filter((n): n is number => n !== null);
    const vo = ts
      .map((r) => (typeof r.voverall === "number" ? r.voverall : null))
      .filter((n): n is number => n !== null);
    const mean = (a: number[]) =>
      a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
    return {
      avg2g: mean(v2),
      avg3g: mean(v3),
      avg4g: mean(v4),
      avgOverall: mean(vo),
    };
  }, [ts]);

  const attemptsTotal = useMemo(
    () =>
      attempts.map((a) => ({
        dt: a.dt,
        total: (a.attempted ?? 0) + (a.resolved ?? 0),
      })),
    [attempts]
  );

  const subregionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of sitesPool) {
      const key = r.SubRegion ?? "—";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([SubRegion, count]) => ({
      SubRegion,
      count,
    }));
  }, [sitesPool]);

  // Sorted rows for table + CSV (only if sortConfig is set)
  const sortedRows = useMemo(() => {
    if (!sortConfig) return rows;
    const { key, direction } = sortConfig;

    const sorted = [...rows].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];

      const aNull = aVal === null || aVal === undefined;
      const bNull = bVal === null || bVal === undefined;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (Number.isNaN(aNum) || Number.isNaN(bNum)) return 0;

      const cmp = aNum === bNum ? 0 : aNum < bNum ? -1 : 1;
      return direction === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [rows, sortConfig]);

  /* ---------------- Handlers ---------------- */
  const onToggleProject = (name: string) => {
    setBusy(true);
    setFilters((f) => {
      const has = f.projects.includes(name);
      return {
        ...f,
        projects: has
          ? f.projects.filter((p) => p !== name)
          : [...f.projects, name],
        site: null,
      };
    });
    setTimeout(() => setBusy(false), 150);
  };

  const onClearProjects = () => {
    setBusy(true);
    setFilters((f) => ({ ...f, projects: [], site: null }));
    setTimeout(() => setBusy(false), 150);
  };

  const onPick = (
    key: keyof Pick<FilterState, "subregion" | "district" | "grid">,
    val: string | null
  ) => {
    setFilters((f) => ({ ...f, [key]: val, site: null }));
  };

  const setSiteClass = (val: SiteClass) =>
    setFilters((f) => ({ ...f, siteClass: val, site: null }));

  const onSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev && prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  };

  const sortIndicator = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return "";
    return sortConfig.direction === "asc" ? "▲" : "▼";
  };

  // Download CSV for Sites & Projects table (uses sortedRows)
  const downloadCsv = () => {
    if (!sortedRows.length) return;

    const headers = [
      "SiteName",
      "ProjectName",
      "Status",
      "Attempt_date",
      "v2g",
      "v3g",
      "v4g",
      "Overall",
    ];

    const lines: string[] = [];
    lines.push(headers.join(","));

    for (const r of sortedRows) {
      const overall =
        typeof r.voverall === "number"
          ? r.voverall
          : computeOverall(r.v2g, r.v3g, r.v4g);

      const rowValues = [
        toCsvValue(r.SiteName),
        toCsvValue(r.ProjectName ?? ""),
        toCsvValue(r.Status ?? ""),
        toCsvValue(r.Attempt_date ?? ""),
        toCsvValue(r.v2g ?? ""),
        toCsvValue(r.v3g ?? ""),
        toCsvValue(r.v4g ?? ""),
        overall != null ? toCsvValue(overall.toFixed(2)) : "",
      ];

      lines.push(rowValues.join(","));
    }

    const csv = lines.join("\r\n");
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    const today = new Date().toISOString().slice(0, 10);
    link.download = `ANOps_Sites_${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="p-4 space-y-5 bg-gradient-to-b from-white to-slate-50">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Access Network — Progress & Availability
        </h1>
        <div className="text-xs text-slate-500">
          Window: <strong>{filters.dateFrom ?? "min"}</strong> →{" "}
          <strong>{filters.dateTo ?? "max"}</strong>
        </div>
      </header>

      {/* Projects + SiteClassification */}
      <section className="rounded-2xl border p-4 bg-gradient-to-r from-sky-50 to-indigo-50 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium">Projects</span>
          <button
            className="text-sm underline disabled:opacity-50"
            disabled={busy}
            onClick={onClearProjects}
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Clearing…
              </span>
            ) : (
              "Clear all"
            )}
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-600">SiteClassification:</span>
          <div className="inline-flex rounded-lg border bg-white shadow-sm overflow-hidden text-xs">
            <button
              className={`px-3 py-1.5 ${
                filters.siteClass === "ALL"
                  ? "bg-indigo-600 text-white"
                  : "hover:bg-slate-50"
              }`}
              onClick={() => setSiteClass("ALL")}
            >
              All
            </button>
            <button
              className={`px-3 py-1.5 border-l ${
                filters.siteClass === "PGS"
                  ? "bg-indigo-600 text-white"
                  : "hover:bg-slate-50"
              }`}
              onClick={() => setSiteClass("PGS")}
            >
              PGS (Platinum/Gold/Strategic)
            </button>
            <button
              className={`px-3 py-1.5 border-l ${
                filters.siteClass === "SB"
                  ? "bg-indigo-600 text-white"
                  : "hover:bg-slate-50"
              }`}
              onClick={() => setSiteClass("SB")}
            >
              SB (Silver/Bronze)
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {projects.map((p) => (
            <label
              key={p}
              className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-white/80 hover:bg-white shadow-sm border"
            >
              <input
                type="checkbox"
                checked={filters.projects.includes(p)}
                onChange={() => onToggleProject(p)}
                disabled={busy}
              />
              <span className="text-sm">{p}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Filters */}
      <section className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <div className="md:col-span-2">
          <label className="text-sm text-slate-600">SubRegion</label>
          <select
            className="w-full border rounded-lg p-2 bg-white"
            value={filters.subregion ?? ""}
            onChange={(e) => onPick("subregion", e.target.value || null)}
          >
            {/* explicit All option */}
            <option value="">All</option>
            {opts.subregions.includes(DEFAULT_SUBREGION) && (
              <option value={DEFAULT_SUBREGION}>
                {DEFAULT_SUBREGION} (default)
              </option>
            )}
            {opts.subregions
              .filter((s) => s !== DEFAULT_SUBREGION)
              .map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-slate-600">District</label>
          <select
            className="w-full border rounded-lg p-2 bg-white"
            value={filters.district ?? ""}
            onChange={(e) => onPick("district", e.target.value || null)}
          >
            <option value="">All</option>
            {opts.districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-slate-600">Grid</label>
          <select
            className="w-full border rounded-lg p-2 bg-white"
            value={filters.grid ?? ""}
            onChange={(e) => onPick("grid", e.target.value || null)}
          >
            <option value="">All</option>
            {opts.grids.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-slate-600">From</label>
          <input
            type="date"
            className="w-full border rounded-lg p-2 bg-white"
            value={filters.dateFrom ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, dateFrom: e.target.value || null }))
            }
          />
        </div>
        <div>
          <label className="text-sm text-slate-600">To</label>
          <input
            type="date"
            className="w-full border rounded-lg p-2 bg-white"
            value={filters.dateTo ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, dateTo: e.target.value || null }))
            }
          />
        </div>
      </section>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            Net Overall (2G/3G/4G)
          </div>
          <div className="mt-1 text-2xl font-semibold text-violet-700">
            {pct(avgOverall)}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            Net Average 2G
          </div>
          <div className="mt-1 text-2xl font-semibold text-sky-700">
            {pct(avg2g)}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            Net Average 3G
          </div>
          <div className="mt-1 text-2xl font-semibold text-emerald-700">
            {pct(avg3g)}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            Net Average 4G
          </div>
          <div className="mt-1 text-2xl font-semibold text-amber-700">
            {pct(avg4g)}
          </div>
        </div>
      </section>

      {/* Main layout */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Table */}
        <div className="lg:col-span-1 rounded-2xl border bg-white shadow-sm p-3 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Sites & Projects</span>
            <div className="flex items-center gap-2">
              <input
                placeholder="Search…"
                className="border rounded-lg p-2 text-xs"
                value={filters.search ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, search: e.target.value || null }))
                }
              />
              <button
                type="button"
                className="px-3 py-2 text-xs rounded-lg border bg-slate-50 hover:bg-slate-100 text-slate-700 disabled:opacity-50"
                disabled={!sortedRows.length}
                onClick={downloadCsv}
              >
                Download CSV
              </button>
            </div>
          </div>

          {/* Selected site + report button */}
          <div className="flex items-center gap-2 mb-2">
            <input
              className="border rounded-lg p-2 text-xs flex-1"
              placeholder="Selected Site"
              value={filters.site ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  site: e.target.value || null,
                }))
              }
            />
            <button
              type="button"
              className="px-3 py-2 text-xs rounded-lg bg-indigo-600 text-white disabled:opacity-50"
              disabled={!filters.site}
              onClick={() => {
                if (!filters.site) return;
                if (typeof window !== "undefined") {
                  window.open(
                    `/sitequery/${encodeURIComponent(filters.site)}`,
                    "_blank"
                  );
                }
              }}
            >
              Site Complete Report
            </button>
          </div>

          <div className="mb-2 text-xs text-slate-600">
            Total: <strong>{sortedRows.length.toLocaleString()}</strong>
          </div>

          <div className="border rounded-lg max-h-[480px] overflow-y-auto overflow-x-auto">
            <table className="w-full table-fixed text-xs min-w-[1000px]">
              <colgroup>
                <col className="w-[12.5%]" />
                <col className="w-[12.5%]" />
                <col className="w-[12.5%]" />
                <col className="w-[12.5%]" />
                <col className="w-[12.5%]" />
                <col className="w-[12.5%]" />
                <col className="w-[12.5%]" />
                <col className="w-[12.5%]" />
              </colgroup>

              <thead className="sticky top-0 bg-slate-50/95 backdrop-blur z-10">
                <tr className="text-left text-slate-600">
                  <th className="p-2">SiteName</th>
                  <th className="p-2">Project</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Attempt</th>
                  <th className="p-2 text-right">
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs font-medium ml-auto"
                      onClick={() => onSort("v2g")}
                    >
                      2G{" "}
                      <span className="text-[10px]">
                        {sortIndicator("v2g")}
                      </span>
                    </button>
                  </th>
                  <th className="p-2 text-right">
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs font-medium ml-auto"
                      onClick={() => onSort("v3g")}
                    >
                      3G{" "}
                      <span className="text-[10px]">
                        {sortIndicator("v3g")}
                      </span>
                    </button>
                  </th>
                  <th className="p-2 text-right">
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs font-medium ml-auto"
                      onClick={() => onSort("v4g")}
                    >
                      4G{" "}
                      <span className="text-[10px]">
                        {sortIndicator("v4g")}
                      </span>
                    </button>
                  </th>
                  <th className="p-2 text-right">
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs font-medium ml-auto"
                      onClick={() => onSort("voverall")}
                    >
                      Overall{" "}
                      <span className="text-[10px]">
                        {sortIndicator("voverall")}
                      </span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r, i) => (
                  <tr
                    key={`${r.SiteName ?? ""}-${r.ProjectName ?? ""}-${i}`}
                    className={`${
                      i % 2 === 0 ? "bg-white" : "bg-slate-50"
                    } hover:bg-indigo-50 cursor-pointer`}
                    onClick={() =>
                      setFilters((f) => ({ ...f, site: r.SiteName }))
                    }
                    title="Click to focus the time-series on this site"
                  >
                    <td className="p-2 whitespace-nowrap overflow-hidden text-ellipsis">
                      {r.SiteName}
                    </td>
                    <td className="p-2 whitespace-nowrap overflow-hidden text-ellipsis">
                      {r.ProjectName ?? "—"}
                    </td>
                    <td className="p-2 whitespace-nowrap overflow-hidden text-ellipsis">
                      {r.Status ?? "—"}
                    </td>
                    <td className="p-2 whitespace-nowrap overflow-hidden text-ellipsis">
                      {r.Attempt_date ?? "—"}
                    </td>
                    <td
                      className="p-2 text-right whitespace-nowrap font-medium rounded"
                      style={{ background: heat(r.v2g, "2g") }}
                    >
                      {pct(r.v2g)}
                    </td>
                    <td
                      className="p-2 text-right whitespace-nowrap font-medium rounded"
                      style={{ background: heat(r.v3g, "3g") }}
                    >
                      {pct(r.v3g)}
                    </td>
                    <td
                      className="p-2 text-right whitespace-nowrap font-medium rounded"
                      style={{ background: heat(r.v4g, "4g") }}
                    >
                      {pct(r.v4g)}
                    </td>
                    <td
                      className="p-2 text-right whitespace-nowrap font-medium rounded"
                      style={{
                        background: heat(
                          typeof r.voverall === "number"
                            ? r.voverall
                            : computeOverall(r.v2g, r.v3g, r.v4g),
                          "overall"
                        ),
                      }}
                    >
                      {pct(
                        typeof r.voverall === "number"
                          ? r.voverall
                          : computeOverall(r.v2g, r.v3g, r.v4g)
                      )}
                    </td>
                  </tr>
                ))}
                {sortedRows.length === 0 && (
                  <tr>
                    <td className="p-4" colSpan={8}>
                      {loading ? "Loading…" : "No rows found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {loading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <Spinner /> Loading…
              </div>
            </div>
          )}
          <div className="text-[11px] text-slate-500 mt-2">
            Attempt_date descending • Click a row to focus chart on that site
          </div>
        </div>

        {/* Charts */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Availability */}
          <div className="rounded-2xl border p-3 bg-white shadow-sm relative">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">
                Availability Trend {filters.site ? `(for ${filters.site})` : ""}
              </span>
            </div>
            <div style={{ width: "100%", height: 360 }}>
              <ResponsiveContainer>
                <LineChart
                  data={ts}
                  margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dt" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: unknown) =>
                      typeof v === "number"
                        ? `${(v as number).toFixed(2)}%`
                        : (v as string)
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="v2g"
                    name="2G"
                    dot={false}
                    stroke="#2563eb"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="v3g"
                    name="3G"
                    dot={false}
                    stroke="#059669"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="v4g"
                    name="4G"
                    dot={false}
                    stroke="#f59e0b"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="voverall"
                    name="Overall"
                    dot={false}
                    stroke="#8b5cf6"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {loading && (
              <div className="absolute inset-0 bg-white/40 flex items-center justify-center">
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <Spinner /> Loading…
                </div>
              </div>
            )}
          </div>

          {/* Attempts (total) */}
          <div className="rounded-2xl border p-3 bg-white shadow-sm relative">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Attempts by Date (Total)</span>
            </div>
            <div style={{ width: "100%", height: 360 }}>
              <ResponsiveContainer>
                <BarChart
                  data={attemptsTotal}
                  margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dt" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="total" name="Total" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {loading && (
              <div className="absolute inset-0 bg-white/40 flex items-center justify-center">
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <Spinner /> Loading…
                </div>
              </div>
            )}
          </div>

          {/* SubRegion counts */}
          <div className="rounded-2xl border p-3 bg-white shadow-sm relative md:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">
                Sites by SubRegion (ignores SubRegion filter)
              </span>
              <span className="text-[11px] text-slate-500">
                Projects/District/Grid/SiteClass applied
              </span>
            </div>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <BarChart
                  data={subregionCounts}
                  margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="SubRegion" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Sites" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

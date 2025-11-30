// app/Availability/page.tsx
"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import {
  fetchSubregionTargets,
  fetchTargetHitlist,
  fetchCellAvailBundle,
  fetchCaDateBounds,
  parseRegion,
  parseFrequency,
  type Region,
  type Frequency,
  type SubregionTargetsRow,
  type HitlistRow,
  type LockedSiteRow,
} from "@/app/lib/rpc/avail";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  CalendarDays,
  Download,
  Info,
  Loader2,
  ArrowUpDown,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  ResponsiveContainer,
} from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

/* ---------------- tiny utils ---------------- */
const num = (x: number | null | undefined, frac = 2): string =>
  typeof x === "number" && Number.isFinite(x)
    ? x.toLocaleString(undefined, { maximumFractionDigits: frac })
    : "—";

// Simple date helpers, no timezone logic
const toLocalISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const calcWindow = (asOf: Date, freq: Frequency): { from: Date; to: Date } => {
  const to = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()); // selected day
  const from = new Date(to);
  if (freq === "Weekly")
    from.setDate(from.getDate() - 7); // last 7 days ending at 'to'
  else if (freq === "Monthly") from.setDate(from.getDate() - 30); // last 30 days ending at 'to'
  return { from, to };
};

const belowFilter = (r: HitlistRow): boolean =>
  typeof r?.avg_overall_pct === "number" &&
  typeof r?.target_pct === "number" &&
  r.avg_overall_pct < r.target_pct;

const dedupeBySite = (rows: HitlistRow[]): HitlistRow[] => {
  const m = new Map<string, HitlistRow>();
  rows.forEach((r) => {
    const k = `${r.site_name}|${r.subregion ?? ""}`;
    if (!m.has(k)) m.set(k, r);
  });
  return [...m.values()];
};

/* ---------------- column/heat typings ---------------- */
type KeyNum =
  | "pgs_target_pct"
  | "sb_target_pct"
  | "pgs_site_count"
  | "sb_site_count"
  | "dg_site_count"
  | "pgs_avg_overall_pct"
  | "sb_avg_overall_pct"
  | "dg_avg_overall_pct"
  | "pgs_achieved_count"
  | "pgs_below_count"
  | "sb_achieved_count"
  | "sb_below_count";

type Range = { min: number; max: number };
type RangeRecord = Record<KeyNum, Range>;

const ALL_KEYS: KeyNum[] = [
  "pgs_target_pct",
  "sb_target_pct",
  "pgs_site_count",
  "sb_site_count",
  "dg_site_count",
  "pgs_avg_overall_pct",
  "sb_avg_overall_pct",
  "dg_avg_overall_pct",
  "pgs_achieved_count",
  "pgs_below_count",
  "sb_achieved_count",
  "sb_below_count",
];

function computeRanges(rows: SubregionTargetsRow[]): RangeRecord {
  const out = {} as RangeRecord;
  for (const key of ALL_KEYS) {
    let min = Number.POSITIVE_INFINITY,
      max = Number.NEGATIVE_INFINITY;
    for (const r of rows) {
      const v = r[key] as unknown as number | null | undefined;
      if (typeof v === "number" && Number.isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    out[key] = {
      min: min === Number.POSITIVE_INFINITY ? 0 : min,
      max: max === Number.NEGATIVE_INFINITY ? 0 : max,
    };
  }
  return out;
}

/* ---------------- tooltip formatter ---------------- */
const pctFormatter = (
  value: ValueType,
  name: NameType
): [React.ReactNode, NameType] => {
  const n = typeof value === "number" ? value : Number(value);
  return [<span style={{ color: "#60a5fa" }}>{`${num(n)}%`}</span>, name];
};

/* ---------------- Local types for district/grid rows ---------------- */
type LevelAggRow = {
  name?: string | null;
  overall?: number | null;
  "2g"?: number | null;
  "3g"?: number | null;
  "4g"?: number | null;
  // in case backend uses slightly different naming
  v2g?: number | null;
  v3g?: number | null;
  v4g?: number | null;
};

/* ================== Inner page ================== */
function AvailabilityInner() {
  /* ----- URL filters ----- */
  const sp = useSearchParams();
  const region: Region = parseRegion(sp.get("region"));
  const frequency: Frequency = parseFrequency(sp.get("freq"));

  // Selected date from query (YYYY-MM-DD), default = today
  const s = sp.get("asOf");
  const asOf = useMemo(() => (s ? new Date(s) : new Date()), [s]);

  const { from, to } = useMemo(
    () => calcWindow(asOf, frequency),
    [asOf, frequency]
  );
  const fromStr = toLocalISO(from);
  const toStr = toLocalISO(to);

  /* ----- data state ----- */
  const [rows, setRows] = useState<SubregionTargetsRow[]>([]);
  const [pgsBelowList, setPgsBelowList] = useState<HitlistRow[]>([]);
  const [sbBelowList, setSbBelowList] = useState<HitlistRow[]>([]);
  const [overallSeries, setOverallSeries] = useState<
    { date: string; overall: number }[]
  >([]);
  const [districtBars, setDistrictBars] = useState<LevelAggRow[]>([]);
  const [gridBars, setGridBars] = useState<LevelAggRow[]>([]);
  const [bounds, setBounds] = useState<{
    minISO: string | null;
    maxISO: string | null;
  }>({ minISO: null, maxISO: null });
  const [lockedSites, setLockedSites] = useState<ReadonlyArray<LockedSiteRow>>(
    []
  );

  /* sorting state for District/Grid tables */
  const [districtSortDir, setDistrictSortDir] = useState<"asc" | "desc">(
    "desc"
  );
  const [gridSortDir, setGridSortDir] = useState<"asc" | "desc">("desc");

  /* ----- load/error state ----- */
  type LoadKey = "bounds" | "kpis" | "trend" | "bars" | "table";
  const [loading, setLoading] = useState<Record<LoadKey, boolean>>({
    bounds: false,
    kpis: false,
    trend: false,
    bars: false,
    table: false,
  });
  const [errors, setErrors] = useState<Record<LoadKey, string | null>>({
    bounds: null,
    kpis: null,
    trend: null,
    bars: null,
    table: null,
  });
  const setLoadingKey = (k: LoadKey, v: boolean) =>
    setLoading((s) => ({ ...s, [k]: v }));
  const setErrorKey = (k: LoadKey, v: string | null) =>
    setErrors((s) => ({ ...s, [k]: v }));

  /* ----- date bounds tip (optional) ----- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingKey("bounds", true);
      setErrorKey("bounds", null);
      try {
        const b = await fetchCaDateBounds();
        if (cancelled) return;
        setBounds({ minISO: b?.minISO ?? null, maxISO: b?.maxISO ?? null });
      } catch (e: unknown) {
        if (!cancelled)
          setErrorKey(
            "bounds",
            e instanceof Error ? e.message : "Failed to load bounds"
          );
      } finally {
        if (!cancelled) setLoadingKey("bounds", false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ----- KPIs + table ----- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingKey("kpis", true);
      setLoadingKey("table", true);
      setErrorKey("kpis", null);
      setErrorKey("table", null);
      try {
        const [roll, pgsList, sbList] = await Promise.all([
          fetchSubregionTargets({ region, asOfISO: toStr, frequency }),
          fetchTargetHitlist({
            region,
            asOfISO: toStr,
            frequency,
            classGroup: "PGS",
          }),
          fetchTargetHitlist({
            region,
            asOfISO: toStr,
            frequency,
            classGroup: "SB",
          }),
        ]);
        if (cancelled) return;

        setRows(roll ?? []);
        setPgsBelowList(
          dedupeBySite((pgsList ?? []).filter(belowFilter)).sort(
            (a, b) => (a.avg_overall_pct ?? 0) - (b.avg_overall_pct ?? 0)
          )
        );
        setSbBelowList(
          dedupeBySite((sbList ?? []).filter(belowFilter)).sort(
            (a, b) => (a.avg_overall_pct ?? 0) - (b.avg_overall_pct ?? 0)
          )
        );
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Failed to load KPIs/table";
        if (!cancelled) {
          setErrorKey("kpis", msg);
          setErrorKey("table", msg);
          setRows([]);
          setPgsBelowList([]);
          setSbBelowList([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingKey("kpis", false);
          setLoadingKey("table", false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [region, frequency, toStr]);

  /* ----- trend + district/grid tables + locked sites ----- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingKey("trend", true);
      setLoadingKey("bars", true);
      setErrorKey("trend", null);
      setErrorKey("bars", null);
      try {
        type DailyRow = Readonly<{ date?: string; overall?: number | null }>;

        const bundle = await fetchCellAvailBundle({
          region,
          subregion: null,
          grid: null,
          district: null,
          sitename: null,
          dateFrom: fromStr,
          dateTo: toStr,
        });

        if (cancelled) return;

        const daily = [...(bundle.daily ?? [])]
          .filter(
            (d): d is { date: string; overall: number } =>
              typeof (d as DailyRow).date === "string" &&
              typeof (d as DailyRow).overall === "number" &&
              Number.isFinite((d as DailyRow).overall as number)
          )
          .map((d) => ({ date: (d as DailyRow).date!, overall: d.overall! }));
        setOverallSeries(daily);

        // keep full metric rows as-is; sorting happens in useMemo
        setDistrictBars([...(bundle.by_district ?? [])] as LevelAggRow[]);
        setGridBars([...(bundle.by_grid ?? [])] as LevelAggRow[]);
        setLockedSites(bundle.locked_sites ?? []);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load charts";
        if (!cancelled) {
          setErrorKey("trend", msg);
          setErrorKey("bars", msg);
          setOverallSeries([]);
          setDistrictBars([]);
          setGridBars([]);
          setLockedSites([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingKey("trend", false);
          setLoadingKey("bars", false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [region, fromStr, toStr]);

  /* ----- KPIs (aligned with table totals) ----- */
  const { kpiNetAvg, kpiTotalSites, kpiTotalDG, kpiPgsBelow, kpiSbBelow } =
    useMemo(() => {
      const pgsSites = rows.reduce((s, r) => s + (r.pgs_site_count || 0), 0);
      const sbSites = rows.reduce((s, r) => s + (r.sb_site_count || 0), 0);
      const denom = pgsSites + sbSites || 1;
      const weighted =
        (rows.reduce(
          (s, r) => s + (r.pgs_avg_overall_pct || 0) * (r.pgs_site_count || 0),
          0
        ) +
          rows.reduce(
            (s, r) => s + (r.sb_avg_overall_pct || 0) * (r.sb_site_count || 0),
            0
          )) /
        denom;

      const pgsBelow = rows.reduce((s, r) => s + (r.pgs_below_count || 0), 0);
      const sbBelow = rows.reduce((s, r) => s + (r.sb_below_count || 0), 0);

      return {
        kpiNetAvg: weighted,
        kpiTotalSites: pgsSites + sbSites,
        kpiTotalDG: rows.reduce((s, r) => s + (r.dg_site_count || 0), 0),
        kpiPgsBelow: pgsBelow,
        kpiSbBelow: sbBelow,
      };
    }, [rows]);

  const columnRanges = useMemo<RangeRecord>(() => computeRanges(rows), [rows]);

  /* ----- sorted views for District/Grid tables ----- */
  const sortedDistrictRows = useMemo(() => {
    const copy = [...districtBars];
    copy.sort((a, b) => {
      const av =
        (a.overall ?? (a as any).avg_overall_pct ?? (a as any).value ?? 0) || 0;
      const bv =
        (b.overall ?? (b as any).avg_overall_pct ?? (b as any).value ?? 0) || 0;
      return districtSortDir === "asc" ? av - bv : bv - av;
    });
    return copy;
  }, [districtBars, districtSortDir]);

  const sortedGridRows = useMemo(() => {
    const copy = [...gridBars];
    copy.sort((a, b) => {
      const av =
        (a.overall ?? (a as any).avg_overall_pct ?? (a as any).value ?? 0) || 0;
      const bv =
        (b.overall ?? (b as any).avg_overall_pct ?? (b as any).value ?? 0) || 0;
      return gridSortDir === "asc" ? av - bv : bv - av;
    });
    return copy;
  }, [gridBars, gridSortDir]);

  /* ----- helpers to get 2G/3G/4G values regardless of naming ----- */
  const get2g = (r: LevelAggRow) => r["2g"] ?? r.v2g ?? null;
  const get3g = (r: LevelAggRow) => r["3g"] ?? r.v3g ?? null;
  const get4g = (r: LevelAggRow) => r["4g"] ?? r.v4g ?? null;

  /* ----- UI ----- */
  const BlockLoader = ({ label }: { label?: string }) => (
    <div className="flex items-center justify-center py-8 text-slate-300">
      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
      <span className="text-sm">{label ?? "Loading..."}</span>
    </div>
  );

  return (
    <div className="dark">
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-6 space-y-4">
          {/* Tip: date bounds */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center">
                <Info className="h-4 w-4 text-blue-300" />
              </div>
              <div className="text-xs">
                {loading.bounds ? (
                  <span className="inline-flex items-center">
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    Fetching available date range…
                  </span>
                ) : errors.bounds ? (
                  <span className="text-rose-300">
                    Failed to load date bounds
                  </span>
                ) : bounds.minISO && bounds.maxISO ? (
                  <>
                    Valid data window:{" "}
                    <span className="tabular-nums">{bounds.minISO}</span> →{" "}
                    <span className="tabular-nums">{bounds.maxISO}</span>
                  </>
                ) : (
                  "Date bounds unavailable."
                )}
              </div>
            </div>
            <div className="text-[11px] md:text-xs flex items-center gap-2">
              <Badge variant="secondary">{region}</Badge>
              <Badge variant="outline">{frequency}</Badge>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                <span className="tabular-nums">
                  {fromStr} → {toStr}
                </span>
              </span>
            </div>
          </div>

          {/* Header */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-slate-800 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-teal-300" />
              </div>
              <h1 className="text-lg md:text-xl font-semibold">
                Availability · Summary
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  downloadCsvFor("PGS", pgsBelowList, region, fromStr, toStr)
                }
                disabled={loading.kpis}
              >
                <Download className="h-4 w-4 mr-2" /> PGS
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  downloadCsvFor("SB", sbBelowList, region, fromStr, toStr)
                }
                disabled={loading.kpis}
              >
                <Download className="h-4 w-4 mr-2" /> SB
              </Button>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Net Avg Overall", value: `${num(kpiNetAvg)}%` },
              { label: "Distinct Sites", value: num(kpiTotalSites) },
              { label: "DG Sites", value: num(kpiTotalDG) },
              { label: "PGS Below", value: num(kpiPgsBelow, 0) },
              { label: "SB Below", value: num(kpiSbBelow, 0) },
            ].map((k) => (
              <Card key={k.label} className="border-slate-800 bg-slate-900/70">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs text-slate-300">
                    {k.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 min-h-[56px] flex items-center">
                  {loading.kpis ? (
                    <BlockLoader />
                  ) : errors.kpis ? (
                    <span className="text-rose-300 text-sm">Failed</span>
                  ) : (
                    <div className="text-2xl font-semibold">{k.value}</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Overall trend + Locked sites table */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            {/* Overall Availability chart */}
            <Card className="border-slate-800 bg-slate-900/70 lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Overall Availability
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {loading.trend ? (
                  <BlockLoader label="Loading trend…" />
                ) : errors.trend ? (
                  <div className="text-rose-300 text-sm">
                    Failed to load trend
                  </div>
                ) : overallSeries.length === 0 ? (
                  <div className="text-slate-300 text-sm py-6">No data</div>
                ) : (
                  <div className="h-[210px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overallSeries} barCategoryGap={8}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "#cbd5e1", fontSize: 11 }}
                        />
                        <YAxis
                          domain={[50, 100]}
                          tickCount={51}
                          tick={{ fill: "#cbd5e1", fontSize: 11 }}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#0f172a",
                            border: "1px solid #334155",
                          }}
                          labelStyle={{ color: "#ffffff" }}
                          formatter={(v: ValueType, n: NameType) =>
                            pctFormatter(v, n)
                          }
                        />
                        <Bar
                          dataKey="overall"
                          name="Overall %"
                          isAnimationActive={false}
                          barSize={18}
                          fill="#86efac"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Locked Sites table */}
            <Card className="border-slate-800 bg-slate-900/70 lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    Locked Sites (excluded)
                  </CardTitle>
                  <span className="text-[11px] text-slate-400">
                    Total: {lockedSites.length}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {loading.trend ? (
                  <BlockLoader label="Loading locked sites…" />
                ) : errors.trend ? (
                  <div className="text-rose-300 text-sm">
                    Failed to load locked sites
                  </div>
                ) : lockedSites.length === 0 ? (
                  <div className="text-slate-300 text-sm py-6">
                    No locked sites in selected window.
                  </div>
                ) : (
                  <div className="h-[280px] lg:h-[320px] overflow-y-auto pr-2">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-slate-900/90">
                        <tr>
                          <th className="text-left py-1 pr-2 font-medium">
                            Site
                          </th>
                          <th className="text-left py-1 pr-2 font-medium">
                            Type
                          </th>
                          <th className="text-left py-1 pr-2 font-medium">
                            Start
                          </th>
                          <th className="text-left py-1 pr-2 font-medium">
                            End
                          </th>
                          <th className="text-left py-1 pr-2 font-medium">
                            Reason
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {lockedSites.map((ls) => (
                          <tr
                            key={`${ls.site_name}-${ls.type}-${
                              ls.start_date ?? ""
                            }-${ls.end_date ?? ""}`}
                            className="border-b border-slate-800/60 last:border-b-0"
                          >
                            <td className="py-1 pr-2 align-top">
                              {ls.site_name}
                            </td>
                            <td className="py-1 pr-2 align-top">{ls.type}</td>
                            <td className="py-1 pr-2 align-top tabular-nums">
                              {ls.start_date ?? "—"}
                            </td>
                            <td className="py-1 pr-2 align-top tabular-nums">
                              {ls.end_date ?? "—"}
                            </td>
                            <td
                              className="py-1 pr-2 align-top max-w-[220px] truncate"
                              title={ls.reason ?? ""}
                            >
                              {ls.reason ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* --- SubRegion table moved ABOVE District/Grid level --- */}
          <SubregionTable rows={rows} columnRanges={columnRanges} />

          {/* District / Grid tables with sorting on Overall */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* District table */}
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    District · Availability (%)
                  </CardTitle>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>Sort Overall</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() =>
                        setDistrictSortDir((d) =>
                          d === "asc" ? "desc" : "asc"
                        )
                      }
                    >
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </Button>
                    <span className="uppercase">{districtSortDir}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {loading.bars ? (
                  <BlockLoader label="Loading districts…" />
                ) : errors.bars ? (
                  <div className="text-rose-300 text-sm">
                    Failed to load districts
                  </div>
                ) : sortedDistrictRows.length === 0 ? (
                  <div className="text-slate-300 text-sm py-6">No data</div>
                ) : (
                  <div className="h-[340px] overflow-y-auto pr-2">
                    <Table>
                      <TableHeader className="sticky top-0 bg-slate-900/90">
                        <TableRow className="border-slate-800">
                          <TableHead>District</TableHead>
                          <TableHead className="text-right">Overall</TableHead>
                          <TableHead className="text-right">2G</TableHead>
                          <TableHead className="text-right">3G</TableHead>
                          <TableHead className="text-right">4G</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedDistrictRows.map((r, idx) => (
                          <TableRow
                            key={`${r.name ?? "district"}-${idx}`}
                            className="border-slate-800"
                          >
                            <TableCell className="font-medium">
                              {r.name ?? "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {`${num(
                                (r.overall ??
                                  (r as any).avg_overall_pct ??
                                  (r as any).value) as number
                              )}%`}
                            </TableCell>
                            <TableCell className="text-right">
                              {`${num(get2g(r) as number)}%`}
                            </TableCell>
                            <TableCell className="text-right">
                              {`${num(get3g(r) as number)}%`}
                            </TableCell>
                            <TableCell className="text-right">
                              {`${num(get4g(r) as number)}%`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Grid table */}
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    Grid · Availability (%)
                  </CardTitle>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>Sort Overall</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() =>
                        setGridSortDir((d) => (d === "asc" ? "desc" : "asc"))
                      }
                    >
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </Button>
                    <span className="uppercase">{gridSortDir}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {loading.bars ? (
                  <BlockLoader label="Loading grids…" />
                ) : errors.bars ? (
                  <div className="text-rose-300 text-sm">
                    Failed to load grids
                  </div>
                ) : sortedGridRows.length === 0 ? (
                  <div className="text-slate-300 text-sm py-6">No data</div>
                ) : (
                  <div className="h-[340px] overflow-y-auto pr-2">
                    <Table>
                      <TableHeader className="sticky top-0 bg-slate-900/90">
                        <TableRow className="border-slate-800">
                          <TableHead>Grid</TableHead>
                          <TableHead className="text-right">Overall</TableHead>
                          <TableHead className="text-right">2G</TableHead>
                          <TableHead className="text-right">3G</TableHead>
                          <TableHead className="text-right">4G</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedGridRows.map((r, idx) => (
                          <TableRow
                            key={`${r.name ?? "grid"}-${idx}`}
                            className="border-slate-800"
                          >
                            <TableCell className="font-medium">
                              {r.name ?? "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {`${num(
                                (r.overall ??
                                  (r as any).avg_overall_pct ??
                                  (r as any).value) as number
                              )}%`}
                            </TableCell>
                            <TableCell className="text-right">
                              {`${num(get2g(r) as number)}%`}
                            </TableCell>
                            <TableCell className="text-right">
                              {`${num(get3g(r) as number)}%`}
                            </TableCell>
                            <TableCell className="text-right">
                              {`${num(get4g(r) as number)}%`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Table (split out just for clarity) ---------------- */
function SubregionTable({
  rows,
  columnRanges,
}: {
  rows: SubregionTargetsRow[];
  columnRanges: Record<keyof SubregionTargetsRow & KeyNum, Range>;
}) {
  return (
    <Card className="border-slate-800 bg-slate-900/70">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">SubRegion Availability</CardTitle>
          <div className="text-[11px] text-slate-400">
            Gradient = value proportion (per column)
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="rounded-lg border border-slate-800 overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-900/90">
              <TableRow className="border-slate-800">
                <TableHead className="w-[180px]">SubRegion</TableHead>
                <TableHead className="w-[110px]">Region</TableHead>
                {ALL_KEYS.map((k) => (
                  <TableHead key={k} className="text-right">
                    {
                      {
                        pgs_target_pct: "PGS Target %",
                        sb_target_pct: "SB Target %",
                        pgs_site_count: "PGS Sites",
                        sb_site_count: "SB Sites",
                        dg_site_count: "DG Sites",
                        pgs_avg_overall_pct: "PGS Avg %",
                        sb_avg_overall_pct: "SB Avg %",
                        dg_avg_overall_pct: "DG Avg %",
                        pgs_achieved_count: "PGS Achieved",
                        pgs_below_count: "PGS Below",
                        sb_achieved_count: "SB Achieved",
                        sb_below_count: "SB Below",
                      }[k]
                    }
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.subregion} className="border-slate-800">
                  <TableCell className="font-medium">{r.subregion}</TableCell>
                  <TableCell>{r.region_key}</TableCell>
                  {ALL_KEYS.map((k) => {
                    const { min, max } = columnRanges[k];
                    const val = r[k] as unknown as number | null | undefined;
                    const isPct =
                      k === "pgs_target_pct" ||
                      k === "sb_target_pct" ||
                      k === "pgs_avg_overall_pct" ||
                      k === "sb_avg_overall_pct" ||
                      k === "dg_avg_overall_pct";
                    const alpha =
                      k === "pgs_target_pct" || k === "sb_target_pct"
                        ? 0
                        : 0.32;
                    const style =
                      alpha === 0
                        ? undefined
                        : ({
                            backgroundImage: `linear-gradient(to right, hsla(${
                              isPct ? 160 : 220
                            }, 85%, 45%, ${alpha}) ${Math.round(
                              Math.max(
                                0,
                                Math.min(
                                  1,
                                  typeof val === "number" &&
                                    Number.isFinite(val) &&
                                    max > min
                                    ? (val - min) / (max - min)
                                    : 0
                                )
                              ) * 100
                            )}%, transparent 0%)`,
                          } as React.CSSProperties);
                    return (
                      <TableCell
                        key={k}
                        className="text-right relative"
                        style={style}
                      >
                        {isPct ? `${num(val)}%` : num(val, 0)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- CSV helpers ---------------- */
function buildClassCsv(cls: "PGS" | "SB", rows: HitlistRow[]): string {
  const header = [
    "class",
    "site_name",
    "subregion",
    "region_key",
    "achieved_overall_pct",
    "target_pct",
    "gap_pct",
  ].join(",");
  const lines = rows.map((r) => {
    const a = r?.avg_overall_pct ?? 0;
    const t = r?.target_pct ?? 0;
    const g = t - a;
    const vals: Array<string | number> = [
      cls,
      r?.site_name ?? "",
      r?.subregion ?? "",
      r?.region_key ?? "",
      a.toFixed(2),
      t.toFixed(2),
      g.toFixed(2),
    ];
    return vals
      .map((s) => {
        const v = String(s ?? "");
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      })
      .join(",");
  });
  return [header, ...lines].join("\n");
}
function downloadCsvFor(
  cls: "PGS" | "SB",
  rows: HitlistRow[],
  region: Region,
  fromISO: string,
  toISO: string
): void {
  const csv = buildClassCsv(cls, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `below_target_${cls}_${region}_${fromISO}_${toISO}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ================== Default export with Suspense wrapper ================== */
export default function AvailabilityPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Availability…
          </div>
        </div>
      }
    >
      <AvailabilityInner />
    </Suspense>
  );
}

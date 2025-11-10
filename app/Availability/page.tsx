"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  fetchSubregionTargets,
  fetchTargetHitlist,
  fetchCellAvailBundle,
  fetchCaDateBounds, // date min/max tip
  parseRegion,
  parseFrequency,
  type Region,
  type Frequency,
  type SubregionTargetsRow,
  type HitlistRow,
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
import { BarChart3, CalendarDays, Download, Info, Loader2 } from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  ResponsiveContainer,
} from "recharts";

/* ---------------- tiny utils ---------------- */
const num = (x: number | null | undefined, frac: number = 2) =>
  typeof x === "number" && Number.isFinite(x)
    ? x.toLocaleString(undefined, { maximumFractionDigits: frac })
    : "—";

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const calcWindow = (asOf: Date, freq: Frequency) => {
  const to = startOfDay(asOf);
  const from = new Date(to);
  if (freq === "Weekly") from.setDate(from.getDate() - 7);
  else if (freq === "Monthly") from.setDate(from.getDate() - 30);
  return { from, to };
};

const belowFilter = (r: HitlistRow) =>
  typeof r?.avg_overall_pct === "number" &&
  typeof r?.target_pct === "number" &&
  r.avg_overall_pct < r.target_pct;

const dedupeBySite = (rows: HitlistRow[]) => {
  const m = new Map<string, HitlistRow>();
  rows.forEach((r) => {
    const k = `${r.site_name}|${r.subregion ?? ""}`;
    if (!m.has(k)) m.set(k, r);
  });
  return [...m.values()];
};

/* ---------------- gradient helpers ---------------- */
function normalize(val: number | null | undefined, min: number, max: number) {
  if (typeof val !== "number" || !Number.isFinite(val)) return 0;
  if (max <= min) return 1;
  return Math.max(0, Math.min(1, (val - min) / (max - min)));
}
function gradientStyle(
  val: number | null | undefined,
  min: number,
  max: number,
  hue = 160,
  alpha = 0.32
): React.CSSProperties {
  // background removed later for PGS/SB target columns
  const pct = Math.round(normalize(val, min, max) * 100);
  const color = `hsla(${hue}, 85%, 45%, ${alpha})`;
  return {
    backgroundImage: `linear-gradient(to right, ${color} ${pct}%, transparent ${pct}%)`,
  };
}

/* ---------------- component ---------------- */
export default function AvailabilityPage() {
  /* ----- URL filters ----- */
  const sp = useSearchParams();
  const region: Region = parseRegion(sp.get("region"));
  const frequency: Frequency = parseFrequency(sp.get("freq"));
  const asOf = useMemo(() => {
    const s = sp.get("asOf");
    const d = s ? new Date(s) : new Date();
    return Number.isNaN(+d) ? new Date() : d;
  }, [sp]);
  const { from, to } = useMemo(
    () => calcWindow(asOf, frequency),
    [asOf, frequency]
  );
  const fromISO = from.toISOString().slice(0, 10);
  const toISO = to.toISOString().slice(0, 10);

  /* ----- data state ----- */
  const [rows, setRows] = useState<SubregionTargetsRow[]>([]);
  const [pgsBelowList, setPgsBelowList] = useState<HitlistRow[]>([]);
  const [sbBelowList, setSbBelowList] = useState<HitlistRow[]>([]);
  const [overallSeries, setOverallSeries] = useState<
    { date: string; overall: number }[]
  >([]);
  const [districtBars, setDistrictBars] = useState<
    { name: string; value: number }[]
  >([]);
  const [gridBars, setGridBars] = useState<{ name: string; value: number }[]>(
    []
  );
  const [bounds, setBounds] = useState<{
    minISO: string | null;
    maxISO: string | null;
  }>({
    minISO: null,
    maxISO: null,
  });

  /* ----- per-component load/error state ----- */
  const [loading, setLoading] = useState({
    bounds: false,
    kpis: false, // rollup + hitlists
    trend: false, // daily overall
    bars: false, // district + grid
    table: false, // same rows state, but own spinner to avoid flicker
  });
  const [errors, setErrors] = useState<{ [k: string]: string | null }>({
    bounds: null,
    kpis: null,
    trend: null,
    bars: null,
    table: null,
  });

  const setLoadingKey = (k: keyof typeof loading, v: boolean) =>
    setLoading((s) => ({ ...s, [k]: v }));
  const setErrorKey = (k: keyof typeof errors, v: string | null) =>
    setErrors((s) => ({ ...s, [k]: v }));

  /* ----- date bounds tip ----- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingKey("bounds", true);
      setErrorKey("bounds", null);
      try {
        const b = await fetchCaDateBounds();
        if (cancelled) return;
        setBounds({
          minISO: b?.minISO ?? null,
          maxISO: b?.maxISO ?? null,
        });
      } catch (e: any) {
        if (!cancelled)
          setErrorKey("bounds", e?.message ?? "Failed to load bounds");
      } finally {
        if (!cancelled) setLoadingKey("bounds", false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ----- rollup + hitlists (KPIs + table) ----- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingKey("kpis", true);
      setLoadingKey("table", true);
      setErrorKey("kpis", null);
      setErrorKey("table", null);
      try {
        const [roll, pgsList, sbList] = await Promise.all([
          fetchSubregionTargets({ region, asOfISO: toISO, frequency }),
          fetchTargetHitlist({
            region,
            asOfISO: toISO,
            frequency,
            classGroup: "PGS",
          }),
          fetchTargetHitlist({
            region,
            asOfISO: toISO,
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
      } catch (e: any) {
        if (!cancelled) {
          const msg = e?.message ?? "Failed to load KPIs/table";
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
  }, [region, frequency, toISO]);

  /* ----- trend + district/grid bars (bundle) ----- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingKey("trend", true);
      setLoadingKey("bars", true);
      setErrorKey("trend", null);
      setErrorKey("bars", null);
      try {
        const bundle = await fetchCellAvailBundle({
          region,
          subregion: null,
          grid: null,
          district: null,
          sitename: null,
          dateFrom: fromISO,
          dateTo: toISO,
        });
        if (cancelled) return;

        const daily = (bundle.daily ?? []).filter(
          (d) => typeof d.date === "string" && typeof d.overall === "number"
        ) as { date: string; overall: number }[];
        setOverallSeries(daily);

        const byDist = [...(bundle.by_district ?? [])].sort(
          (a, b) => (b.value ?? 0) - (a.value ?? 0)
        );
        const byGrid = [...(bundle.by_grid ?? [])].sort(
          (a, b) => (b.value ?? 0) - (a.value ?? 0)
        );
        setDistrictBars(byDist);
        setGridBars(byGrid);
      } catch (e: any) {
        if (!cancelled) {
          const msg = e?.message ?? "Failed to load charts";
          setErrorKey("trend", msg);
          setErrorKey("bars", msg);
          setOverallSeries([]);
          setDistrictBars([]);
          setGridBars([]);
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
  }, [region, fromISO, toISO]);

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

  /* ----- column heat ranges ----- */
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

  const columnRanges = useMemo(() => {
    const keys: KeyNum[] = [
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
    const ranges = new Map<KeyNum, { min: number; max: number }>();
    keys.forEach((k) => {
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (const r of rows) {
        const v = r[k] as unknown as number | null | undefined;
        if (typeof v === "number" && Number.isFinite(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      if (min === Number.POSITIVE_INFINITY) min = 0;
      if (max === Number.NEGATIVE_INFINITY) max = 0;
      ranges.set(k, { min, max });
    });
    return ranges;
  }, [rows]);

  const COLS: Array<{
    key: KeyNum;
    label: string;
    isPct?: boolean;
    hue?: number;
  }> = [
    { key: "pgs_target_pct", label: "PGS Target %", isPct: true, hue: 160 },
    { key: "sb_target_pct", label: "SB Target %", isPct: true, hue: 160 },
    { key: "pgs_site_count", label: "PGS Sites", hue: 220 },
    { key: "sb_site_count", label: "SB Sites", hue: 220 },
    { key: "dg_site_count", label: "DG Sites", hue: 220 },
    { key: "pgs_avg_overall_pct", label: "PGS Avg %", isPct: true, hue: 160 },
    { key: "sb_avg_overall_pct", label: "SB Avg %", isPct: true, hue: 160 },
    { key: "dg_avg_overall_pct", label: "DG Avg %", isPct: true, hue: 160 },
    { key: "pgs_achieved_count", label: "PGS Achieved", hue: 140 },
    { key: "pgs_below_count", label: "PGS Below", hue: 8 },
    { key: "sb_achieved_count", label: "SB Achieved", hue: 140 },
    { key: "sb_below_count", label: "SB Below", hue: 8 },
  ];

  /* ----- small inline loader ----- */
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
                  {fromISO} → {toISO}
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
                  downloadCsvFor("PGS", pgsBelowList, region, fromISO, toISO)
                }
                disabled={loading.kpis}
              >
                <Download className="h-4 w-4 mr-2" /> PGS
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  downloadCsvFor("SB", sbBelowList, region, fromISO, toISO)
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

          {/* Overall trend (bar chart) */}
          <Card className="border-slate-800 bg-slate-900/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Overall Availability</CardTitle>
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
                <div className="h-[240px]">
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
                        labelStyle={{ color: "#ffffff" }} // white label
                        formatter={(v: any) => [
                          <span style={{ color: "#60a5fa" }}>{`${num(
                            v
                          )}%`}</span>, // blue value
                          "Overall %",
                        ]}
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

          {/* District / Grid horizontal bars (scrollable) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* District */}
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  District · Avg Overall (%)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {loading.bars ? (
                  <BlockLoader label="Loading districts…" />
                ) : errors.bars ? (
                  <div className="text-rose-300 text-sm">
                    Failed to load districts
                  </div>
                ) : districtBars.length === 0 ? (
                  <div className="text-slate-300 text-sm py-6">No data</div>
                ) : (
                  <div className="h-[340px] overflow-y-auto pr-2">
                    <div className="h-[600px] min-h-full">
                      {" "}
                      {/* virtual extra space so labels don't cramp */}
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={districtBars}
                          layout="vertical"
                          margin={{ left: 20, top: 4, bottom: 4 }}
                          barCategoryGap={14}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                          <XAxis
                            type="number"
                            domain={[0, 100]}
                            tick={{ fill: "#cbd5e1", fontSize: 11 }}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fill: "#cbd5e1", fontSize: 11 }}
                            width={130}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "#0f172a",
                              border: "1px solid #334155",
                            }}
                            labelStyle={{ color: "#ffffff" }} // white
                            formatter={(v: any) => [
                              <span style={{ color: "#60a5fa" }}>{`${num(
                                v
                              )}%`}</span>, // blue value
                              "Avg %",
                            ]}
                          />
                          <Bar
                            dataKey="value"
                            name="Avg %"
                            isAnimationActive={false}
                            barSize={18}
                            fill="#86efac"
                            activeBar={{ fill: "#000000" }} // hover becomes black bar
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Grid */}
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Grid · Avg Overall (%)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {loading.bars ? (
                  <BlockLoader label="Loading grids…" />
                ) : errors.bars ? (
                  <div className="text-rose-300 text-sm">
                    Failed to load grids
                  </div>
                ) : gridBars.length === 0 ? (
                  <div className="text-slate-300 text-sm py-6">No data</div>
                ) : (
                  <div className="h-[340px] overflow-y-auto pr-2">
                    <div className="h-[600px] min-h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={gridBars}
                          layout="vertical"
                          margin={{ left: 20, top: 4, bottom: 4 }}
                          barCategoryGap={14}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                          <XAxis
                            type="number"
                            domain={[0, 100]}
                            tick={{ fill: "#cbd5e1", fontSize: 11 }}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fill: "#cbd5e1", fontSize: 11 }}
                            width={130}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "#0f172a",
                              border: "1px solid #334155",
                            }}
                            labelStyle={{ color: "#ffffff" }} // white
                            formatter={(v: any) => [
                              <span style={{ color: "#60a5fa" }}>{`${num(
                                v
                              )}%`}</span>, // blue value
                              "Avg %",
                            ]}
                          />
                          <Bar
                            dataKey="value"
                            name="Avg %"
                            isAnimationActive={false}
                            barSize={18}
                            fill="#86efac"
                            activeBar={{ fill: "#000000" }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Availability Table (with gradient cells) */}
          <Card className="border-slate-800 bg-slate-900/70">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  SubRegion Availability
                </CardTitle>
                <div className="text-[11px] text-slate-400">
                  Gradient = value proportion (per column)
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {loading.table ? (
                <BlockLoader label="Loading table…" />
              ) : errors.table ? (
                <div className="text-rose-300 text-sm">
                  Failed to load table
                </div>
              ) : (
                <div className="rounded-lg border border-slate-800 overflow-x-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-slate-900/90">
                      <TableRow className="border-slate-800">
                        <TableHead className="w-[180px]">SubRegion</TableHead>
                        <TableHead className="w-[110px]">Region</TableHead>
                        {COLS.map((c) => (
                          <TableHead key={c.key} className="text-right">
                            {c.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow
                          key={r.subregion}
                          className="border-slate-800"
                        >
                          <TableCell className="font-medium">
                            {r.subregion}
                          </TableCell>
                          <TableCell>{r.region_key}</TableCell>
                          {COLS.map((c) => {
                            const { min, max } = columnRanges.get(c.key)!;
                            const val = r[c.key] as unknown as
                              | number
                              | null
                              | undefined;
                            const alpha =
                              c.key === "pgs_target_pct" ||
                              c.key === "sb_target_pct"
                                ? 0
                                : 0.32; // no bg for targets
                            const style =
                              alpha === 0
                                ? undefined
                                : gradientStyle(
                                    val,
                                    min,
                                    max,
                                    c.hue ?? (c.isPct ? 160 : 220),
                                    alpha
                                  );
                            return (
                              <TableCell
                                key={c.key}
                                className="text-right relative"
                                style={style}
                              >
                                {c.isPct ? `${num(val)}%` : num(val, 0)}
                              </TableCell>
                            );
                          })}
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
  );
}

/* ---------------- CSV helpers ---------------- */
function buildClassCsv(cls: "PGS" | "SB", rows: HitlistRow[]) {
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
    const a = r?.avg_overall_pct ?? 0,
      t = r?.target_pct ?? 0,
      g = t - a;
    const vals = [
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
) {
  const csv = buildClassCsv(cls, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `below_target_${cls}_${region}_${fromISO}_${toISO}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

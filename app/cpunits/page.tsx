"use client";

import { useEffect, useMemo, useState } from "react";
import supabase from "@/app/config/supabase-config";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

/* ---------- Types ---------- */

type CpUnitsSummaryRow = {
  region: string;
  subregion: string;
  site_count: number;
  sum_kwh: number | null;
  avg_base: number | null;
  avg_target: number | null;

  // ✅ score comes from RPC (avg(score) per region/subregion)
  avg_score: number | null;

  target_achieved: number;
  base_achieved: number;
  target_and_base_not_achieved: number;
  zero_or_null_kwh: number;
};

type RegionRow = { region: string };
type SubregionRow = { subregion: string };
type MonthRow = { month: string };

/* Recharts label props */
type PieLabelProps = {
  name?: string;
  percent?: unknown;
};

/* ---------- Helpers ---------- */

function fmt(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function safeNum(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v : 0;
}

/* ---------- RPC wrappers ---------- */

async function fetchRegions(): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_regions");
  if (error) throw error;
  return ((data ?? []) as RegionRow[]).map((x) => x.region).filter(Boolean);
}

async function fetchSubregions(): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_subregions");
  if (error) throw error;
  return ((data ?? []) as SubregionRow[])
    .map((x) => x.subregion)
    .filter(Boolean);
}

async function fetchMonths(params: {
  region?: string | null;
  subregion?: string | null;
}): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_cp_units_months", {
    p_region: params.region ?? null,
    p_subregion: params.subregion ?? null,
  });
  if (error) throw error;
  return ((data ?? []) as MonthRow[]).map((x) => x.month).filter(Boolean);
}

async function fetchSummary(params: {
  region?: string | null;
  subregion?: string | null;
  month?: string | null;
}): Promise<CpUnitsSummaryRow[]> {
  const { data, error } = await supabase.rpc("fetch_cp_units_summary", {
    p_month: params.month ?? null, // month first
    p_region: params.region ?? null,
    p_subregion: params.subregion ?? null,
  });
  if (error) throw error;
  return (data ?? []) as CpUnitsSummaryRow[];
}

/* ---------- Page ---------- */

export default function CpUnitsDashboardPage() {
  const [regions, setRegions] = useState<string[]>([]);
  const [subregions, setSubregions] = useState<string[]>([]);
  const [months, setMonths] = useState<string[]>([]);

  const [region, setRegion] = useState<string>("all");
  const [subregion, setSubregion] = useState<string>("all");
  const [month, setMonth] = useState<string>("all");

  const [rows, setRows] = useState<CpUnitsSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMonths, setLoadingMonths] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load Region/SubRegion picklists
  useEffect(() => {
    (async () => {
      try {
        const [r, sr] = await Promise.all([fetchRegions(), fetchSubregions()]);
        setRegions(r);
        setSubregions(sr);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load filters");
      }
    })();
  }, []);

  // Load Months (scoped by Region/SubRegion)
  useEffect(() => {
    (async () => {
      setLoadingMonths(true);
      try {
        const m = await fetchMonths({
          region: region === "all" ? null : region,
          subregion: subregion === "all" ? null : subregion,
        });

        const unique = Array.from(new Set(m)).filter(Boolean);
        unique.sort((a, b) => a.localeCompare(b));
        setMonths(unique);

        if (month !== "all" && !unique.includes(month)) setMonth("all");
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load months");
        setMonths([]);
        setMonth("all");
      } finally {
        setLoadingMonths(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, subregion]);

  // Load Summary data
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await fetchSummary({
          region: region === "all" ? null : region,
          subregion: subregion === "all" ? null : subregion,
          month: month === "all" ? null : month,
        });
        setRows(data);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load summary");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [region, subregion, month]);

  // Totals + weighted avg score (keeps your existing values, no changes)
  const totals = useMemo(() => {
    let sites = 0;
    let sumKwh = 0;

    let targetAch = 0;
    let baseAch = 0;
    let notAch = 0;
    let zero = 0;

    // weighted score
    let scoreWeightedSum = 0;
    let scoreWeight = 0;

    for (const r of rows) {
      const sc = r.avg_score;
      const w = safeNum(r.site_count);

      sites += safeNum(r.site_count);
      sumKwh += safeNum(r.sum_kwh);

      targetAch += safeNum(r.target_achieved);
      baseAch += safeNum(r.base_achieved);
      notAch += safeNum(r.target_and_base_not_achieved);
      zero += safeNum(r.zero_or_null_kwh);

      if (sc !== null && w > 0) {
        scoreWeightedSum += safeNum(sc) * w;
        scoreWeight += w;
      }
    }

    const avgScore = scoreWeight > 0 ? scoreWeightedSum / scoreWeight : null;

    // score bands (Option A) — for display only
    // We infer bands based on avg_score per group (not per row/site)
    // This preserves your values and adds extra insight.
    let bandHigh = 0; // >= 100
    let bandMid = 0; // 80-99
    let bandLow = 0; // < 80
    for (const r of rows) {
      if (r.avg_score === null) continue;
      const v = safeNum(r.avg_score);
      if (v >= 100) bandHigh += safeNum(r.site_count);
      else if (v >= 80) bandMid += safeNum(r.site_count);
      else bandLow += safeNum(r.site_count);
    }

    return {
      sites,
      sumKwh,
      targetAch,
      baseAch,
      notAch,
      zero,
      avgScore,
      bandHigh,
      bandMid,
      bandLow,
    };
  }, [rows]);

  const pieData = useMemo(
    () => [
      { key: "target", name: "Target Achieved", value: totals.targetAch },
      { key: "base", name: "Base Achieved", value: totals.baseAch },
      { key: "not", name: "Target & Base Not Achieved", value: totals.notAch },
      { key: "zero", name: "Zero/Null KWH", value: totals.zero },
    ],
    [totals]
  );

  const pieColors: Record<string, string> = {
    target: "#16a34a",
    base: "#2563eb",
    not: "#f59e0b",
    zero: "#6b7280",
  };

  const totalPie = pieData.reduce((acc, d) => acc + (d.value ?? 0), 0);
  const hasAny = totalPie > 0;

  const pieLabel = ({ name, percent }: PieLabelProps) => {
    const p = typeof percent === "number" ? percent : Number(percent);
    const pct = Number.isFinite(p) ? `${Math.round(p * 100)}%` : "";
    return name ? `${name}: ${pct}` : pct;
  };

  return (
    <div className="p-6 space-y-6 bg-white text-slate-900">
      {/* Header + Filters (unchanged structure) */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">CP Units Dashboard</h1>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="min-w-[220px]">
            <label className="text-xs font-medium text-slate-600">Region</label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {regions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[240px]">
            <label className="text-xs font-medium text-slate-600">
              SubRegion
            </label>
            <Select value={subregion} onValueChange={setSubregion}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select SubRegion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All SubRegions</SelectItem>
                {subregions.map((sr) => (
                  <SelectItem key={sr} value={sr}>
                    {sr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[200px]">
            <label className="text-xs font-medium text-slate-600">Month</label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="bg-white">
                <SelectValue
                  placeholder={loadingMonths ? "Loading..." : "Select Month"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {err ? (
        <div className="border border-red-200 bg-red-50 text-red-700 rounded-md p-3 text-sm">
          {err}
        </div>
      ) : null}

      {/* ✅ TOP ROW: Totals → Score → Target */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 1) Totals */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Distinct Sites</span>
              <span className="font-semibold">{fmt(totals.sites)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Sum Units (KWH)</span>
              <span className="font-semibold">{fmt(totals.sumKwh, 0)}</span>
            </div>
          </CardContent>
        </Card>

        {/* 2) Score */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Avg CP Score</span>
              <span className="font-semibold">{fmt(totals.avgScore, 0)}</span>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Score ≥ 100 (High)</span>
                <span className="font-semibold">{fmt(totals.bandHigh)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Score 80–99 (Mid)</span>
                <span className="font-semibold">{fmt(totals.bandMid)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Score &lt; 80 (Low)</span>
                <span className="font-semibold">{fmt(totals.bandLow)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3) Target / Achievement */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Target</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Target Achieved</span>
              <span className="font-semibold">{fmt(totals.targetAch)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Base Achieved</span>
              <span className="font-semibold">{fmt(totals.baseAch)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Target+Base Not Achieved</span>
              <span className="font-semibold">{fmt(totals.notAch)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Zero/Null KWH</span>
              <span className="font-semibold">{fmt(totals.zero)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart (keep your existing) */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Achievement Distribution</CardTitle>
          <div className="text-xs text-slate-500">
            {loading ? "Loading…" : `Total: ${fmt(totalPie)}`}
          </div>
        </CardHeader>

        <CardContent className="h-[320px]">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-600">
              Loading…
            </div>
          ) : !hasAny ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-600">
              No data for selected filters
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="58%"
                  outerRadius="85%"
                  paddingAngle={3}
                  strokeWidth={1}
                  labelLine={false}
                  label={pieLabel}
                >
                  {pieData.map((d) => (
                    <Cell key={d.key} fill={pieColors[d.key]} />
                  ))}
                </Pie>

                <Tooltip
                  formatter={(value: any, name: any) => [
                    fmt(Number(value), 0),
                    String(name),
                  ]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Table (unchanged) */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Summary by Region / SubRegion
          </CardTitle>
          <div className="text-xs text-slate-500">
            Rows: {rows.length} {loading ? " • Loading…" : ""}
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-auto border border-slate-200 rounded-md">
            <table className="min-w-[1350px] w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                <tr className="text-left">
                  <th className="px-3 py-2">Region</th>
                  <th className="px-3 py-2">SubRegion</th>
                  <th className="px-3 py-2">Distinct Sites</th>
                  <th className="px-3 py-2">Sum KWH</th>
                  <th className="px-3 py-2">Avg Base</th>
                  <th className="px-3 py-2">Avg Target</th>
                  <th className="px-3 py-2">Avg Score</th>
                  <th className="px-3 py-2">Target Achieved</th>
                  <th className="px-3 py-2">Base Achieved</th>
                  <th className="px-3 py-2">Target+Base Not Achieved</th>
                  <th className="px-3 py-2">Zero/Null KWH</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r, idx) => (
                  <tr
                    key={`${r.region}-${r.subregion}-${idx}`}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2">{r.region}</td>
                    <td className="px-3 py-2">{r.subregion}</td>
                    <td className="px-3 py-2">{fmt(r.site_count)}</td>
                    <td className="px-3 py-2">{fmt(r.sum_kwh, 0)}</td>
                    <td className="px-3 py-2">{fmt(r.avg_base, 0)}</td>
                    <td className="px-3 py-2">{fmt(r.avg_target, 0)}</td>
                    <td className="px-3 py-2 font-semibold">
                      {fmt(r.avg_score, 0)}
                    </td>
                    <td className="px-3 py-2">{fmt(r.target_achieved)}</td>
                    <td className="px-3 py-2">{fmt(r.base_achieved)}</td>
                    <td className="px-3 py-2">
                      {fmt(r.target_and_base_not_achieved)}
                    </td>
                    <td className="px-3 py-2">{fmt(r.zero_or_null_kwh)}</td>
                  </tr>
                ))}

                {!loading && rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-3 py-8 text-center text-slate-600"
                    >
                      No rows returned for selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

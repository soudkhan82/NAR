// app/KPI/DG/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Tooltip,
  Legend,
  CartesianGrid,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import {
  fetchRegions,
  fetchSubRegions,
  fetchMonths,
  fetchSummaryFiltered,
  fetchBreakdownFiltered,
  type SummaryFiltered,
  type BreakdownFilteredRow,
} from "@/app/lib/rpc/dg_kpi";

const fmtNum = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined ? "—" : Number(v).toFixed(digits);

const pct = (part: number, total: number) => {
  if (!total || total <= 0) return "—";
  return `${((part * 100) / total).toFixed(1)}%`;
};

export default function DgKpiPage() {
  const [loading, setLoading] = useState(true);

  const [region, setRegion] = useState<string>("ALL");
  const [subRegion, setSubRegion] = useState<string>("ALL");
  const [month, setMonth] = useState<string>("ALL");

  const [regions, setRegions] = useState<string[]>(["ALL"]);
  const [subRegions, setSubRegions] = useState<string[]>(["ALL"]);
  const [months, setMonths] = useState<string[]>(["ALL"]);

  const [summary, setSummary] = useState<SummaryFiltered | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownFilteredRow[]>([]);

  // init regions
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchRegions();
        if (!alive) return;
        setRegions(["ALL", ...data.map((x) => x.region)]);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // subregions when region changes
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = region === "ALL" ? null : region;
        const data = await fetchSubRegions(r);
        if (!alive) return;

        setSubRegions(["ALL", ...data.map((x) => x.subregion)]);
        setSubRegion("ALL");
        setMonth("ALL");
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [region]);

  // months when region/subregion changes
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = region === "ALL" ? null : region;
        const s = subRegion === "ALL" ? null : subRegion;

        const data = await fetchMonths({ region: r, subRegion: s });
        if (!alive) return;

        setMonths(["ALL", ...data.map((x) => x.month)]);
        setMonth("ALL");
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [region, subRegion]);

  // load summary + breakdown (RPC aggregates: no 1000 cap)
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = region === "ALL" ? null : region;
        const s = subRegion === "ALL" ? null : subRegion;
        const m = month === "ALL" ? null : month;

        const [sum, bd] = await Promise.all([
          fetchSummaryFiltered({ region: r, subRegion: s, month: m }),
          fetchBreakdownFiltered({ region: r, subRegion: s, month: m }),
        ]);

        if (!alive) return;
        setSummary(sum);
        setBreakdown(bd);
      } catch (e) {
        console.error("DG KPI load failed:", e);
        if (!alive) return;
        setSummary(null);
        setBreakdown([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [region, subRegion, month]);

  const distinctEngines = summary?.distinct_engines ?? 0;

  // stacked chart by subregion (purple)
  const breakdownChart = useMemo(() => {
    return breakdown
      .map((r) => ({
        name: r.subregion ?? "Unknown",
        target: r.target_achieved,
        below: r.below_base,
        no: r.no_fueling,
        total: r.distinct_engines,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [breakdown]);

  // overall pie data (from summary)
  const pieData = useMemo(() => {
    const t = summary?.target_achieved ?? 0;
    const b = summary?.below_base ?? 0;
    const n = summary?.no_fueling ?? 0;
    const between = Math.max(0, distinctEngines - (t + b + n));

    return [
      { name: "Target Achieved", value: t },
      { name: "Below Base", value: b },
      { name: "No Fueling", value: n },
      { name: "Between", value: between },
    ].filter((x) => x.value > 0);
  }, [summary, distinctEngines]);

  const pieColors = ["#7c3aed", "#a855f7", "#c4b5fd", "#e9d5ff"]; // purple family

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50 text-slate-900">
      <div className="p-6 space-y-6">
        {/* Header + Filters */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              DG KPI Analytics
            </h1>
            <p className="text-sm text-slate-600">
              Focused KPIs + SubRegion breakdown (no detail table).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-[820px]">
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-700">Region</div>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger className="bg-white/80 backdrop-blur border-slate-200">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-700">
                SubRegion
              </div>
              <Select value={subRegion} onValueChange={setSubRegion}>
                <SelectTrigger className="bg-white/80 backdrop-blur border-slate-200">
                  <SelectValue placeholder="Select subregion" />
                </SelectTrigger>
                <SelectContent>
                  {subRegions.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-700">Month</div>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="bg-white/80 backdrop-blur border-slate-200">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-slate-200 bg-white/80 backdrop-blur shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">
                Distinct Engines
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {loading ? "…" : distinctEngines.toLocaleString()}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white/80 backdrop-blur shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">
                Avg Fuel Consumed
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {loading ? "…" : fmtNum(summary?.avg_fuel, 2)}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white/80 backdrop-blur shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">
                Target Achieved
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {loading
                ? "…"
                : `${(summary?.target_achieved ?? 0).toLocaleString()} (${pct(
                    summary?.target_achieved ?? 0,
                    distinctEngines
                  )})`}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white/80 backdrop-blur shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">
                Below Base
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {loading
                ? "…"
                : `${(summary?.below_base ?? 0).toLocaleString()} (${pct(
                    summary?.below_base ?? 0,
                    distinctEngines
                  )})`}
            </CardContent>
          </Card>
        </div>

        {/* Charts: Bar + Pie */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 border-slate-200 bg-white/80 backdrop-blur shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">
                SubRegion Breakdown (Distinct Engines)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={breakdownChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="target"
                    name="Target Achieved"
                    stackId="a"
                    fill="#7c3aed"
                  />
                  <Bar
                    dataKey="below"
                    name="Below Base"
                    stackId="a"
                    fill="#a855f7"
                  />
                  <Bar
                    dataKey="no"
                    name="No Fueling"
                    stackId="a"
                    fill="#c4b5fd"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white/80 backdrop-blur shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Achievement Share</CardTitle>
            </CardHeader>
            <CardContent className="h-[360px]">
              {loading ? (
                <div className="h-full grid place-items-center text-sm text-slate-600">
                  Loading…
                </div>
              ) : distinctEngines === 0 ? (
                <div className="h-full grid place-items-center text-sm text-slate-600">
                  No data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip />
                    <Legend />
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="55%"
                      outerRadius="80%"
                      paddingAngle={2}
                    >
                      {pieData.map((_, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={pieColors[idx % pieColors.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* SubRegion Table */}
        <Card className="border-slate-200 bg-white/80 backdrop-blur shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">SubRegion Summary</CardTitle>
            <p className="text-sm text-slate-600">
              Distinct engines and achievement counts per SubRegion (server-side
              aggregation, no 1000-limit).
            </p>
          </CardHeader>

          <CardContent>
            <div className="border border-slate-200 rounded-md overflow-auto max-h-[520px]">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-violet-50">
                  <tr className="text-left">
                    <th className="p-3">Region</th>
                    <th className="p-3">SubRegion</th>
                    <th className="p-3">Distinct Engines</th>
                    <th className="p-3">Target Achieved</th>
                    <th className="p-3">Below Base</th>
                    <th className="p-3">No Fueling</th>
                    <th className="p-3">% Target</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td className="p-3 text-slate-600" colSpan={7}>
                        Loading…
                      </td>
                    </tr>
                  ) : breakdown.length === 0 ? (
                    <tr>
                      <td className="p-3 text-slate-600" colSpan={7}>
                        No records.
                      </td>
                    </tr>
                  ) : (
                    breakdown.map((r, i) => (
                      <tr
                        key={`${r.region ?? "—"}-${r.subregion ?? "—"}-${i}`}
                        className="border-t hover:bg-violet-50/50 transition-colors"
                      >
                        <td className="p-3">{r.region ?? "—"}</td>
                        <td className="p-3 font-medium">{r.subregion ?? "—"}</td>
                        <td className="p-3">{r.distinct_engines.toLocaleString()}</td>
                        <td className="p-3">{r.target_achieved.toLocaleString()}</td>
                        <td className="p-3">{r.below_base.toLocaleString()}</td>
                        <td className="p-3">{r.no_fueling.toLocaleString()}</td>
                        <td className="p-3">
                          {pct(r.target_achieved, r.distinct_engines)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

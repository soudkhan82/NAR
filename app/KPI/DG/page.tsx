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
} from "recharts";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import {
  fetchRegionsDirect,
  fetchSubRegionsDirect,
  fetchMonthsDirect,
  fetchSummaryFiltered,
  fetchBreakdownFiltered,
  fetchDetailsPaged,
  type DetailRow,
  type SummaryFiltered,
  type BreakdownFilteredRow,
  type FuelStatus,
} from "@/app/lib/rpc/dg_kpi";

const fmtNum = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined ? "—" : Number(v).toFixed(digits);

const pct = (part: number, total: number) => {
  if (!total || total <= 0) return "—";
  return `${((part * 100) / total).toFixed(1)}%`;
};

function statusBadge(status: DetailRow["fuel_status"]) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1";
  switch (status) {
    case "Target Achieved":
      return (
        <span
          className={`${base} bg-emerald-50 text-emerald-700 ring-emerald-200`}
        >
          Target Achieved
        </span>
      );
    case "Below Base":
      return (
        <span className={`${base} bg-rose-50 text-rose-700 ring-rose-200`}>
          Below Base
        </span>
      );
    case "No Fueling":
      return (
        <span className={`${base} bg-slate-50 text-slate-700 ring-slate-200`}>
          No Fueling
        </span>
      );
    default:
      return (
        <span className={`${base} bg-amber-50 text-amber-800 ring-amber-200`}>
          Between
        </span>
      );
  }
}

function csvEscape(v: unknown) {
  const s =
    v === null || v === undefined
      ? ""
      : typeof v === "number"
      ? String(v)
      : String(v);
  const needsQuotes = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

const STATUS_OPTIONS: Array<{ label: string; value: "ALL" | FuelStatus }> = [
  { label: "ALL", value: "ALL" },
  { label: "No Fueling", value: "No Fueling" },
  { label: "Target Achieved", value: "Target Achieved" },
  { label: "Below Base", value: "Below Base" },
  { label: "Between Base & Target", value: "Between Base & Target" },
];

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

  const [details, setDetails] = useState<DetailRow[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);

  const [engineSearch, setEngineSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | FuelStatus>("ALL");

  const [pageSize, setPageSize] = useState<number>(200);
  const [page, setPage] = useState<number>(1);

  // Regions (direct - small list)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchRegionsDirect();
        if (!alive) return;
        setRegions(["ALL", ...data]);
      } catch (e) {
        console.error("fetchRegions failed:", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Subregions on region change
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = region === "ALL" ? null : region;
        const data = await fetchSubRegionsDirect(r);
        if (!alive) return;

        setSubRegions(["ALL", ...data]);
        setSubRegion("ALL");
        setMonth("ALL");

        setEngineSearch("");
        setStatusFilter("ALL");
        setPage(1);
      } catch (e) {
        console.error("fetchSubRegions failed:", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [region]);

  // Months on region/subregion change
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = region === "ALL" ? null : region;
        const s = subRegion === "ALL" ? null : subRegion;

        const data = await fetchMonthsDirect({ region: r, subRegion: s });
        if (!alive) return;

        setMonths(["ALL", ...data]);
        setMonth("ALL");

        setEngineSearch("");
        setStatusFilter("ALL");
        setPage(1);
      } catch (e) {
        console.error("fetchMonths failed:", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [region, subRegion]);

  // Load summary + breakdown + paged table (ALL via RPC for aggregates)
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const r = region === "ALL" ? null : region;
        const s = subRegion === "ALL" ? null : subRegion;
        const m = month === "ALL" ? null : month;

        const search = engineSearch.trim() ? engineSearch.trim() : null;
        const status = statusFilter === "ALL" ? null : statusFilter;
        const offset = (page - 1) * pageSize;

        const [sum, bd, paged] = await Promise.all([
          fetchSummaryFiltered({ region: r, subRegion: s, month: m }),
          fetchBreakdownFiltered({ region: r, subRegion: s, month: m }),
          fetchDetailsPaged({
            region: r,
            subRegion: s,
            month: m,
            search,
            status,
            limit: pageSize,
            offset,
          }),
        ]);

        if (!alive) return;
        setSummary(sum);
        setBreakdown(bd);
        setDetails(paged.rows);
        setTotalRecords(paged.total);
      } catch (e: any) {
        console.error("DG KPI load failed:", e?.message ?? e, e);
        if (!alive) return;
        setSummary(null);
        setBreakdown([]);
        setDetails([]);
        setTotalRecords(0);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [region, subRegion, month, page, pageSize, engineSearch, statusFilter]);

  const breakdownChart = useMemo(() => {
    return breakdown.map((r) => ({
      name: r.subregion ?? "Unknown",
      target: r.target_achieved,
      below: r.below_base,
      no: r.no_fueling,
    }));
  }, [breakdown]);

  const distinctEngines = summary?.distinct_engines ?? 0;

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const showingFrom = totalRecords === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, totalRecords);

  const downloadCsvCurrentPage = () => {
    const headers = [
      "DG_EngineNo",
      "Region",
      "SubRegion",
      "Month",
      "Total_Fuel_Consumed",
      "Regional_Target_Fuel",
      "Regional_Base_Fuel",
      "Status",
    ];

    const lines: string[] = [];
    lines.push(headers.join(","));

    for (const r of details) {
      lines.push(
        [
          csvEscape(r.dg_engineno),
          csvEscape(r.region ?? ""),
          csvEscape(r.subregion ?? ""),
          csvEscape(r.month ?? ""),
          csvEscape(r.total_fuel ?? ""),
          csvEscape(r.regional_target ?? ""),
          csvEscape(r.regional_base ?? ""),
          csvEscape(r.fuel_status),
        ].join(",")
      );
    }

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);

    const safeRegion = (region || "ALL").replace(/[^\w-]+/g, "_");
    const safeSub = (subRegion || "ALL").replace(/[^\w-]+/g, "_");
    const safeMonth = (month || "ALL").replace(/[^\w-]+/g, "_");
    const safeStatus = (statusFilter || "ALL").replace(/[^\w-]+/g, "_");

    const a = document.createElement("a");
    a.href = url;
    a.download = `DG_KPI_${safeRegion}_${safeSub}_${safeMonth}_${safeStatus}_page${page}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

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
              Month is part of filtering logic for all KPIs & breakdowns.
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

        {/* Breakdown Chart */}
        <Card className="border-slate-200 bg-white/80 backdrop-blur shadow-sm">
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

        {/* Table */}
        <Card className="border-slate-200 bg-white/80 backdrop-blur shadow-sm">
          <CardHeader className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base">Detail Records</CardTitle>
                <p className="text-sm text-slate-600">
                  Total records (server):{" "}
                  <span className="font-semibold text-slate-900">
                    {loading ? "…" : totalRecords.toLocaleString()}
                  </span>{" "}
                  • Showing{" "}
                  <span className="font-semibold text-slate-900">
                    {loading
                      ? "…"
                      : `${showingFrom.toLocaleString()}-${showingTo.toLocaleString()}`}
                  </span>
                </p>
              </div>

              <div className="w-full sm:w-[980px]">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px_160px_180px] gap-2">
                  <div>
                    <div className="text-xs font-medium text-slate-700 mb-1">
                      Search by DG_EngineNo (server)
                    </div>
                    <Input
                      value={engineSearch}
                      onChange={(e) => {
                        setEngineSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Type engine number…"
                      className="bg-white/90 border-slate-200"
                    />
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-700 mb-1">
                      Status (server)
                    </div>
                    <Select
                      value={statusFilter}
                      onValueChange={(v) => {
                        setStatusFilter(v as any);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="bg-white/90 border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-700 mb-1">
                      Page size
                    </div>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(v) => {
                        setPageSize(Number(v));
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="bg-white/90 border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[100, 200, 500, 1000].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n.toLocaleString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-700 mb-1 opacity-0">
                      CSV
                    </div>
                    <Button
                      onClick={downloadCsvCurrentPage}
                      disabled={loading || details.length === 0}
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      Download CSV (Page)
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                Page <span className="font-medium text-slate-900">{page}</span>{" "}
                of{" "}
                <span className="font-medium text-slate-900">
                  {Math.max(1, totalPages)}
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="border-slate-200 bg-white/70"
                  disabled={loading || page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-200 bg-white/70"
                  disabled={loading || page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="border border-slate-200 rounded-md overflow-auto max-h-[540px]">
              <table className="min-w-[1200px] w-full text-sm">
                <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-violet-50">
                  <tr className="text-left">
                    <th className="p-3">DG_EngineNo</th>
                    <th className="p-3">Region</th>
                    <th className="p-3">SubRegion</th>
                    <th className="p-3">Month</th>
                    <th className="p-3">Fuel Consumed</th>
                    <th className="p-3">Regional Target</th>
                    <th className="p-3">Regional Base</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td className="p-3 text-slate-600" colSpan={8}>
                        Loading…
                      </td>
                    </tr>
                  ) : details.length === 0 ? (
                    <tr>
                      <td className="p-3 text-slate-600" colSpan={8}>
                        No records.
                      </td>
                    </tr>
                  ) : (
                    details.map((r, i) => (
                      <tr
                        key={`${r.dg_engineno}-${i}`}
                        className="border-t hover:bg-violet-50/50 transition-colors"
                      >
                        <td className="p-3 font-medium">{r.dg_engineno}</td>
                        <td className="p-3">{r.region ?? "—"}</td>
                        <td className="p-3">{r.subregion ?? "—"}</td>
                        <td className="p-3">{r.month ?? "—"}</td>
                        <td className="p-3">{fmtNum(r.total_fuel, 2)}</td>
                        <td className="p-3">{fmtNum(r.regional_target, 2)}</td>
                        <td className="p-3">{fmtNum(r.regional_base, 2)}</td>
                        <td className="p-3">{statusBadge(r.fuel_status)}</td>
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

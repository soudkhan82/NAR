// app/DG/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { LabelList } from "recharts"; // ✅ add this in your imports

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { format, endOfMonth } from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  Fuel,
  Target,
  Zap,
  BarChart3,
  Database,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

import {
  fetchRegionNwdRollup,
  fetchDgSubregions,
  fetchDgSubregionRows,
  fetchDgKpiSites,
  type RegionRollupRow,
  type SubregionRow,
  type SiteKpiRow,
} from "@/app/lib/rpc/dg_kpi";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const STATUS_COLORS = {
  target: "#10b981",
  base: "#3b82f6",
  below: "#f59e0b",
  none: "#94a3b8",
};

function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function fmt2(v: unknown) {
  const x = Number(v);
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(2);
}

function fmt0(v: unknown) {
  const x = Number(v);
  if (!Number.isFinite(x)) return "—";
  return Math.round(x).toLocaleString();
}

export default function DgKpiPage() {
  const [loading, setLoading] = useState(true);
  const [enginesLoading, setEnginesLoading] = useState(false);

  const [region, setRegion] = useState<string>("ALL");
  const [subRegion, setSubRegion] = useState<string>("ALL");

  const [selectedTableSubregion, setSelectedTableSubregion] = useState<
    string | null
  >(null);

  const [selectedMonth, setSelectedMonth] = useState(new Date(2025, 10, 1));
  const [pickerYear, setPickerYear] = useState(2025);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const [rollup, setRollup] = useState<RegionRollupRow[]>([]);
  const [subregions, setSubregions] = useState<string[]>([]);
  const [subRows, setSubRows] = useState<SubregionRow[]>([]);
  const [engines, setEngines] = useState<SiteKpiRow[]>([]);

  const [subTableSearch, setSubTableSearch] = useState("");
  const [siteTableSearch, setSiteTableSearch] = useState("");

  const snapshotDate = useMemo(
    () => format(endOfMonth(selectedMonth), "yyyy-MM-dd"),
    [selectedMonth]
  );

  const monthLabel = useMemo(
    () => format(selectedMonth, "MMM yyyy"),
    [selectedMonth]
  );

  const downloadCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]).join(",");
    const rows = data
      .map((row) =>
        Object.values(row)
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([headers + "\n" + rows], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Subregion dropdown list
  useEffect(() => {
    (async () => {
      try {
        const list = await fetchDgSubregions({
          region: region === "ALL" ? null : (region as any),
        });
        setSubregions(["ALL", ...list.map((x) => x.subregion).filter(Boolean)]);
      } catch (e) {
        console.error(e);
        setSubregions(["ALL"]);
      }
    })();
  }, [region]);

  // Rollup + subregion rows
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [roll, rows] = await Promise.all([
          fetchRegionNwdRollup({ date: snapshotDate }),
          fetchDgSubregionRows({
            date: snapshotDate,
            region: region === "ALL" ? null : (region as any),
            subregion: subRegion === "ALL" ? null : subRegion,
          }),
        ]);
        setRollup(roll);
        setSubRows(rows);
      } catch (e) {
        console.error(e);
        setRollup([]);
        setSubRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [snapshotDate, region, subRegion]);

  // Site-wise (fetch ALL rows, no 1000 cap)
  useEffect(() => {
    (async () => {
      setEnginesLoading(true);
      try {
        const data = await fetchDgKpiSites({
          date: snapshotDate,
          region: region === "ALL" ? null : region,
          subregion:
            selectedTableSubregion || (subRegion !== "ALL" ? subRegion : null),
        });
        setEngines(data);
      } catch (e) {
        console.error(e);
        setEngines([]);
      } finally {
        setEnginesLoading(false);
      }
    })();
  }, [snapshotDate, region, subRegion, selectedTableSubregion]);

  const rollupMap = useMemo(() => {
    const m = new Map<string, RegionRollupRow>();
    rollup.forEach((r) => m.set(String(r.region), r));
    return m;
  }, [rollup]);

  const currentRow = useMemo(() => {
    if (subRegion !== "ALL") return subRows[0] ?? null;
    if (region !== "ALL") return rollupMap.get(region) ?? null;
    return rollupMap.get("NWD") ?? null;
  }, [subRegion, subRows, region, rollupMap]);

  const barData = useMemo(() => {
    const source =
      region === "ALL"
        ? ["Central", "North", "South"]
            .map((k) => rollupMap.get(k))
            .filter(Boolean)
        : subRows;

    return (source as any[]).map((r) => ({
      name: r.region || r.subregion,
      target: n(r.target_achieved),
      base: n(r.base_achieved),
      below: n(r.below_base),
    }));
  }, [region, rollupMap, subRows]);

  const pieData = useMemo(() => {
    if (!currentRow) return [];
    const r: any = currentRow;
    return [
      {
        name: "Target",
        value: n(r.target_achieved),
        color: STATUS_COLORS.target,
      },
      { name: "Base", value: n(r.base_achieved), color: STATUS_COLORS.base },
      { name: "Below", value: n(r.below_base), color: STATUS_COLORS.below },
      { name: "No Fueling", value: n(r.no_fueling), color: STATUS_COLORS.none },
    ].filter((x) => x.value > 0);
  }, [currentRow]);

  const filteredSubRows = useMemo(() => {
    const q = subTableSearch.trim().toLowerCase();
    if (!q) return subRows;
    return subRows.filter((r) =>
      String(r.subregion ?? "")
        .toLowerCase()
        .includes(q)
    );
  }, [subRows, subTableSearch]);

  const filteredEngines = useMemo(() => {
    const q = siteTableSearch.trim().toLowerCase();
    if (!q) return engines;
    return engines.filter((e) => {
      const engine = String(e.dg_engine_no ?? "").toLowerCase();
      const sr = String(e.subregion ?? "").toLowerCase();
      const rg = String(e.region ?? "").toLowerCase();
      const status = String(e.average_dg_fuel_target ?? "").toLowerCase();
      return (
        engine.includes(q) ||
        sr.includes(q) ||
        rg.includes(q) ||
        status.includes(q)
      );
    });
  }, [engines, siteTableSearch]);

  const activeSubregionForSites =
    selectedTableSubregion || (subRegion !== "ALL" ? subRegion : null);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans pb-10">
      <div className="relative z-10 p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header & Filters */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-[26px] font-black text-white uppercase tracking-tight">
              DG KPI <span className="text-blue-400">ANALYTICS</span>
            </h1>
            <p className="text-[12px] text-slate-400 mt-1">
              Snapshot Date:{" "}
              <span className="text-slate-200 font-semibold">
                {snapshotDate}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Region */}
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-extrabold text-slate-400 uppercase tracking-widest">
                Region
              </span>
              <Select value={region} onValueChange={(v) => setRegion(v)}>
                <SelectTrigger className="w-[150px] bg-slate-900/60 border-white/10 text-white h-10 text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-slate-200">
                  {["ALL", "North", "Central", "South"].map((o) => (
                    <SelectItem key={o} value={o}>
                      {o === "ALL" ? "All" : o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subregion */}
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-extrabold text-slate-400 uppercase tracking-widest">
                Subregion
              </span>
              <Select value={subRegion} onValueChange={(v) => setSubRegion(v)}>
                <SelectTrigger className="w-[170px] bg-slate-900/60 border-white/10 text-white h-10 text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-slate-200">
                  {subregions.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o === "ALL" ? "All" : o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Month picker */}
            <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 bg-blue-500/10 border-blue-400/20 text-blue-100 px-4 text-[13px] font-bold"
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {monthLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="p-4 bg-slate-900 border-white/10 w-[260px] rounded-xl"
                align="end"
              >
                <div className="flex justify-between items-center mb-4 text-white">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPickerYear((v) => v - 1)}
                  >
                    <ChevronLeft />
                  </Button>
                  <span className="font-black">{pickerYear}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPickerYear((v) => v + 1)}
                  >
                    <ChevronRight />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {MONTH_LABELS.map((m, i) => (
                    <Button
                      key={m}
                      variant="ghost"
                      className={cn(
                        "h-8 text-[12px] font-bold",
                        selectedMonth.getMonth() === i &&
                          selectedMonth.getFullYear() === pickerYear
                          ? "bg-blue-600 text-white"
                          : "text-slate-300 hover:bg-white/5"
                      )}
                      onClick={() => {
                        setSelectedMonth(new Date(pickerYear, i, 1));
                        setIsPickerOpen(false);
                      }}
                    >
                      {m}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* ✅ EXTRA compact cards (still 4+4) — only card box smaller */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Total DG",
              val: n((currentRow as any)?.total_dg_count).toLocaleString(),
              icon: Database,
              ring: "ring-blue-500/30",
              glow: "group-hover:shadow-[0_0_0_1px_rgba(59,130,246,0.22),0_8px_18px_rgba(59,130,246,0.10)]",
              iconText: "text-blue-300",
            },
            {
              label: "Score",
              val: (currentRow as any)?.final_score,
              icon: Trophy,
              ring: "ring-violet-500/30",
              glow: "group-hover:shadow-[0_0_0_1px_rgba(139,92,246,0.22),0_8px_18px_rgba(139,92,246,0.10)]",
              iconText: "text-violet-300",
              isScore: true,
            },
            {
              label: "Avg Fuel",
              val: n((currentRow as any)?.avg_fueling_on_fuel_filled).toFixed(
                1
              ),
              icon: TrendingUp,
              ring: "ring-cyan-500/30",
              glow: "group-hover:shadow-[0_0_0_1px_rgba(34,211,238,0.20),0_8px_18px_rgba(34,211,238,0.10)]",
              iconText: "text-cyan-300",
              suffix: "Liters",
            },
            {
              label: "Target",
              val: n((currentRow as any)?.target_achieved).toLocaleString(),
              icon: Target,
              ring: "ring-emerald-500/30",
              glow: "group-hover:shadow-[0_0_0_1px_rgba(16,185,129,0.20),0_8px_18px_rgba(16,185,129,0.10)]",
              iconText: "text-emerald-300",
            },
            {
              label: "Base",
              val: n((currentRow as any)?.base_achieved).toLocaleString(),
              icon: Zap,
              ring: "ring-sky-500/30",
              glow: "group-hover:shadow-[0_0_0_1px_rgba(56,189,248,0.20),0_8px_18px_rgba(56,189,248,0.10)]",
              iconText: "text-sky-300",
            },
            {
              label: "Below",
              val: n((currentRow as any)?.below_base).toLocaleString(),
              icon: BarChart3,
              ring: "ring-amber-500/30",
              glow: "group-hover:shadow-[0_0_0_1px_rgba(245,158,11,0.20),0_8px_18px_rgba(245,158,11,0.10)]",
              iconText: "text-amber-300",
            },
            {
              label: "No Fuel",
              val: n((currentRow as any)?.no_fueling).toLocaleString(),
              icon: Fuel,
              ring: "ring-slate-500/25",
              glow: "group-hover:shadow-[0_0_0_1px_rgba(148,163,184,0.16),0_8px_18px_rgba(15,23,42,0.20)]",
              iconText: "text-slate-200",
            },
            {
              label: "Status",
              val: (currentRow as any)?.achievement_status,
              icon: Trophy,
              ring: "ring-indigo-500/30",
              glow: "group-hover:shadow-[0_0_0_1px_rgba(99,102,241,0.20),0_8px_18px_rgba(99,102,241,0.10)]",
              iconText: "text-indigo-300",
              isStatus: true,
            },
          ].map((card, i) => (
            <Card
              key={i}
              className={cn(
                "group border border-white/5 bg-slate-900/40 backdrop-blur-md rounded-2xl",
                "transition-all hover:bg-slate-800/55 hover:scale-[1.01]",
                card.glow
              )}
            >
              {/* ✅ smaller card body (ONLY box reduced) */}
              <CardContent className="p-3 min-h-[88px] flex flex-col items-center justify-center">
                {/* icon badge unchanged in feel */}
                <div
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center mb-2",
                    "bg-white/[0.03] ring-1",
                    card.ring
                  )}
                >
                  <card.icon
                    className={cn("h-5 w-5 opacity-90", card.iconText)}
                  />
                </div>

                <p className="text-[13px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">
                  {card.label}
                </p>

                {(card.isScore || card.isStatus) &&
                region === "ALL" &&
                subRegion === "ALL" ? (
                  <div className="w-full grid grid-cols-3 gap-1 border-t border-white/5 pt-2 mt-2">
                    {["South", "Central", "North"].map((r) => {
                      const rr = rollupMap.get(r);
                      return (
                        <div key={r} className="text-center">
                          <p className="text-[10px] text-slate-600 font-black uppercase">
                            {r}
                          </p>
                          <p className="text-[12px] text-white font-black leading-tight">
                            {card.isScore
                              ? rr?.final_score ?? "—"
                              : rr?.achievement_status ?? "—"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <p className="text-[24px] font-black text-white tracking-tighter">
                      {loading ? "..." : card.val ?? "—"}
                    </p>
                    {card.suffix ? (
                      <span className="text-[11px] font-black text-slate-500 mb-[2px]">
                        {card.suffix}
                      </span>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Graphs */}
        <div className="grid grid-cols-12 gap-6">
          {/* Bar Chart */}
          <Card className="col-span-12 lg:col-span-7 border border-white/5 bg-slate-900/20 rounded-2xl">
            <CardHeader className="p-5 border-b border-white/5 flex justify-between">
              <CardTitle className="text-[14px] font-black text-slate-400 uppercase tracking-widest">
                Efficiency Trends
              </CardTitle>
            </CardHeader>

            <CardContent className="h-[340px] pt-6 px-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(255,255,255,0.05)"
                  />

                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "10px",
                      color: "white",
                    }}
                  />

                  {/* ✅ Target */}
                  <Bar
                    dataKey="target"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    barSize={28}
                  >
                    <LabelList
                      dataKey="target"
                      position="top"
                      formatter={(v: any) => {
                        const x = Number(v);
                        return Number.isFinite(x) && x > 0
                          ? x.toLocaleString()
                          : "";
                      }}
                      fill="#a7f3d0"
                      fontSize={12}
                      fontWeight={900}
                    />
                  </Bar>

                  {/* ✅ Base */}
                  <Bar
                    dataKey="base"
                    fill="#3b82f6"
                    radius={[6, 6, 0, 0]}
                    barSize={28}
                  >
                    <LabelList
                      dataKey="base"
                      position="top"
                      formatter={(v: any) => {
                        const x = Number(v);
                        return Number.isFinite(x) && x > 0
                          ? x.toLocaleString()
                          : "";
                      }}
                      fill="#bfdbfe"
                      fontSize={12}
                      fontWeight={900}
                    />
                  </Bar>

                  {/* ✅ Below */}
                  <Bar
                    dataKey="below"
                    fill="#f59e0b"
                    radius={[6, 6, 0, 0]}
                    barSize={28}
                  >
                    <LabelList
                      dataKey="below"
                      position="top"
                      formatter={(v: any) => {
                        const x = Number(v);
                        return Number.isFinite(x) && x > 0
                          ? x.toLocaleString()
                          : "";
                      }}
                      fill="#fde68a"
                      fontSize={12}
                      fontWeight={900}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Donut Chart */}
          <Card className="col-span-12 lg:col-span-5 border border-white/5 bg-slate-900/20 rounded-2xl">
            <CardHeader className="p-5 border-b border-white/5">
              <CardTitle className="text-[14px] font-black text-slate-400 uppercase tracking-widest">
                Distribution
              </CardTitle>
            </CardHeader>

            <CardContent className="h-[340px] p-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius="52%" // ⬅️ was 62%
                    outerRadius="72%" // ⬅️ was 88%
                    paddingAngle={6}
                    stroke="none"
                    labelLine
                    label={(p: any) => {
                      const name = String(p?.name ?? "");

                      const percentNum =
                        typeof p?.percent === "number"
                          ? p.percent
                          : Number(String(p?.percent ?? 0));

                      const pct = Math.round(percentNum * 100);
                      if (!Number.isFinite(pct) || pct <= 0) return "";

                      const xNum = Number(p?.x);
                      const yNum = Number(p?.y);
                      const cxNum = Number(p?.cx);

                      const textAnchor =
                        Number.isFinite(xNum) &&
                        Number.isFinite(cxNum) &&
                        xNum > cxNum
                          ? "start"
                          : "end";

                      return (
                        <text
                          x={Number.isFinite(xNum) ? xNum : 0}
                          y={Number.isFinite(yNum) ? yNum : 0}
                          textAnchor={textAnchor}
                          fill="#cbd5e1"
                          fontSize={11} // ⬅️ slightly smaller label text
                          fontWeight={900}
                        >
                          {name.toUpperCase()} {pct}%
                        </text>
                      );
                    }}
                  >
                    {pieData.map((e: any, i: number) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>

                  <Tooltip
                    formatter={(v: any, name: any) => [
                      Number(v).toLocaleString(),
                      String(name),
                    ]}
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "10px",
                      color: "white",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* Subregion Summary (60%) */}
          <Card className="xl:col-span-7 border border-white/10 bg-slate-900/35 rounded-2xl flex flex-col h-[640px] overflow-hidden">
            <CardHeader className="p-3 border-b border-white/10 flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CardTitle className="text-[12px] font-black text-slate-300 uppercase tracking-widest">
                  Sub-Region Summary
                </CardTitle>
                <span className="text-[11px] font-extrabold text-slate-400 uppercase">
                  Rows:
                  <span className="text-white ml-1">
                    {filteredSubRows.length}
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    value={subTableSearch}
                    onChange={(e) => setSubTableSearch(e.target.value)}
                    placeholder="Search subregion..."
                    className="h-9 w-[220px] pl-10 text-[12px]
              bg-white/5 border border-white/10
              text-white caret-white placeholder:text-slate-400
              focus-visible:ring-1 focus-visible:ring-blue-400/60"
                  />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCSV(
                      filteredSubRows as any[],
                      "dg_subregion_summary"
                    )
                  }
                  className="h-9 px-3 text-[12px] border-white/10 text-black-200 hover:text-white gap-2"
                >
                  <Download className="h-4 w-4" />
                  CSV
                </Button>
              </div>
            </CardHeader>

            <CardContent
              className="p-0 overflow-auto flex-1
                  [scrollbar-color:rgba(148,163,184,0.28)_rgba(15,23,42,0.55)]
                  [&::-webkit-scrollbar]:w-[10px]
                  [&::-webkit-scrollbar-track]:bg-slate-950/60
                  [&::-webkit-scrollbar-track]:border-l
                  [&::-webkit-scrollbar-track]:border-white/10
                  [&::-webkit-scrollbar-thumb]:bg-slate-400/20
                  [&::-webkit-scrollbar-thumb]:rounded-full
                  [&::-webkit-scrollbar-thumb]:border
                  [&::-webkit-scrollbar-thumb]:border-slate-950/60
                  hover:[&::-webkit-scrollbar-thumb]:bg-slate-300/30"
            >
              <table className="w-full text-left table-auto">
                <thead className="bg-white/5 text-slate-300 uppercase text-[10px] font-black sticky top-0 z-10">
                  <tr>
                    {/* highlighted set */}
                    <th className="px-2 py-2 text-right whitespace-nowrap">
                      Subregion
                    </th>
                    <th className="px-2 py-2 text-right whitespace-nowrap">
                      Total DG
                    </th>
                    <th className="px-2 py-2 text-right whitespace-nowrap">
                      Filled DG
                    </th>
                    <th className="px-2 py-2 text-right whitespace-nowrap">
                      Total Fueling (Ltr.)
                    </th>
                    <th className="px-2 py-2 text-right whitespace-nowrap">
                      Avg Fueling (Filled)
                    </th>
                    <th className="px-2 py-2 text-right whitespace-nowrap">
                      Target Achieved (%)
                    </th>
                    <th className="px-2 py-2 text-right whitespace-nowrap">
                      Target
                    </th>
                    <th className="px-2 py-2 text-right whitespace-nowrap">
                      Base
                    </th>
                    <th className="px-2 py-2 text-right whitespace-nowrap">
                      Final Score
                    </th>
                    <th className="px-3 py-2 whitespace-nowrap">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/5">
                  {filteredSubRows.map((r, i) => (
                    <tr
                      key={i}
                      onClick={() => setSelectedTableSubregion(r.subregion)}
                      className={cn(
                        "hover:bg-white/[0.04] cursor-pointer",
                        selectedTableSubregion === r.subregion &&
                          "bg-blue-500/10"
                      )}
                    >
                      {" "}
                      <td className="px-3 py-2 text-slate-100 whitespace-nowrap text-[12px] font-extrabold">
                        {r.subregion}
                      </td>
                      <td className="px-2 py-2 text-right text-slate-200 text-[12px]">
                        {fmt0(r.total_dg_count)}
                      </td>
                      <td className="px-2 py-2 text-right text-slate-200 text-[12px]">
                        {fmt0(r.fuel_filled_dg_count)}
                      </td>
                      <td className="px-2 py-2 text-right text-slate-200 text-[12px]">
                        {fmt0(r.total_fueling)}
                      </td>
                      <td className="px-2 py-2 text-right text-slate-200 text-[12px]">
                        {fmt2(r.avg_fueling_on_fuel_filled)}
                      </td>
                      <td className="px-2 py-2 text-right text-slate-200 text-[12px]">
                        {fmt2(r.target_achieved_pct)}
                      </td>
                      <td className="px-2 py-2 text-right text-slate-200 text-[12px]">
                        {fmt0(r.target)}
                      </td>
                      <td className="px-2 py-2 text-right text-slate-200 text-[12px]">
                        {fmt0(r.base)}
                      </td>
                      <td className="px-2 py-2 text-right font-black text-white text-[12px]">
                        {fmt2(r.final_score)}
                      </td>
                      <td className="px-3 py-2 text-slate-100 whitespace-nowrap text-[12px]">
                        {r.achievement_status ?? "—"}
                      </td>
                    </tr>
                  ))}

                  {!loading && filteredSubRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={14}
                        className="text-center py-16 text-slate-400 text-[12px] font-bold"
                      >
                        No rows found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Site Wise (40%) */}
          <Card className="xl:col-span-5 border border-white/10 bg-slate-900/35 rounded-2xl flex flex-col h-[640px] overflow-hidden">
            <CardHeader className="p-3 border-b border-white/10 flex flex-row items-center justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-[12px] font-black text-slate-300 uppercase tracking-widest">
                  Site Wise (DG KPI)
                </CardTitle>

                {/* tight metadata line (no extra separators/spaces) */}
                <div className="text-[11px] font-extrabold text-slate-400 uppercase mt-1 truncate">
                  Total:
                  <span className="text-white ml-1">
                    {filteredEngines.length.toLocaleString()}
                  </span>
                  {activeSubregionForSites ? (
                    <>
                      <span className="mx-2 text-white/15">|</span>
                      SubRegion:
                      <span className="text-white ml-1">
                        {activeSubregionForSites}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCSV(filteredEngines as any[], "dg_site_wise")
                  }
                  className="h-9 px-3 text-[12px] border-white/10 text-black-200 hover:text-white gap-2 font-bold"
                >
                  <Download className="h-4 w-4" />
                  CSV
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTableSubregion(null)}
                  className="h-9 px-2 text-[12px] text-slate-200 hover:bg-white/5 uppercase font-black"
                >
                  Reset
                </Button>
              </div>
            </CardHeader>

            <CardContent
              className="p-0 overflow-auto flex-1
                [scrollbar-color:rgba(148,163,184,0.28)_rgba(15,23,42,0.55)]
                [&::-webkit-scrollbar]:w-[10px]
                [&::-webkit-scrollbar-track]:bg-slate-950/60
                [&::-webkit-scrollbar-track]:border-l
                [&::-webkit-scrollbar-track]:border-white/10
                [&::-webkit-scrollbar-thumb]:bg-slate-400/20
                [&::-webkit-scrollbar-thumb]:rounded-full
                [&::-webkit-scrollbar-thumb]:border
                [&::-webkit-scrollbar-thumb]:border-slate-950/60
                hover:[&::-webkit-scrollbar-thumb]:bg-slate-300/30"
            >
              <table className="w-full text-left table-auto">
                <thead className="bg-white/5 text-slate-300 uppercase text-[10px] font-black sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 whitespace-nowrap">DG Engine</th>
                    <th className="px-2 py-2 text-right whitespace-nowrap">
                      Total Fueling
                    </th>
                    <th className="px-2 py-2 text-right whitespace-nowrap">
                      Target
                    </th>
                    <th className="px-2 py-2 text-right whitespace-nowrap">
                      Base
                    </th>
                    <th className="px-3 py-2 whitespace-nowrap">Avg Status</th>
                    <th className="px-2 py-2 text-right whitespace-nowrap">
                      DG Score
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/5">
                  {enginesLoading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-20 text-slate-400 text-[12px] font-bold"
                      >
                        Fetching ALL records…
                      </td>
                    </tr>
                  ) : (
                    filteredEngines.map((e, i) => (
                      <tr
                        key={i}
                        className="hover:bg-white/[0.04] transition-colors"
                      >
                        <td className="px-3 py-2 font-extrabold text-slate-100 whitespace-nowrap text-[12px]">
                          {e.dg_engine_no ?? "—"}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-200 whitespace-nowrap text-[12px]">
                          {fmt0(e.total_fuel_consumed)}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-200 whitespace-nowrap text-[12px]">
                          {fmt0(e.regional_target_fuel)}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-200 whitespace-nowrap text-[12px]">
                          {fmt0(e.regional_base_fuel)}
                        </td>
                        <td className="px-3 py-2 text-slate-200 whitespace-nowrap text-[12px]">
                          {e.average_dg_fuel_target ?? "—"}
                        </td>
                        <td className="px-2 py-2 text-right font-black text-white whitespace-nowrap text-[12px]">
                          {fmt2(e.dg_kpi_score)}
                        </td>
                      </tr>
                    ))
                  )}

                  {!enginesLoading && filteredEngines.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-16 text-slate-400 text-[12px] font-bold"
                      >
                        No site rows found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// app/DG/page.tsx
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
  Label,
  LabelList,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, setMonth, setYear } from "date-fns";
import {
  CalendarDays,
  Calendar as CalendarIcon,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

/* -------------------- helpers -------------------- */
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
  none: "#64748b",
};

function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export default function DgKpiPage() {
  const [loading, setLoading] = useState(true);
  const [enginesLoading, setEnginesLoading] = useState(false);
  const [region, setRegion] = useState<any>("ALL");
  const [subRegion, setSubRegion] = useState<any>("ALL");
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
  const [tableSearch, setTableSearch] = useState("");

  const snapshotDate = useMemo(
    () => format(endOfMonth(selectedMonth), "yyyy-MM-dd"),
    [selectedMonth]
  );

  const rollupMap = useMemo(() => {
    const m = new Map<string, RegionRollupRow>();
    rollup.forEach((r) => m.set(String(r.region), r));
    return m;
  }, [rollup]);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchDgSubregions({
          region: region === "ALL" ? null : region,
        });
        setSubregions(["ALL", ...list.map((x) => x.subregion).filter(Boolean)]);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [region]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [roll, rows] = await Promise.all([
          fetchRegionNwdRollup({ date: snapshotDate }),
          fetchDgSubregionRows({
            date: snapshotDate,
            region: region === "ALL" ? null : region,
            subregion: subRegion === "ALL" ? null : subRegion,
          }),
        ]);
        setRollup(roll);
        setSubRows(rows);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [snapshotDate, region, subRegion]);

  useEffect(() => {
    (async () => {
      setEnginesLoading(true);
      try {
        const data = await fetchDgKpiSites({
          date: snapshotDate,
          region: region,
          subregion:
            selectedTableSubregion || (subRegion !== "ALL" ? subRegion : null),
        });
        setEngines(data);
      } catch (e) {
        console.error(e);
      } finally {
        setEnginesLoading(false);
      }
    })();
  }, [snapshotDate, region, subRegion, selectedTableSubregion]);

  const currentRow = useMemo(() => {
    if (subRegion !== "ALL") return subRows[0] ?? null;
    if (region !== "ALL") return rollupMap.get(region) ?? null;
    return rollupMap.get("NWD") ?? null;
  }, [subRegion, subRows, region, rollupMap]);

  const currentTotal = useMemo(() => {
    const r = currentRow as any;
    return r
      ? n(r.target_achieved) +
          n(r.base_achieved) +
          n(r.below_base) +
          n(r.no_fueling)
      : 0;
  }, [currentRow]);

  const barData = useMemo(() => {
    const source =
      region === "ALL"
        ? ["Central", "North", "South"]
            .map((k) => rollupMap.get(k))
            .filter(Boolean)
        : subRows;
    return source.map((r: any) => ({
      name: r.region || r.subregion,
      target_achieved: n(r.target_achieved),
      base_achieved: n(r.base_achieved),
      below_base: n(r.below_base),
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
      { name: "Empty", value: n(r.no_fueling), color: STATUS_COLORS.none },
    ].filter((x) => x.value > 0);
  }, [currentRow]);

  const tableRows = useMemo(() => {
    const rows = [...subRows].sort((a, b) =>
      String(a.subregion).localeCompare(String(b.subregion))
    );
    const q = tableSearch.trim().toLowerCase();
    return q
      ? rows.filter((r) => String(r.subregion).toLowerCase().includes(q))
      : rows;
  }, [subRows, tableSearch]);

  const renderGroupedValueLabel = (props: any) => {
    const { x, y, width, value } = props;
    if (!value) return null;
    return (
      <text
        x={x + width / 2}
        y={y - 6}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize={9}
        fontWeight={900}
      >
        {value}
      </text>
    );
  };

  const renderPieLabel = ({
    cx,
    cy,
    midAngle,
    outerRadius,
    percent,
    name,
    color,
  }: any) => {
    const RADIAN = Math.PI / 180;
    const sin = Math.sin(-midAngle * RADIAN);
    const cos = Math.cos(-midAngle * RADIAN);
    const sx = cx + (outerRadius + 5) * cos;
    const sy = cy + (outerRadius + 5) * sin;
    const mx = cx + (outerRadius + 20) * cos;
    const my = cy + (outerRadius + 20) * sin;
    const leftSide = cos < 0;
    const ex = mx + (leftSide ? -1 : 1) * 15;
    return (
      <g>
        <path
          d={`M${sx},${sy}L${mx},${my}L${ex},${my}`}
          stroke={color}
          fill="none"
          strokeWidth={1}
        />
        <text
          x={ex + (leftSide ? -5 : 5)}
          y={my}
          textAnchor={leftSide ? "end" : "start"}
          fill={color}
          fontSize={9}
          fontWeight={900}
          className="uppercase"
        >
          {`${name} ${(percent * 100).toFixed(0)}%`}
        </text>
      </g>
    );
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans pb-10">
      <div className="relative z-10 p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header & Smaller Selects */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-black text-white uppercase tracking-tighter">
              DG KPI <span className="text-blue-500">Analytics</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">
              {format(selectedMonth, "MMMM yyyy")} • {region}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              {
                val: region,
                set: setRegion,
                opts: ["ALL", "North", "Central", "South"],
              },
              { val: subRegion, set: setSubRegion, opts: subregions },
            ].map((f, i) => (
              <Select
                key={i}
                value={f.val}
                onValueChange={(v: any) => f.set(v)}
              >
                <SelectTrigger className="w-[140px] bg-white/[0.03] border-white/10 text-white h-9 text-xs rounded-lg backdrop-blur-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-slate-300">
                  {f.opts.map((o: any) => (
                    <SelectItem key={o} value={o}>
                      {o === "ALL" ? "All" : o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
            <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 bg-blue-500/5 border-blue-500/20 text-blue-100 rounded-lg px-4 text-xs font-bold"
                >
                  <CalendarDays className="mr-2 h-3.5 w-3.5" />{" "}
                  {format(selectedMonth, "MMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="p-4 bg-slate-900 border-white/10 w-[260px] rounded-xl"
                align="end"
              >
                <div className="flex justify-between items-center mb-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPickerYear((v) => v - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-white font-black">{pickerYear}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPickerYear((v) => v + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {MONTH_LABELS.map((m, i) => (
                    <Button
                      key={m}
                      variant="ghost"
                      className={cn(
                        "h-8 text-[10px] font-bold",
                        selectedMonth.getMonth() === i &&
                          selectedMonth.getFullYear() === pickerYear
                          ? "bg-blue-600 text-white"
                          : "text-slate-400"
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

        {/* Smaller Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            {
              label: "Total DG",
              val: n((currentRow as any)?.total_dg_count).toLocaleString(),
              icon: Database,
              color: "text-blue-400",
            },
            {
              label: "Score",
              val: (currentRow as any)?.final_score,
              icon: Trophy,
              color: "text-purple-400",
              isScore: true,
            },
            {
              label: "Avg Fuel",
              val: n((currentRow as any)?.avg_fueling_on_fuel_filled).toFixed(
                2
              ),
              icon: TrendingUp,
              color: "text-cyan-400",
            },
            {
              label: "Target",
              val: n((currentRow as any)?.target_achieved).toLocaleString(),
              icon: Target,
              color: "text-emerald-400",
            },
            {
              label: "Base",
              val: n((currentRow as any)?.base_achieved).toLocaleString(),
              icon: Zap,
              color: "text-blue-500",
            },
            {
              label: "Below",
              val: n((currentRow as any)?.below_base).toLocaleString(),
              icon: BarChart3,
              color: "text-amber-400",
            },
            {
              label: "No Fuel",
              val: n((currentRow as any)?.no_fueling).toLocaleString(),
              icon: Fuel,
              color: "text-slate-500",
            },
            {
              label: "Status",
              val: (currentRow as any)?.achievement_status,
              icon: Trophy,
              color: "text-indigo-400",
              isStatus: true,
            },
          ].map((card, i) => (
            <Card
              key={i}
              className="border border-white/[0.05] bg-white/[0.02] backdrop-blur-md rounded-xl transition-all hover:-translate-y-1 hover:bg-white/[0.05]"
            >
              <CardContent className="p-3 flex flex-col items-center text-center">
                <card.icon
                  className={cn("h-3.5 w-3.5 opacity-40 mb-1.5", card.color)}
                />
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-0.5">
                  {card.label}
                </p>
                {(card.isScore || card.isStatus) &&
                region === "ALL" &&
                subRegion === "ALL" ? (
                  <div className="w-full space-y-0.5">
                    {["S", "C", "N"].map((reg) => (
                      <div
                        key={reg}
                        className="flex justify-between text-[9px] border-b border-white/5 last:border-none"
                      >
                        <span className="text-slate-600 font-bold">{reg}</span>
                        <span className="text-white font-black">
                          {card.isScore
                            ? rollupMap.get(
                                reg === "S"
                                  ? "South"
                                  : reg === "C"
                                  ? "Central"
                                  : "North"
                              )?.final_score
                            : "Ach."}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-lg font-black text-white tracking-tighter truncate w-full">
                    {loading ? "..." : card.val ?? "—"}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Dynamic Graphs */}
        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-12 lg:col-span-7 border border-white/5 bg-white/[0.02] rounded-2xl">
            <CardHeader className="p-4">
              <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Efficiency Trends
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] px-2 pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 20, bottom: 20 }}>
                  <CartesianGrid
                    strokeDasharray="0"
                    vertical={false}
                    stroke="rgba(255,255,255,0.03)"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 8, fontWeight: 800, fill: "#475569" }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  />
                  <Bar
                    dataKey="target_achieved"
                    fill="#10b981"
                    radius={[4, 4, 4, 4]}
                  >
                    <LabelList content={renderGroupedValueLabel} />
                  </Bar>
                  <Bar
                    dataKey="base_achieved"
                    fill="#3b82f6"
                    radius={[4, 4, 4, 4]}
                  >
                    <LabelList content={renderGroupedValueLabel} />
                  </Bar>
                  <Bar
                    dataKey="below_base"
                    fill="#f59e0b"
                    radius={[4, 4, 4, 4]}
                  >
                    <LabelList content={renderGroupedValueLabel} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="col-span-12 lg:col-span-5 border border-white/5 bg-white/[0.02] rounded-2xl">
            <CardHeader className="p-4">
              <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] p-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius="40%"
                    outerRadius="60%"
                    paddingAngle={8}
                    stroke="none"
                    label={renderPieLabel}
                  >
                    {pieData.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Compact Tables */}
        <div className="flex flex-col xl:flex-row gap-4">
          <Card className="flex-[5.5] h-[550px] border border-white/5 bg-white/[0.02] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
            <CardHeader className="p-4 border-b border-white/[0.03] flex flex-row items-center justify-between">
              <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Sub-Region Summary
              </CardTitle>
              <Input
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search..."
                className="h-7 w-[150px] text-[10px] bg-white/5 border-none rounded-lg"
              />
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="text-[9px] font-black bg-white/[0.02] text-slate-500 uppercase sticky top-0 z-10">
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-3">Sub-Region</th>
                    <th className="px-2 py-3 text-center">DG</th>
                    <th className="px-2 py-3 text-center">Fuel (L)</th>
                    <th className="px-2 py-3 text-center text-blue-500">
                      Ach %
                    </th>
                    <th className="px-4 py-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {tableRows.map((r, i) => (
                    <tr
                      key={i}
                      onClick={() => setSelectedTableSubregion(r.subregion)}
                      className={cn(
                        "group cursor-pointer transition-colors",
                        selectedTableSubregion === r.subregion
                          ? "bg-blue-600/10"
                          : "hover:bg-white/[0.02]"
                      )}
                    >
                      <td className="px-4 py-3 text-[11px] font-bold text-slate-400">
                        {r.subregion}
                      </td>
                      <td className="px-2 py-3 text-center text-[11px] font-black text-slate-200">
                        {n(r.total_dg_count)}
                      </td>
                      <td className="px-2 py-3 text-center text-[11px] font-black text-slate-200">
                        {n(r.total_fueling).toLocaleString()}
                      </td>
                      <td className="px-2 py-3 text-center text-[11px] font-black text-blue-400">
                        {n(r.target_achieved_pct).toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right text-[11px] font-black text-white">
                        {r.final_score?.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="flex-[4.5] h-[550px] border border-white/5 bg-white/[0.02] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
            <CardHeader className="p-4 border-b border-white/[0.03] flex flex-row items-center justify-between">
              <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Site Wise
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTableSubregion(null)}
                className="text-[9px] text-slate-500 uppercase"
              >
                Reset
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="text-[9px] font-black bg-white/[0.02] text-slate-500 uppercase sticky top-0 z-10">
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-3">Engine No</th>
                    <th className="px-2 py-3 text-center">Score</th>
                    <th className="px-2 py-3 text-center">Fuel (L)</th>
                    <th className="px-4 py-3 text-center">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {enginesLoading ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-center py-10 text-[9px] font-black uppercase text-slate-600"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : (
                    engines.map((e, i) => (
                      <tr key={i} className="hover:bg-white/[0.01]">
                        <td className="px-4 py-3 text-[11px] font-bold text-slate-400 truncate max-w-[120px]">
                          {e.dg_engine_no}
                        </td>
                        <td className="px-2 py-3 text-center text-[11px] font-black text-cyan-400">
                          {e.dg_kpi_score?.toFixed(2)}
                        </td>
                        <td className="px-2 py-3 text-center text-[11px] font-bold text-slate-500">
                          {e.total_fuel_consumed}
                        </td>
                        <td className="px-4 py-3 text-center text-[11px] font-bold text-slate-500">
                          {e.regional_target_fuel}
                        </td>
                      </tr>
                    ))
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

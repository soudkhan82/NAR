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
  Zap,
  Fuel,
  Target,
  BarChart3,
  TrendingUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Database,
  Download,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  fetchRegions,
  fetchSubRegions,
  fetchSummaryFiltered,
  fetchBreakdownFiltered,
  SummaryFiltered,
  BreakdownFilteredRow,
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
  none: "#64748b",
};

const pct = (part: number, total: number) =>
  total > 0 ? `${((part * 100) / total).toFixed(1)}%` : "0.0%";

function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const escapeCsv = (v: string | number) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((r) => r.map(escapeCsv).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function DgKpiPage() {
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState("ALL");
  const [subRegion, setSubRegion] = useState("ALL");

  const [viewMode, setViewMode] = useState<"month" | "range">("month");
  const [selectedMonth, setSelectedMonth] = useState(new Date(2025, 9, 1));
  const [selectedRange, setSelectedRange] = useState<any>(undefined);
  const [pickerYear, setPickerYear] = useState(2025);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const [regions, setRegions] = useState<string[]>([]);
  const [subRegions, setSubRegions] = useState<string[]>([]);
  const [summary, setSummary] = useState<SummaryFiltered | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownFilteredRow[]>([]);

  const [tableSearch, setTableSearch] = useState("");

  const dateParams = useMemo(() => {
    if (viewMode === "month") {
      return {
        start: format(startOfMonth(selectedMonth), "yyyy-MM-dd"),
        end: format(endOfMonth(selectedMonth), "yyyy-MM-dd"),
        label: format(selectedMonth, "MMMM yyyy"),
      };
    }
    return {
      start: selectedRange?.from
        ? format(selectedRange.from, "yyyy-MM-dd")
        : null,
      end: selectedRange?.to ? format(selectedRange.to, "yyyy-MM-dd") : null,
      label: selectedRange?.from
        ? `${format(selectedRange.from, "MMM dd")} - ${format(
            selectedRange.to || selectedRange.from,
            "MMM dd"
          )}`
        : "Select Range",
    };
  }, [viewMode, selectedMonth, selectedRange]);

  useEffect(() => {
    fetchRegions().then((d) => setRegions(["ALL", ...d.map((x) => x.region)]));
  }, []);

  useEffect(() => {
    const r = region === "ALL" ? null : region;
    fetchSubRegions(r).then((d) => {
      setSubRegions(["ALL", ...d.map((x) => x.subregion)]);
      setSubRegion("ALL");
    });
  }, [region]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!dateParams.start) return;
      setLoading(true);
      try {
        const [sum, bd] = await Promise.all([
          fetchSummaryFiltered({
            region: region === "ALL" ? null : region,
            subRegion: subRegion === "ALL" ? null : subRegion,
            startDate: dateParams.start,
            endDate: dateParams.end,
          }),
          fetchBreakdownFiltered({
            region: region === "ALL" ? null : region,
            subRegion: subRegion === "ALL" ? null : subRegion,
            startDate: dateParams.start,
            endDate: dateParams.end,
          }),
        ]);
        if (alive) {
          setSummary(sum);
          setBreakdown(bd);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [region, subRegion, dateParams]);

  const avgFuel = useMemo(() => {
    return summary && summary.valid_fueling_entries > 0
      ? summary.total_fuel / summary.valid_fueling_entries
      : 0;
  }, [summary]);

  const avgScore = useMemo(() => {
    const s: any = summary as any;
    return summary ? Number(s?.avg_score ?? 0) : 0;
  }, [summary]);

  const totalSites = useMemo(() => {
    if (!summary) return 0;
    return (
      summary.target_achieved +
      summary.base_achieved +
      summary.below_base +
      summary.no_fueling
    );
  }, [summary]);

  const sortedBreakdown = useMemo(() => {
    return [...breakdown].sort((a, b) =>
      a.SubRegion.localeCompare(b.SubRegion)
    );
  }, [breakdown]);

  // ✅ Region-level aggregated chart rows (prettier + fewer categories)
  const chartRows = useMemo(() => {
    const map = new Map<
      string,
      {
        Region: string;
        target_achieved: number;
        base_achieved: number;
        below_base: number;
        no_fueling: number;
        total_count: number;
        _score_sum: number;
        _score_entries: number;
      }
    >();

    for (const rAny of sortedBreakdown as any[]) {
      const regionKey = String(rAny.Region ?? rAny.region ?? "UNKNOWN").trim();

      const target = Number(rAny.target_achieved ?? 0);
      const base = Number(rAny.base_achieved ?? 0);
      const below = Number(rAny.below_base ?? 0);
      const none = Number(rAny.no_fueling ?? 0);
      const total =
        Number(rAny.total_count ?? 0) || target + base + below + none;

      const rowAvgScore = Number(rAny.avg_score ?? 0);
      const rowScoreEntries = Number(rAny.score_entries ?? 0);

      if (!map.has(regionKey)) {
        map.set(regionKey, {
          Region: regionKey,
          target_achieved: 0,
          base_achieved: 0,
          below_base: 0,
          no_fueling: 0,
          total_count: 0,
          _score_sum: 0,
          _score_entries: 0,
        });
      }

      const acc = map.get(regionKey)!;
      acc.target_achieved += target;
      acc.base_achieved += base;
      acc.below_base += below;
      acc.no_fueling += none;
      acc.total_count += total;

      if (rowScoreEntries > 0) {
        acc._score_sum += rowAvgScore * rowScoreEntries;
        acc._score_entries += rowScoreEntries;
      }
    }

    const rows = Array.from(map.values()).map((x) => ({
      Region: x.Region,
      target_achieved: x.target_achieved,
      base_achieved: x.base_achieved,
      below_base: x.below_base,
      no_fueling: x.no_fueling,
      total_count: x.total_count,
      avg_score: x._score_entries > 0 ? x._score_sum / x._score_entries : 0,
    }));

    // keep a nice fixed order if your regions are Central/North/South
    const ORDER = ["Central", "North", "South"];
    rows.sort((a, b) => {
      const ia = ORDER.indexOf(a.Region);
      const ib = ORDER.indexOf(b.Region);
      if (ia !== -1 || ib !== -1)
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      return b.total_count - a.total_count;
    });

    return rows;
  }, [sortedBreakdown]);

  const pieData = useMemo(() => {
    if (!summary) return [];
    return [
      {
        name: "Target Achieved",
        value: summary.target_achieved,
        color: STATUS_COLORS.target,
      },
      {
        name: "Base Achieved",
        value: summary.base_achieved,
        color: STATUS_COLORS.base,
      },
      {
        name: "Below Base",
        value: summary.below_base,
        color: STATUS_COLORS.below,
      },
      {
        name: "No Fueling",
        value: summary.no_fueling,
        color: STATUS_COLORS.none,
      },
    ].filter((x) => x.value > 0);
  }, [summary]);

  const filteredTableRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return sortedBreakdown;
    return sortedBreakdown.filter((r) => r.SubRegion.toLowerCase().includes(q));
  }, [sortedBreakdown, tableSearch]);

  const handleDownloadTableCSV = () => {
    if (filteredTableRows.length === 0) return;

    downloadCsv(
      `DG_KPI_SubRegion_${dateParams.label.replace(/\s+/g, "_")}.csv`,
      [
        "Sub-Region",
        "Target Achieved",
        "Base Achieved",
        "Below Base",
        "No Fueling",
        "Avg Score",
        "Achieved (%)",
        "Total Sites",
      ],
      filteredTableRows.map((r: any) => {
        const total =
          Number(r.total_count ?? 0) ||
          Number(r.target_achieved ?? 0) +
            Number(r.base_achieved ?? 0) +
            Number(r.below_base ?? 0) +
            Number(r.no_fueling ?? 0);

        return [
          r.SubRegion,
          r.target_achieved,
          r.base_achieved,
          r.below_base,
          r.no_fueling,
          Number(r.avg_score ?? 0).toFixed(1),
          pct(r.target_achieved, total),
          total,
        ];
      })
    );
  };

  const handleMonthSelect = (idx: number) => {
    setSelectedMonth(setYear(setMonth(new Date(), idx), pickerYear));
    setViewMode("month");
    setIsPickerOpen(false);
  };

  // PIE LABEL: nudge left-side labels up (fix Base Achieved hidden)
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

    const sx = cx + (outerRadius + 6) * cos;
    const sy = cy + (outerRadius + 6) * sin;
    const mx = cx + (outerRadius + 18) * cos;
    const my = cy + (outerRadius + 18) * sin;

    const leftSide = cos < 0;
    const yNudge = leftSide ? -12 : 0;

    const ex = mx + (leftSide ? -1 : 1) * 12;
    const ey = my + yNudge;
    const textAnchor = leftSide ? "end" : "start";

    return (
      <g>
        <path
          d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
          stroke={color}
          fill="none"
          strokeWidth={1.6}
        />
        <circle cx={ex} cy={ey} r={2.2} fill={color} stroke="none" />
        <text
          x={ex + (leftSide ? -1 : 1) * 8}
          y={ey}
          textAnchor={textAnchor}
          fill={color}
          dominantBaseline="central"
          className="text-[12px] font-black uppercase"
        >
          {`${name}: ${(percent * 100).toFixed(0)}%`}
        </text>
      </g>
    );
  };

  // ✅ Bar labels: inside if tall; above if tiny (so Base shows)
  const renderGroupedValueLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    const v = Number(value ?? 0);
    if (!v) return null;

    const isSmall = height < 22;
    return (
      <text
        x={x + width / 2}
        y={isSmall ? y - 8 : y + height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className={cn(
          "text-[12px] font-black",
          isSmall ? "fill-slate-900" : "fill-white"
        )}
      >
        {v}
      </text>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-10">
      <div className="absolute top-0 left-0 w-full h-[280px] bg-slate-950 z-0" />
      <div className="relative z-10 p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header & Filter Row */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between pt-4">
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">
              DG KPI <span className="text-blue-400">Analytics</span>
            </h1>
            <p className="text-[12px] text-slate-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
              <CalendarIcon className="h-3 w-3" /> {dateParams.label}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-[800px]">
            <div className="space-y-1">
              <label className="text-[12px] font-bold text-slate-500 uppercase ml-1">
                Region
              </label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger className="bg-white/10 border-white/5 text-white h-10 backdrop-blur-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 text-white border-slate-800">
                  {regions.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-bold text-slate-500 uppercase ml-1">
                Sub-Region
              </label>
              <Select value={subRegion} onValueChange={setSubRegion}>
                <SelectTrigger className="bg-white/10 border-white/5 text-white h-10 backdrop-blur-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 text-white border-slate-800">
                  {subRegions.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-bold text-blue-400 uppercase ml-1">
                Timeline
              </label>
              <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-10 bg-[#1e2235]/50 border-white/10 text-white hover:bg-[#1e2235] justify-start font-bold"
                  >
                    <CalendarDays className="mr-2 h-4 w-4 text-blue-500" />
                    <span className="truncate">{dateParams.label}</span>
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  className="p-0 bg-[#0f172a] border-slate-800 shadow-2xl rounded-xl w-[300px]"
                  align="end"
                >
                  <Tabs
                    defaultValue={viewMode}
                    onValueChange={(v: any) => setViewMode(v)}
                    className="w-full"
                  >
                    <TabsList className="w-full bg-slate-900/50 h-12 p-1 gap-1 border-b border-slate-800 rounded-none">
                      <TabsTrigger
                        value="month"
                        className="flex-1 text-[13px] font-black uppercase transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-500 hover:text-slate-300"
                      >
                        Month View
                      </TabsTrigger>
                      <TabsTrigger
                        value="range"
                        className="flex-1 text-[13px] font-black uppercase transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-500 hover:text-slate-300"
                      >
                        Date Range
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="month" className="p-5 mt-0">
                      <div className="flex justify-between items-center mb-8 px-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:bg-white/5"
                          onClick={() => setPickerYear((v) => v - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-white font-bold tracking-widest text-[14px]">
                          {pickerYear}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:bg-white/5"
                          onClick={() => setPickerYear((v) => v + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-3 gap-y-4 gap-x-2">
                        {MONTH_LABELS.map((m, i) => (
                          <Button
                            key={m}
                            variant="ghost"
                            className={cn(
                              "h-10 text-[14px] font-semibold rounded-lg transition-all",
                              viewMode === "month" &&
                                selectedMonth.getMonth() === i &&
                                selectedMonth.getFullYear() === pickerYear
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
                                : "text-slate-400 hover:bg-white/5"
                            )}
                            onClick={() => handleMonthSelect(i)}
                          >
                            {m}
                          </Button>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent
                      value="range"
                      className="p-0 mt-0 bg-[#0f172a] h-[340px] flex flex-col"
                    >
                      <div className="flex-1 px-3 pt-3">
                        <Calendar
                          mode="range"
                          selected={selectedRange}
                          onSelect={setSelectedRange}
                          initialFocus
                          className="p-0 w-full"
                          classNames={{
                            caption_label: "text-[14px] font-bold text-white",
                            nav_button:
                              "h-7 w-7 bg-transparent p-0 text-slate-400 opacity-50 hover:opacity-100 hover:text-white",
                            day: "h-9 w-9 p-0 text-[13px] font-normal text-slate-300 rounded-md transition-all hover:bg-blue-600/20 hover:text-white",
                            day_selected:
                              "bg-blue-600 text-white hover:bg-blue-500 hover:text-white focus:bg-blue-600 focus:text-white",
                            day_today: "bg-white/10 text-blue-400 font-black",
                            day_outside: "text-slate-600 opacity-20",
                            day_range_middle:
                              "aria-selected:bg-blue-600/20 aria-selected:text-blue-200",
                            day_range_start:
                              "bg-blue-600 text-white rounded-l-md",
                            day_range_end:
                              "bg-blue-600 text-white rounded-r-md",
                          }}
                        />
                      </div>

                      <div className="p-4 bg-slate-900/50 border-t border-slate-800 flex justify-end mt-auto">
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-5 rounded-xl shadow-lg shadow-blue-900/40 text-[13px]"
                          onClick={() => {
                            if (selectedRange?.from) {
                              setViewMode("range");
                              setIsPickerOpen(false);
                            }
                          }}
                        >
                          Apply Range
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* 7 Metric Cards (✅ score is card #2 + first 3 colors all different) */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
          {[
            {
              label: "Distinct Engines",
              val: summary?.distinct_engines.toLocaleString(),
              icon: Database,
              bg: "bg-[#162033]", // navy
              text: "text-white",
            },
            {
              label: "Avg Score",
              val: avgScore.toFixed(1),
              icon: BarChart3,
              bg: "bg-[#2b1c3f]", // purple
              text: "text-white",
            },
            {
              label: "Avg Fuel (Ltrs)",
              val: avgFuel.toFixed(1),
              icon: TrendingUp,
              bg: "bg-[#12323a]", // teal-dark
              text: "text-white",
            },
            {
              label: "Target Achieved",
              val: summary?.target_achieved,
              icon: Target,
              bg: "bg-emerald-500",
              text: "text-white",
            },
            {
              label: "Base Achieved",
              val: summary?.base_achieved,
              icon: Zap,
              bg: "bg-blue-600",
              text: "text-white",
            },
            {
              label: "Below Base",
              val: summary?.below_base,
              icon: BarChart3,
              bg: "bg-amber-500",
              text: "text-white",
            },
            {
              label: "No Fueling",
              val: summary?.no_fueling,
              icon: Fuel,
              bg: "bg-slate-500",
              text: "text-white",
            },
          ].map((card, i) => (
            <Card
              key={i}
              className={cn(
                "border-none shadow-xl rounded-2xl overflow-hidden hover:scale-[1.05] transition-all duration-300",
                card.bg
              )}
            >
              <CardContent className="p-6 flex flex-col items-center text-center">
                <card.icon
                  className={cn("h-6 w-6 opacity-30 mb-3", card.text)}
                />
                <p className="text-[13px] font-black uppercase tracking-widest text-white/90 mb-1">
                  {card.label}
                </p>
                <p
                  className={cn(
                    "text-3xl font-black tracking-tighter leading-none",
                    card.text
                  )}
                >
                  {loading ? "..." : card.val}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* GRAPHS */}
        <div className="grid grid-cols-12 gap-6">
          {/* ✅ Region-level grouped bar (prettier + full legend labels + Base labels show) */}
          <Card className="col-span-12 lg:col-span-7 border-none shadow-xl rounded-[24px] bg-white overflow-hidden">
            <CardHeader className="px-8 py-6 border-b">
              <CardTitle className="text-[13px] font-black text-slate-500 uppercase tracking-widest">
                Efficiency Breakdown (Region-wise)
              </CardTitle>
            </CardHeader>

            <CardContent className="p-8 h-[480px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartRows}
                  margin={{ top: 26, right: 24, left: 0, bottom: 68 }}
                  barCategoryGap="30%"
                  barGap={10}
                  barSize={34}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#eef2ff"
                  />
                  <XAxis
                    dataKey="Region"
                    tick={{ fontSize: 13, fontWeight: 900 }}
                    axisLine={false}
                    tickLine={false}
                    height={52}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fontWeight: 800 }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 10px 30px rgba(2,6,23,0.08)",
                    }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{
                      paddingTop: "18px",
                      fontSize: "12px",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  />

                  <Bar
                    dataKey="target_achieved"
                    name="Target Achieved"
                    fill={STATUS_COLORS.target}
                    radius={[10, 10, 10, 10]}
                  >
                    <LabelList content={renderGroupedValueLabel} />
                  </Bar>

                  <Bar
                    dataKey="base_achieved"
                    name="Base Achieved"
                    fill={STATUS_COLORS.base}
                    radius={[10, 10, 10, 10]}
                  >
                    <LabelList content={renderGroupedValueLabel} />
                  </Bar>

                  <Bar
                    dataKey="below_base"
                    name="Below Base"
                    fill={STATUS_COLORS.below}
                    radius={[10, 10, 10, 10]}
                  >
                    <LabelList content={renderGroupedValueLabel} />
                  </Bar>

                  <Bar
                    dataKey="no_fueling"
                    name="No Fueling"
                    fill={STATUS_COLORS.none}
                    radius={[10, 10, 10, 10]}
                  >
                    <LabelList content={renderGroupedValueLabel} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* PIE */}
          <Card className="col-span-12 lg:col-span-5 border-none shadow-xl rounded-[24px] bg-white overflow-hidden">
            <CardHeader className="px-8 py-6 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-[13px] font-black text-slate-500 uppercase tracking-widest">
                Status Distribution
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 h-[480px] flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart
                  margin={{ left: 110, right: 110, top: 30, bottom: 30 }}
                >
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="48%"
                    outerRadius="62%"
                    paddingAngle={6}
                    stroke="none"
                    label={renderPieLabel}
                  >
                    {pieData.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                    <Label
                      position="center"
                      content={({ viewBox }) => {
                        const { cx, cy } = (viewBox || {}) as any;
                        if (typeof cx !== "number" || typeof cy !== "number")
                          return null;
                        return (
                          <g>
                            <text
                              x={cx}
                              y={cy - 5}
                              textAnchor="middle"
                              dominantBaseline="central"
                              className="fill-slate-900 text-3xl font-black"
                            >
                              {loading ? "..." : totalSites.toLocaleString()}
                            </text>
                            <text
                              x={cx}
                              y={cy + 22}
                              textAnchor="middle"
                              dominantBaseline="central"
                              className="fill-slate-400 text-[12px] font-bold uppercase tracking-[0.2em]"
                            >
                              Total Sites
                            </text>
                          </g>
                        );
                      }}
                    />
                  </Pie>
                  <Tooltip />
                  <Legend
                    verticalAlign="bottom"
                    height={40}
                    iconType="rect"
                    wrapperStyle={{
                      fontSize: "12px",
                      fontWeight: 900,
                      paddingTop: "20px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* ONE TABLE */}
        <Card className="border-none shadow-xl rounded-[24px] bg-white overflow-hidden">
          <CardHeader className="px-8 py-6 bg-slate-50 border-b flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-lg font-black text-slate-800 uppercase tracking-widest">
              Sub-Region — Performance Summary
            </CardTitle>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Search Sub-Region..."
                  className="h-9 pl-9 w-[240px] text-sm"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTableCSV}
                className="flex items-center gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 font-bold px-4 transition-all"
              >
                <Download className="w-4 h-4" />
                Download CSV
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="text-[12px] font-bold bg-slate-100/30 text-slate-500 uppercase">
                <tr>
                  <th className="px-8 py-5">Sub-Region</th>
                  <th className="px-4 py-5 text-center">Target Achieved</th>
                  <th className="px-4 py-5 text-center">Base Achieved</th>
                  <th className="px-4 py-5 text-center">Below Base</th>
                  <th className="px-4 py-5 text-center">No Fueling</th>
                  <th className="px-4 py-5 text-center">Avg Score</th>
                  <th className="px-4 py-5 text-center text-blue-600">
                    Achieved (%)
                  </th>
                  <th className="px-8 py-5 text-right">Total Sites</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-50">
                {filteredTableRows.map((r: any, i) => {
                  const total =
                    Number(r.total_count ?? 0) ||
                    Number(r.target_achieved ?? 0) +
                      Number(r.base_achieved ?? 0) +
                      Number(r.below_base ?? 0) +
                      Number(r.no_fueling ?? 0);

                  return (
                    <tr key={i} className="hover:bg-blue-50/20 transition-all">
                      <td className="px-8 py-4 text-[15px] font-bold text-slate-700">
                        {r.SubRegion}
                      </td>

                      <td className="px-4 py-4 text-center text-[14px] font-black text-emerald-700">
                        {r.target_achieved}
                      </td>

                      <td className="px-4 py-4 text-center text-[14px] font-black text-blue-700">
                        {r.base_achieved}
                      </td>

                      <td className="px-4 py-4 text-center text-[14px] font-black text-amber-700">
                        {r.below_base}
                      </td>

                      <td className="px-4 py-4 text-center text-[14px] font-black text-slate-600">
                        {r.no_fueling}
                      </td>

                      <td className="px-4 py-4 text-center text-[14px] font-black text-slate-900">
                        {Number(r.avg_score ?? 0).toFixed(1)}
                      </td>

                      <td className="px-4 py-4 text-center text-[14px] font-black text-slate-900">
                        {pct(r.target_achieved, total)}
                      </td>

                      <td className="px-8 py-4 text-right text-[14px] font-bold text-slate-400">
                        {total}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

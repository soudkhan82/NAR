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
  Download, // Added Download Icon
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
  target: "#10b981", // Emerald Green
  base: "#3b82f6", // Blue
  below: "#f59e0b", // Amber Orange
  none: "#64748b", // Slate
};

const pct = (part: number, total: number) =>
  total > 0 ? `${((part * 100) / total).toFixed(1)}%` : "0.0%";

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

  const avgFuel = useMemo(
    () =>
      summary && summary.valid_fueling_entries > 0
        ? summary.total_fuel / summary.valid_fueling_entries
        : 0,
    [summary]
  );

  const totalSites = useMemo(
    () =>
      summary
        ? summary.target_achieved +
          summary.base_achieved +
          summary.below_base +
          summary.no_fueling
        : 0,
    [summary]
  );

  const sortedBreakdown = useMemo(
    () => [...breakdown].sort((a, b) => a.SubRegion.localeCompare(b.SubRegion)),
    [breakdown]
  );

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

  // --- CSV DOWNLOAD LOGIC ---
  const handleDownloadCSV = () => {
    if (sortedBreakdown.length === 0) return;

    const headers = [
      "Sub-Region",
      "No Fueling",
      "Below Base",
      "Base Achieved",
      "Target Achieved",
      "Achieved (%)",
      "Total Sites",
    ];

    const csvRows = sortedBreakdown.map((r) =>
      [
        r.SubRegion,
        r.no_fueling,
        r.below_base,
        r.base_achieved,
        r.target_achieved,
        pct(r.target_achieved, r.total_count),
        r.total_count,
      ].join(",")
    );

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `DG_KPI_Performance_${dateParams.label.replace(/\s+/g, "_")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMonthSelect = (idx: number) => {
    setSelectedMonth(setYear(setMonth(new Date(), idx), pickerYear));
    setViewMode("month");
    setIsPickerOpen(false);
  };

  const renderPieLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
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
    const ex = mx + (cos >= 0 ? 1 : -1) * 12;
    const ey = my;
    const textAnchor = cos >= 0 ? "start" : "end";

    return (
      <g>
        <path
          d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
          stroke={color}
          fill="none"
          strokeWidth={1.5}
        />
        <circle cx={ex} cy={ey} r={2} fill={color} stroke="none" />
        <text
          x={ex + (cos >= 0 ? 1 : -1) * 8}
          y={ey}
          textAnchor={textAnchor}
          fill={color}
          dominantBaseline="central"
          className="text-[9px] font-black uppercase"
        >
          {`${name}: ${(percent * 100).toFixed(0)}%`}
        </text>
      </g>
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
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
              <CalendarIcon className="h-3 w-3" /> {dateParams.label}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-[800px]">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">
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
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">
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
              <label className="text-[10px] font-bold text-blue-400 uppercase ml-1">
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
                        className="flex-1 text-[11px] font-black uppercase transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-500 hover:text-slate-300"
                      >
                        Month View
                      </TabsTrigger>
                      <TabsTrigger
                        value="range"
                        className="flex-1 text-[11px] font-black uppercase transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-500 hover:text-slate-300"
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
                        <span className="text-white font-bold tracking-widest">
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
                              "h-10 text-sm font-semibold rounded-lg transition-all",
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
                            caption_label: "text-sm font-bold text-white",
                            nav_button:
                              "h-7 w-7 bg-transparent p-0 text-slate-400 opacity-50 hover:opacity-100 hover:text-white",
                            day: "h-9 w-9 p-0 font-normal text-slate-300 rounded-md transition-all hover:bg-blue-600/20 hover:text-white",
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
                          className="bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-5 rounded-xl shadow-lg shadow-blue-900/40"
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

        {/* 6 Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            {
              label: "Distinct Engines",
              val: summary?.distinct_engines.toLocaleString(),
              icon: Database,
              bg: "bg-[#1e2235]",
              text: "text-white",
            },
            {
              label: "Avg Fuel (Ltrs)",
              val: avgFuel.toFixed(1),
              icon: TrendingUp,
              bg: "bg-slate-800",
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
                "border-none shadow-xl rounded-2xl overflow-hidden hover:scale-[1.02] transition-transform",
                card.bg
              )}
            >
              <CardContent className="p-5 flex flex-col items-center text-center">
                <card.icon
                  className={cn("h-5 w-5 opacity-30 mb-2", card.text)}
                />
                <p className="text-[10px] font-black uppercase tracking-tighter text-white opacity-80 mb-1">
                  {card.label}
                </p>
                <p className={cn("text-2xl font-black", card.text)}>
                  {loading ? "..." : card.val}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* GRAPHS */}
        <div className="grid grid-cols-12 gap-6">
          <Card className="col-span-12 lg:col-span-7 border-none shadow-xl rounded-[24px] bg-white overflow-hidden">
            <CardHeader className="px-8 py-6 border-b">
              <CardTitle className="text-xs font-black text-slate-500 uppercase tracking-widest">
                Efficiency Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 h-[480px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sortedBreakdown}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    dataKey="SubRegion"
                    tick={{ fontSize: 10, fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip cursor={{ fill: "#f8fafc" }} />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{
                      paddingTop: "20px",
                      fontSize: "10px",
                      fontWeight: "bold",
                    }}
                  />
                  <Bar
                    dataKey="target_achieved"
                    name="Target"
                    stackId="a"
                    fill={STATUS_COLORS.target}
                  />
                  <Bar
                    dataKey="base_achieved"
                    name="Base"
                    stackId="a"
                    fill={STATUS_COLORS.base}
                  />
                  <Bar
                    dataKey="below_base"
                    name="Below"
                    stackId="a"
                    fill={STATUS_COLORS.below}
                  />
                  <Bar
                    dataKey="no_fueling"
                    name="None"
                    stackId="a"
                    fill={STATUS_COLORS.none}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="col-span-12 lg:col-span-5 border-none shadow-xl rounded-[24px] bg-white overflow-hidden">
            <CardHeader className="px-8 py-6 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black text-slate-500 uppercase tracking-widest">
                Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 h-[480px] flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ left: 60, right: 60, top: 0, bottom: 0 }}>
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
                              className="fill-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]"
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
                    height={36}
                    iconType="rect"
                    wrapperStyle={{
                      fontSize: "10px",
                      fontWeight: "bold",
                      paddingTop: "30px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Performance Table - UPDATED HEADER WITH DOWNLOAD OPTION */}
        <Card className="border-none shadow-xl rounded-[24px] bg-white overflow-hidden">
          <CardHeader className="px-8 py-6 bg-slate-50 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-black text-slate-800 uppercase tracking-widest">
              Performance Detail Overview
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCSV}
              className="flex items-center gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 font-bold px-4 transition-all"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </Button>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="text-[10px] font-bold bg-slate-100/30 text-slate-500 uppercase">
                <tr>
                  <th className="px-8 py-5">Sub-Region</th>
                  <th className="px-4 py-5 text-center">No Fueling</th>
                  <th className="px-4 py-5 text-center">Below Base</th>
                  <th className="px-4 py-5 text-center">Base Achieved</th>
                  <th className="px-4 py-5 text-center">Target Achieved</th>
                  <th className="px-4 py-5 text-center text-blue-600">
                    Achieved (%)
                  </th>
                  <th className="px-8 py-5 text-right">Total Sites</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedBreakdown.map((r, i) => (
                  <tr
                    key={i}
                    className="hover:bg-blue-50/20 transition-all group"
                  >
                    <td className="px-8 py-4 text-sm font-bold text-slate-700">
                      {r.SubRegion}
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-medium text-slate-500">
                      {r.no_fueling}
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-medium text-slate-500">
                      {r.below_base}
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-medium text-slate-500">
                      {r.base_achieved}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-md text-xs font-black">
                        {r.target_achieved}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center font-black text-slate-900">
                      {pct(r.target_achieved, r.total_count)}
                    </td>
                    <td className="px-8 py-4 text-right text-sm font-bold text-slate-400">
                      {r.total_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

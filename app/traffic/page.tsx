// app/Traffic/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { ArrowUpRight, ArrowDownRight, ArrowUpDown } from "lucide-react";

import {
  fetchRegions,
  fetchSubregionsByRegion,
  fetchTrafficDateBounds,
  fetchTrafficTimeseries,
  fetchTrafficComparison,
  fetchTrafficGridChange,
  fetchTrafficDistrictChange,
  type TrafficTimeseriesRow,
  type TrafficComparisonRow,
  type TrafficGridChangeRow,
  type TrafficDistrictChangeRow,
} from "@/app/lib/rpc/traffic";

type RegionFilter = "ALL" | string;

interface FiltersState {
  region: RegionFilter;
  subregion: string; // "ALL" = all
  oldDate: string;
  newDate: string;
}

/* ------ helper: number formatting ------ */

const formatNumberCompact = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
};

const formatNumberStd = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en", {
    maximumFractionDigits: 2,
  });
};

/* ------ CSV helper ------ */

const downloadCsv = (
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
) => {
  const escape = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    if (s.includes('"') || s.includes(",") || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const csvLines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];
  const csv = csvLines.join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/* ------ indicator meta for charts + cards + table ------ */

const INDICATORS: {
  key: keyof TrafficTimeseriesRow;
  metricCode: string;
  label: string;
  group: "Voice" | "Data";
}[] = [
  {
    key: "voice_2g",
    metricCode: "RadioVoice_2G_Traffic",
    label: "2G Voice (erl)",
    group: "Voice",
  },
  {
    key: "voice_3g",
    metricCode: "RadioVoice_3G_Traffic",
    label: "3G Voice (erl)",
    group: "Voice",
  },
  {
    key: "volte_voice",
    metricCode: "VoLTE_Voice_Traffic",
    label: "VoLTE Voice (erl)",
    group: "Voice",
  },
  {
    key: "total_voice_erl",
    metricCode: "TotalVoiceTraffic_Erl",
    label: "Total Voice (erl)",
    group: "Voice",
  },
  {
    key: "data_2g_gb",
    metricCode: "RadioData_2G_Traffic_GB",
    label: "2G Data (GB)",
    group: "Data",
  },
  {
    key: "data_3g_gb",
    metricCode: "RadioData_3G_Traffic_GB",
    label: "3G Data (GB)",
    group: "Data",
  },
  {
    key: "data_4g_gb",
    metricCode: "RadioData_4G_Traffic_GB",
    label: "4G Data (GB)",
    group: "Data",
  },
  {
    key: "total_data_gb",
    metricCode: "Total_Traffic_GB",
    label: "Total Data (GB)",
    group: "Data",
  },
];

type SortField = "voice" | "data" | "none";
type SortDir = "asc" | "desc";

export default function TrafficPage() {
  const today = new Date();
  const isoToday = today.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const isoSevenDaysAgo = sevenDaysAgo.toISOString().slice(0, 10);

  const [filters, setFilters] = useState<FiltersState>({
    region: "ALL",
    subregion: "ALL",
    oldDate: isoSevenDaysAgo,
    newDate: isoToday,
  });

  const [regionOptions, setRegionOptions] = useState<string[]>([]);
  const [subregionOptions, setSubregionOptions] = useState<string[]>([]);

  const [tsData, setTsData] = useState<TrafficTimeseriesRow[]>([]);
  const [compareRows, setCompareRows] = useState<TrafficComparisonRow[]>([]);
  const [gridChangeRows, setGridChangeRows] = useState<TrafficGridChangeRow[]>(
    []
  );
  const [districtChangeRows, setDistrictChangeRows] = useState<
    TrafficDistrictChangeRow[]
  >([]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // sort state for grid & district tables
  const [gridSort, setGridSort] = useState<{ field: SortField; dir: SortDir }>({
    field: "none",
    dir: "asc",
  });
  const [districtSort, setDistrictSort] = useState<{
    field: SortField;
    dir: SortDir;
  }>({ field: "none", dir: "asc" });

  /* -------- initial load: Regions + date bounds -------- */

  useEffect(() => {
    const init = async () => {
      try {
        const [regions, bounds] = await Promise.all([
          fetchRegions(),
          fetchTrafficDateBounds(),
        ]);
        setRegionOptions(regions);

        if (bounds && bounds.min_date && bounds.max_date) {
          setFilters((prev) => ({
            ...prev,
            oldDate: bounds.min_date!,
            newDate: bounds.max_date!,
          }));
        }
      } catch (err) {
        console.error("Initial load error:", err);
      }
    };
    init();
  }, []);

  /* -------- when Region changes, load SubRegions -------- */

  useEffect(() => {
    const loadSubregions = async () => {
      try {
        if (filters.region === "ALL") {
          setSubregionOptions([]);
          setFilters((prev) => ({ ...prev, subregion: "ALL" }));
          return;
        }
        const subs = await fetchSubregionsByRegion(filters.region as string);
        setSubregionOptions(subs);
        setFilters((prev) => ({ ...prev, subregion: "ALL" }));
      } catch (err) {
        console.error("loadSubregions error:", err);
      }
    };
    loadSubregions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.region]);

  /* -------- handlers -------- */

  const handleRegionChange = (value: RegionFilter) => {
    setFilters((prev) => ({
      ...prev,
      region: value,
      subregion: "ALL",
    }));
  };

  const handleApply = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const regionParam =
        filters.region === "ALL" ? null : (filters.region as string);
      const subregionParam =
        regionParam && filters.subregion !== "ALL" ? filters.subregion : null;

      const baseParams = {
        region: regionParam,
        subregion: subregionParam,
      };

      const [ts, cmp, gridStats, distStats] = await Promise.all([
        fetchTrafficTimeseries({
          ...baseParams,
          dateFrom: filters.oldDate,
          dateTo: filters.newDate,
        }),
        fetchTrafficComparison({
          ...baseParams,
          oldDate: filters.oldDate,
          newDate: filters.newDate,
        }),
        fetchTrafficGridChange(
          regionParam,
          subregionParam,
          filters.oldDate,
          filters.newDate
        ),
        fetchTrafficDistrictChange(
          regionParam,
          subregionParam,
          filters.oldDate,
          filters.newDate
        ),
      ]);

      console.log("Traffic timeseries:", ts);
      console.log("Traffic comparison:", cmp);
      console.log("Traffic grid change:", gridStats);
      console.log("Traffic district change:", distStats);

      setTsData(ts);
      setCompareRows(cmp);
      setGridChangeRows(gridStats);
      setDistrictChangeRows(distStats);

      // reset sorts on fresh data
      setGridSort({ field: "none", dir: "asc" });
      setDistrictSort({ field: "none", dir: "asc" });
    } catch (err) {
      const e = err as Error;
      console.error("handleApply error:", e);
      setErrorMsg(e.message || "Failed to load traffic data");
    } finally {
      setLoading(false);
    }
  };

  /* -------- derived: average cards -------- */

  const avgByIndicator = useMemo(() => {
    const result: Record<string, number | null> = {};
    INDICATORS.forEach((ind) => {
      const values = tsData
        .map((row) => row[ind.key] as number | null)
        .filter((v): v is number => v != null);
      if (!values.length) {
        result[ind.metricCode] = null;
      } else {
        const sum = values.reduce((acc, v) => acc + v, 0);
        result[ind.metricCode] = sum / values.length;
      }
    });
    return result;
  }, [tsData]);

  /* -------- sorting helpers -------- */

  const toggleGridSort = (field: SortField) => {
    if (field === "none") return;
    setGridSort((prev) => {
      if (prev.field !== field) {
        return { field, dir: "asc" };
      }
      return { field, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  const toggleDistrictSort = (field: SortField) => {
    if (field === "none") return;
    setDistrictSort((prev) => {
      if (prev.field !== field) {
        return { field, dir: "asc" };
      }
      return { field, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  const sortedGridRows = useMemo(() => {
    if (gridSort.field === "none") return gridChangeRows;
    const rows = [...gridChangeRows];
    rows.sort((a, b) => {
      let av = 0;
      let bv = 0;
      if (gridSort.field === "voice") {
        av = a.pct_change_voice ?? 0;
        bv = b.pct_change_voice ?? 0;
      } else if (gridSort.field === "data") {
        av = a.pct_change_data ?? 0;
        bv = b.pct_change_data ?? 0;
      }
      const diff = av - bv;
      return gridSort.dir === "asc" ? diff : -diff;
    });
    return rows;
  }, [gridChangeRows, gridSort]);

  const sortedDistrictRows = useMemo(() => {
    if (districtSort.field === "none") return districtChangeRows;
    const rows = [...districtChangeRows];
    rows.sort((a, b) => {
      let av = 0;
      let bv = 0;
      if (districtSort.field === "voice") {
        av = a.pct_change_voice ?? 0;
        bv = b.pct_change_voice ?? 0;
      } else if (districtSort.field === "data") {
        av = a.pct_change_data ?? 0;
        bv = b.pct_change_data ?? 0;
      }
      const diff = av - bv;
      return districtSort.dir === "asc" ? diff : -diff;
    });
    return rows;
  }, [districtChangeRows, districtSort]);

  /* -------- download handlers -------- */

  const handleDownloadSummary = () => {
    if (!compareRows.length) return;
    const headers = [
      "Indicator",
      `Earliest (${filters.oldDate})`,
      `Latest (${filters.newDate})`,
      "% Change",
    ];
    const rows = compareRows.map((row) => [
      row.metric_label,
      row.old_value ?? "",
      row.new_value ?? "",
      row.pct_change ?? "",
    ]);
    downloadCsv(
      `traffic_indicator_summary_${filters.oldDate}_${filters.newDate}.csv`,
      headers,
      rows
    );
  };

  const handleDownloadGrid = () => {
    if (!sortedGridRows.length) return;
    const headers = [
      "Grid",
      `Earliest Voice (${filters.oldDate})`,
      `Latest Voice (${filters.newDate})`,
      "% Voice",
      `Earliest Data (${filters.oldDate})`,
      `Latest Data (${filters.newDate})`,
      "% Data",
    ];
    const rows = sortedGridRows.map((row) => [
      row.grid ?? "",
      row.old_total_voice_erl ?? "",
      row.new_total_voice_erl ?? "",
      row.pct_change_voice ?? "",
      row.old_total_data_gb ?? "",
      row.new_total_data_gb ?? "",
      row.pct_change_data ?? "",
    ]);
    downloadCsv(
      `traffic_grid_summary_${filters.oldDate}_${filters.newDate}.csv`,
      headers,
      rows
    );
  };

  const handleDownloadDistrict = () => {
    if (!sortedDistrictRows.length) return;
    const headers = [
      "District",
      `Earliest Voice (${filters.oldDate})`,
      `Latest Voice (${filters.newDate})`,
      "% Voice",
      `Earliest Data (${filters.oldDate})`,
      `Latest Data (${filters.newDate})`,
      "% Data",
    ];
    const rows = sortedDistrictRows.map((row) => [
      row.district ?? "",
      row.old_total_voice_erl ?? "",
      row.new_total_voice_erl ?? "",
      row.pct_change_voice ?? "",
      row.old_total_data_gb ?? "",
      row.new_total_data_gb ?? "",
      row.pct_change_data ?? "",
    ]);
    downloadCsv(
      `traffic_district_summary_${filters.oldDate}_${filters.newDate}.csv`,
      headers,
      rows
    );
  };

  /* -------- render -------- */

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold text-center">Traffic Analytics</h1>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Region */}
            <div className="space-y-1">
              <Label>Region</Label>
              <Select
                value={filters.region}
                onValueChange={(v) => handleRegionChange(v as RegionFilter)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ALL (Full Network)</SelectItem>
                  {regionOptions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* SubRegion */}
            <div className="space-y-1">
              <Label>SubRegion</Label>
              <Select
                value={filters.subregion}
                onValueChange={(v) =>
                  setFilters((prev) => ({ ...prev, subregion: v }))
                }
                disabled={filters.region === "ALL"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All SubRegions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {subregionOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="space-y-1">
              <Label>Earliest date</Label>
              <Input
                type="date"
                value={filters.oldDate}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, oldDate: e.target.value }))
                }
              />
              <Label className="mt-2 block">Latest date</Label>
              <Input
                type="date"
                value={filters.newDate}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, newDate: e.target.value }))
                }
              />
            </div>
          </div>

          <Button onClick={handleApply} disabled={loading}>
            {loading ? "Loading..." : "Apply filters"}
          </Button>
          {errorMsg && <p className="text-sm text-red-600 mt-2">{errorMsg}</p>}
        </CardContent>
      </Card>

      {/* Average indicator cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {INDICATORS.map((ind) => {
          const avgVal = avgByIndicator[ind.metricCode];
          const isVoice = ind.group === "Voice";
          const cardBg = isVoice
            ? "bg-blue-50 border-blue-100"
            : "bg-emerald-50 border-emerald-100";
          const labelColor = isVoice ? "text-blue-900" : "text-emerald-900";
          const valueColor = isVoice ? "text-blue-800" : "text-emerald-800";

          return (
            <Card key={ind.metricCode} className={cardBg}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm font-semibold ${labelColor}`}>
                  {ind.label} (Average)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-semibold ${valueColor}`}>
                  {avgVal != null ? formatNumberCompact(avgVal) : "—"}
                </div>
                <p className="text-xs text-slate-600">{ind.group} indicator</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabular summary (all rows visible) */}
      <Card>
        <CardHeader className="flex items-center justify-between gap-2">
          <CardTitle>
            Indicator Summary – Earliest date {filters.oldDate} vs Latest date{" "}
            {filters.newDate}
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadSummary}
            disabled={!compareRows.length}
          >
            Download CSV
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {compareRows.length === 0 ? (
            <p className="text-base text-muted-foreground">
              Apply filters to see indicator-level summary.
            </p>
          ) : (
            <table className="w-full text-base border-collapse">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left p-2 font-semibold">Indicator</th>
                  <th className="text-right p-2 font-semibold">
                    Earliest date
                  </th>
                  <th className="text-right p-2 font-semibold">Latest date</th>
                  <th className="text-right p-2 font-semibold">% Change</th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row) => {
                  const oldVal = row.old_value ?? 0;
                  const newVal = row.new_value ?? 0;
                  const pct = row.pct_change;

                  let arrow = null;
                  let pctClass = "text-slate-700 bg-slate-50";
                  let pctText = "—";

                  if (pct != null) {
                    pctText = `${pct.toFixed(2)} %`;
                    if (pct > 0) {
                      arrow = <ArrowUpRight className="w-4 h-4 mr-1" />;
                      pctClass = "text-green-700 bg-green-50";
                    } else if (pct < 0) {
                      arrow = <ArrowDownRight className="w-4 h-4 mr-1" />;
                      pctClass = "text-red-700 bg-red-50";
                    }
                  }

                  return (
                    <tr key={row.metric_code} className="border-b">
                      <td className="p-2 font-medium">{row.metric_label}</td>
                      <td className="p-2 text-right bg-slate-50 font-medium">
                        {formatNumberStd(oldVal)}
                      </td>
                      <td className="p-2 text-right bg-slate-50 font-medium">
                        {formatNumberStd(newVal)}
                      </td>
                      <td className="p-2 text-right">
                        <span
                          className={`inline-flex items-center justify-end px-2 py-1 rounded text-sm font-semibold ${pctClass}`}
                        >
                          {arrow}
                          <span>{pctText}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Grid & District level tables */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Grid level */}
        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold">
              Grid-level Total Voice & Data – Earliest vs Latest
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadGrid}
              disabled={!sortedGridRows.length}
            >
              Download CSV
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {sortedGridRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No grid-level data for selected filters.
              </p>
            ) : (
              // CHANGED: increase max height so ~14 rows visible
              <div className="max-h-[30rem] overflow-y-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left p-2 font-semibold">Grid</th>
                      <th className="text-right p-2 font-semibold">
                        Earliest Voice
                      </th>
                      <th className="text-right p-2 font-semibold">
                        Latest Voice
                      </th>
                      <th className="text-right p-2 font-semibold">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleGridSort("voice")}
                        >
                          <span>% Voice</span>
                          <ArrowUpDown
                            className={`w-3 h-3 ${
                              gridSort.field === "voice"
                                ? "text-slate-900"
                                : "text-slate-400"
                            }`}
                          />
                        </button>
                      </th>
                      <th className="text-right p-2 font-semibold">
                        Earliest Data
                      </th>
                      <th className="text-right p-2 font-semibold">
                        Latest Data
                      </th>
                      <th className="text-right p-2 font-semibold">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleGridSort("data")}
                        >
                          <span>% Data</span>
                          <ArrowUpDown
                            className={`w-3 h-3 ${
                              gridSort.field === "data"
                                ? "text-slate-900"
                                : "text-slate-400"
                            }`}
                          />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedGridRows.map((row, idx) => {
                      const oldV = row.old_total_voice_erl ?? 0;
                      const newV = row.new_total_voice_erl ?? 0;
                      const pctV = row.pct_change_voice;

                      const oldD = row.old_total_data_gb ?? 0;
                      const newD = row.new_total_data_gb ?? 0;
                      const pctD = row.pct_change_data;

                      const voicePctClass =
                        pctV == null
                          ? "bg-slate-50 text-slate-700"
                          : pctV > 0
                          ? "bg-green-50 text-green-700"
                          : pctV < 0
                          ? "bg-red-50 text-red-700"
                          : "bg-slate-50 text-slate-700";

                      const dataPctClass =
                        pctD == null
                          ? "bg-slate-50 text-slate-700"
                          : pctD > 0
                          ? "bg-green-50 text-green-700"
                          : pctD < 0
                          ? "bg-red-50 text-red-700"
                          : "bg-slate-50 text-slate-700";

                      let voiceArrow = null;
                      if (pctV != null) {
                        if (pctV > 0) {
                          voiceArrow = (
                            <ArrowUpRight className="w-3 h-3 mr-1" />
                          );
                        } else if (pctV < 0) {
                          voiceArrow = (
                            <ArrowDownRight className="w-3 h-3 mr-1" />
                          );
                        }
                      }

                      let dataArrow = null;
                      if (pctD != null) {
                        if (pctD > 0) {
                          dataArrow = <ArrowUpRight className="w-3 h-3 mr-1" />;
                        } else if (pctD < 0) {
                          dataArrow = (
                            <ArrowDownRight className="w-3 h-3 mr-1" />
                          );
                        }
                      }

                      return (
                        <tr
                          key={`${row.grid ?? "N/A"}-${idx}`}
                          className="border-b"
                        >
                          <td className="p-2 font-medium">
                            {row.grid ?? "N/A"}
                          </td>
                          <td className="p-2 text-right bg-slate-50 font-medium">
                            {formatNumberStd(oldV)}
                          </td>
                          <td className="p-2 text-right bg-slate-50 font-medium">
                            {formatNumberStd(newV)}
                          </td>
                          <td className="p-2 text-right">
                            <span
                              className={`inline-flex items-center justify-end px-1 py-0.5 rounded text-xs font-semibold ${voicePctClass}`}
                            >
                              {voiceArrow}
                              {pctV != null ? `${pctV.toFixed(1)}%` : "—"}
                            </span>
                          </td>
                          <td className="p-2 text-right bg-slate-50 font-medium">
                            {formatNumberStd(oldD)}
                          </td>
                          <td className="p-2 text-right bg-slate-50 font-medium">
                            {formatNumberStd(newD)}
                          </td>
                          <td className="p-2 text-right">
                            <span
                              className={`inline-flex items-center justify-end px-1 py-0.5 rounded text-xs font-semibold ${dataPctClass}`}
                            >
                              {dataArrow}
                              {pctD != null ? `${pctD.toFixed(1)}%` : "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* District level */}
        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold">
              District-level Total Voice & Data – Earliest vs Latest
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadDistrict}
              disabled={!sortedDistrictRows.length}
            >
              Download CSV
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {sortedDistrictRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No district-level data for selected filters.
              </p>
            ) : (
              // CHANGED: increase max height so ~14 rows visible
              <div className="max-h-[30rem] overflow-y-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left p-2 font-semibold">District</th>
                      <th className="text-right p-2 font-semibold">
                        Earliest Voice
                      </th>
                      <th className="text-right p-2 font-semibold">
                        Latest Voice
                      </th>
                      <th className="text-right p-2 font-semibold">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleDistrictSort("voice")}
                        >
                          <span>% Voice</span>
                          <ArrowUpDown
                            className={`w-3 h-3 ${
                              districtSort.field === "voice"
                                ? "text-slate-900"
                                : "text-slate-400"
                            }`}
                          />
                        </button>
                      </th>
                      <th className="text-right p-2 font-semibold">
                        Earliest Data
                      </th>
                      <th className="text-right p-2 font-semibold">
                        Latest Data
                      </th>
                      <th className="text-right p-2 font-semibold">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleDistrictSort("data")}
                        >
                          <span>% Data</span>
                          <ArrowUpDown
                            className={`w-3 h-3 ${
                              districtSort.field === "data"
                                ? "text-slate-900"
                                : "text-slate-400"
                            }`}
                          />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDistrictRows.map((row, idx) => {
                      const oldV = row.old_total_voice_erl ?? 0;
                      const newV = row.new_total_voice_erl ?? 0;
                      const pctV = row.pct_change_voice;

                      const oldD = row.old_total_data_gb ?? 0;
                      const newD = row.new_total_data_gb ?? 0;
                      const pctD = row.pct_change_data;

                      const voicePctClass =
                        pctV == null
                          ? "bg-slate-50 text-slate-700"
                          : pctV > 0
                          ? "bg-green-50 text-green-700"
                          : pctV < 0
                          ? "bg-red-50 text-red-700"
                          : "bg-slate-50 text-slate-700";

                      const dataPctClass =
                        pctD == null
                          ? "bg-slate-50 text-slate-700"
                          : pctD > 0
                          ? "bg-green-50 text-green-700"
                          : pctD < 0
                          ? "bg-red-50 text-red-700"
                          : "bg-slate-50 text-slate-700";

                      let voiceArrow = null;
                      if (pctV != null) {
                        if (pctV > 0) {
                          voiceArrow = (
                            <ArrowUpRight className="w-3 h-3 mr-1" />
                          );
                        } else if (pctV < 0) {
                          voiceArrow = (
                            <ArrowDownRight className="w-3 h-3 mr-1" />
                          );
                        }
                      }

                      let dataArrow = null;
                      if (pctD != null) {
                        if (pctD > 0) {
                          dataArrow = <ArrowUpRight className="w-3 h-3 mr-1" />;
                        } else if (pctD < 0) {
                          dataArrow = (
                            <ArrowDownRight className="w-3 h-3 mr-1" />
                          );
                        }
                      }

                      return (
                        <tr
                          key={`${row.district ?? "N/A"}-${idx}`}
                          className="border-b"
                        >
                          <td className="p-2 font-medium">
                            {row.district ?? "N/A"}
                          </td>
                          <td className="p-2 text-right bg-slate-50 font-medium">
                            {formatNumberStd(oldV)}
                          </td>
                          <td className="p-2 text-right bg-slate-50 font-medium">
                            {formatNumberStd(newV)}
                          </td>
                          <td className="p-2 text-right">
                            <span
                              className={`inline-flex items-center justify-end px-1 py-0.5 rounded text-xs font-semibold ${voicePctClass}`}
                            >
                              {voiceArrow}
                              {pctV != null ? `${pctV.toFixed(1)}%` : "—"}
                            </span>
                          </td>
                          <td className="p-2 text-right bg-slate-50 font-medium">
                            {formatNumberStd(oldD)}
                          </td>
                          <td className="p-2 text-right bg-slate-50 font-medium">
                            {formatNumberStd(newD)}
                          </td>
                          <td className="p-2 text-right">
                            <span
                              className={`inline-flex items-center justify-end px-1 py-0.5 rounded text-xs font-semibold ${dataPctClass}`}
                            >
                              {dataArrow}
                              {pctD != null ? `${pctD.toFixed(1)}%` : "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Indicator charts grid – one per indicator */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {INDICATORS.map((ind) => (
          <Card key={ind.metricCode}>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                {ind.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {tsData.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No data yet. Apply filters above.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={tsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dt" />
                    <YAxis
                      tickFormatter={(v) => formatNumberCompact(v as number)}
                    />
                    <Tooltip
                      formatter={(value) => formatNumberStd(value as number)}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey={ind.key}
                      name={ind.label}
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

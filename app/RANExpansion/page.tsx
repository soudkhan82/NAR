// app/RANExpansion/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

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

import {
  fetchRanProjects,
  fetchEarliestIntegrationDate,
  fetchLatestTrafficDate,
  fetchRanRegions,
  fetchRanSubregionsByRegion,
  fetchTrafficAverages,
  fetchTrafficGridComparison,
  fetchTrafficTimeseries,
  fetchRanSiteCount,
  type TrafficAvgRow,
  type TrafficGridRow,
  type TrafficTimeseriesRow,
} from "@/app/lib/rpc/Ranexp";

import { cn } from "@/lib/utils";
import { format } from "date-fns";

type SortField = "voice_pct_change" | "data_pct_change";
type SortDirection = "asc" | "desc";

const prettyIndicator = (indicator: string): string => {
  if (indicator === "TotalVoiceTraffic_Erl") {
    return "Average Voice Traffic (Erl)";
  }
  if (indicator === "Total_Traffic_GB") {
    return "Average Data Traffic (GB)";
  }
  return indicator;
};

export default function RANExpansionPage() {
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const [regions, setRegions] = useState<string[]>([]);
  const [subregions, setSubregions] = useState<string[]>([]);
  const [region, setRegion] = useState<string | null>(null);
  const [subregion, setSubregion] = useState<string | null>(null);

  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  const [avgRows, setAvgRows] = useState<TrafficAvgRow[]>([]);
  const [gridRows, setGridRows] = useState<TrafficGridRow[]>([]);
  const [tsRows, setTsRows] = useState<TrafficTimeseriesRow[]>([]);
  const [siteCount, setSiteCount] = useState<number | null>(null);

  const [loadingFilters, setLoadingFilters] = useState<boolean>(false);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [sortField, setSortField] = useState<SortField>("voice_pct_change");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  /* ---------- helper to extract Supabase error text ---------- */
  const extractErrorMessage = (err: unknown): string => {
    if (!err) return "Unknown error";

    if (err instanceof Error && err.message) return err.message;

    if (typeof err === "object") {
      const anyErr = err as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      };
      if (anyErr.message) return anyErr.message;
      if (anyErr.details) return anyErr.details;
      if (anyErr.hint) return anyErr.hint;
      if (anyErr.code) return `Error code: ${anyErr.code}`;
    }
    return "Failed to load comparative data.";
  };

  /* ---------------- Initial load: projects + regions + default dates ---------------- */

  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        setLoadingFilters(true);
        setErrorMsg(null);

        const [projList, regionList] = await Promise.all([
          fetchRanProjects(),
          fetchRanRegions(),
        ]);

        console.log("fetchRanProjects →", projList);
        console.log("fetchRanRegions →", regionList);

        setProjects(projList);
        setRegions(regionList);
        setSelectedProjects(projList); // default = all projects

        const [minInt, maxRep] = await Promise.all([
          fetchEarliestIntegrationDate(projList),
          fetchLatestTrafficDate(projList),
        ]);

        console.log("Earliest Integration:", minInt);
        console.log("Latest Traffic Date:", maxRep);

        if (minInt) setStartDate(new Date(minInt));
        if (maxRep) setEndDate(new Date(maxRep));
      } catch (err) {
        console.error("init error", err);
        setErrorMsg(extractErrorMessage(err));
      } finally {
        setLoadingFilters(false);
      }
    };

    void init();
  }, []);

  /* ---------------- When Region changes → reload SubRegions ---------------- */

  useEffect(() => {
    const loadSubregions = async (): Promise<void> => {
      try {
        const list = await fetchRanSubregionsByRegion(region);
        console.log("Subregions for region", region, "→", list);
        setSubregions(list);
        setSubregion(null);
      } catch (err) {
        console.error("fetchRanSubregionsByRegion error", err);
      }
    };

    if (region) {
      void loadSubregions();
    } else {
      setSubregions([]);
      setSubregion(null);
    }
  }, [region]);

  /* ---------------- When Projects change → refresh date bounds ---------------- */

  useEffect(() => {
    const updateBounds = async (): Promise<void> => {
      try {
        const [minInt, maxRep] = await Promise.all([
          fetchEarliestIntegrationDate(selectedProjects),
          fetchLatestTrafficDate(selectedProjects),
        ]);

        console.log("Bounds for projects", selectedProjects, {
          minInt,
          maxRep,
        });

        if (minInt) setStartDate(new Date(minInt));
        if (maxRep) setEndDate(new Date(maxRep));
      } catch (err) {
        console.error("updateBounds error", err);
      }
    };

    if (selectedProjects.length > 0) {
      void updateBounds();
    }
  }, [selectedProjects]);

  /* ---------------- Handlers ---------------- */

  const toggleProject = (project: string): void => {
    setSelectedProjects((prev: string[]) =>
      prev.includes(project)
        ? prev.filter((p: string) => p !== project)
        : [...prev, project]
    );
  };

  const allProjectsSelected: boolean =
    projects.length > 0 && selectedProjects.length === projects.length;

  const toggleAllProjects = (): void => {
    if (allProjectsSelected) {
      setSelectedProjects([]);
    } else {
      setSelectedProjects(projects);
    }
  };

  const applyFilters = async (): Promise<void> => {
    if (!startDate || !endDate) {
      setErrorMsg("Please select both start and end dates.");
      return;
    }

    try {
      setLoadingData(true);
      setErrorMsg(null);

      const params = {
        projects: selectedProjects.length ? selectedProjects : null,
        region,
        subregion,
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
      };

      console.log("Apply filters params →", params);

      const [avg, grid, ts, siteCnt] = await Promise.all([
        fetchTrafficAverages(params),
        fetchTrafficGridComparison(params),
        fetchTrafficTimeseries(params),
        fetchRanSiteCount(params),
      ]);

      console.log("Averages →", avg);
      console.log("Grid comparison →", grid);
      console.log("Timeseries →", ts);
      console.log("Distinct site count →", siteCnt);

      setAvgRows(avg);
      setGridRows(grid);
      setTsRows(ts);
      setSiteCount(siteCnt);
    } catch (err) {
      console.error("applyFilters error", err);
      setErrorMsg(extractErrorMessage(err));
    } finally {
      setLoadingData(false);
    }
  };

  const sortedGridRows: TrafficGridRow[] = useMemo(() => {
    const dirFactor: number = sortDirection === "asc" ? 1 : -1;

    return [...gridRows].sort(
      (a: TrafficGridRow, b: TrafficGridRow): number => {
        const av: number | null =
          sortField === "voice_pct_change"
            ? a.voice_pct_change
            : a.data_pct_change;
        const bv: number | null =
          sortField === "voice_pct_change"
            ? b.voice_pct_change
            : b.data_pct_change;

        if (av === bv) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;

        return av > bv ? dirFactor : -dirFactor;
      }
    );
  }, [gridRows, sortField, sortDirection]);

  const dateLabel = (d?: Date): string =>
    d ? format(d, "dd-MMM-yyyy") : "Select date";

  /* ---------------- JSX ---------------- */

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-center mb-4 tracking-tight">
        RAN Expansion – Time-series Comparative Analysis
      </h1>

      {errorMsg && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 whitespace-pre-line">
          {errorMsg}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Projects */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="font-semibold">Projects (RANExpansion)</Label>
              <Button variant="outline" size="sm" onClick={toggleAllProjects}>
                {allProjectsSelected ? "Unselect All" : "Select All"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {projects.map((p: string) => (
                <label
                  key={p}
                  className="flex items-center space-x-2 border rounded-md px-2 py-1 text-xs md:text-sm cursor-pointer bg-muted/40"
                >
                  <Checkbox
                    checked={selectedProjects.includes(p)}
                    onCheckedChange={() => toggleProject(p)}
                  />
                  <span>{p}</span>
                </label>
              ))}

              {projects.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {loadingFilters
                    ? "Loading projects..."
                    : "No projects found in RANExpansion."}
                </p>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Earliest Integration Date */}
            <div className="space-y-2">
              <Label>Earliest Integration Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    {dateLabel(startDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Latest Traffic Report Date */}
            <div className="space-y-2">
              <Label>Latest Traffic Report Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    {dateLabel(endDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Region / SubRegion */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Region (SSL)</Label>
              <Select
                value={region ?? "ALL"}
                onValueChange={(val: string) =>
                  setRegion(val === "ALL" ? null : val)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Regions</SelectItem>
                  {regions.map((r: string) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>SubRegion (SSL)</Label>
              <Select
                value={subregion ?? "ALL"}
                disabled={!region}
                onValueChange={(val: string) =>
                  setSubregion(val === "ALL" ? null : val)
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      region ? "Select SubRegion" : "Select Region first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All SubRegions</SelectItem>
                  {subregions.map((s: string) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={applyFilters} disabled={loadingData}>
              {loadingData ? "Loading..." : "Apply Filters"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI row: Distinct sites + 2 averages (single row on md+) */}
      {(siteCount !== null || avgRows.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {siteCount !== null && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Distinct Sites (RANExpansion)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{siteCount}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on selected Projects, Region &amp; SubRegion
                </p>
              </CardContent>
            </Card>
          )}

          {avgRows.slice(0, 2).map((row: TrafficAvgRow) => (
            <Card key={row.indicator}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {prettyIndicator(row.indicator)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {row.avg_value != null ? row.avg_value.toFixed(2) : "—"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Grid-level comparison table */}
      <Card>
        <CardHeader>
          <CardTitle>Grid-level Voice &amp; Data Comparison</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 overflow-x-auto">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">Sort by:</span>
            <Select
              value={sortField}
              onValueChange={(val: string) => setSortField(val as SortField)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="voice_pct_change">Voice % change</SelectItem>
                <SelectItem value="data_pct_change">Data % change</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setSortDirection((prev: SortDirection) =>
                  prev === "asc" ? "desc" : "asc"
                )
              }
            >
              {sortDirection === "asc" ? "Ascending" : "Descending"}
            </Button>
          </div>

          <table className="w-full text-xs md:text-sm border-collapse">
            <thead>
              <tr className="bg-muted">
                <th className="border px-2 py-1 text-left">Grid</th>
                <th className="border px-2 py-1 text-right">Site count</th>
                <th className="border px-2 py-1">Earliest Date</th>
                <th className="border px-2 py-1">Latest Date</th>

                <th className="border px-2 py-1">Voice earliest (Erl)</th>
                <th className="border px-2 py-1">Voice latest (Erl)</th>
                <th className="border px-2 py-1">Voice % change</th>

                <th className="border px-2 py-1">Data earliest (GB)</th>
                <th className="border px-2 py-1">Data latest (GB)</th>
                <th className="border px-2 py-1">Data % change</th>
              </tr>
            </thead>
            <tbody>
              {sortedGridRows.map((row: TrafficGridRow, idx: number) => (
                <tr
                  key={
                    row.Grid ?? `${row.earliest_date}-${row.latest_date}-${idx}`
                  }
                  className="hover:bg-muted/50"
                >
                  <td className="border px-2 py-1">{row.Grid ?? "—"}</td>
                  <td className="border px-2 py-1 text-right">
                    {row.site_count != null ? row.site_count : "—"}
                  </td>
                  <td className="border px-2 py-1 text-center">
                    {row.earliest_date ?? "—"}
                  </td>
                  <td className="border px-2 py-1 text-center">
                    {row.latest_date ?? "—"}
                  </td>

                  <td className="border px-2 py-1 text-right">
                    {row.voice_earliest != null
                      ? row.voice_earliest.toFixed(2)
                      : "—"}
                  </td>
                  <td className="border px-2 py-1 text-right">
                    {row.voice_latest != null
                      ? row.voice_latest.toFixed(2)
                      : "—"}
                  </td>
                  <td
                    className={cn(
                      "border px-2 py-1 text-right",
                      row.voice_pct_change != null && row.voice_pct_change > 0
                        ? "bg-emerald-50 text-emerald-700"
                        : row.voice_pct_change != null &&
                          row.voice_pct_change < 0
                        ? "bg-rose-50 text-rose-700"
                        : ""
                    )}
                  >
                    {row.voice_pct_change != null
                      ? `${row.voice_pct_change.toFixed(1)}%`
                      : "—"}
                  </td>

                  <td className="border px-2 py-1 text-right">
                    {row.data_earliest != null
                      ? row.data_earliest.toFixed(2)
                      : "—"}
                  </td>
                  <td className="border px-2 py-1 text-right">
                    {row.data_latest != null ? row.data_latest.toFixed(2) : "—"}
                  </td>
                  <td
                    className={cn(
                      "border px-2 py-1 text-right",
                      row.data_pct_change != null && row.data_pct_change > 0
                        ? "bg-emerald-50 text-emerald-700"
                        : row.data_pct_change != null && row.data_pct_change < 0
                        ? "bg-rose-50 text-rose-700"
                        : ""
                    )}
                  >
                    {row.data_pct_change != null
                      ? `${row.data_pct_change.toFixed(1)}%`
                      : "—"}
                  </td>
                </tr>
              ))}

              {sortedGridRows.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="border px-2 py-4 text-center text-muted-foreground"
                  >
                    No Grid-level data. Adjust filters and click &ldquo;Apply
                    Filters&rdquo;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Time-series charts */}
      {tsRows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Voice traffic */}
          <Card>
            <CardHeader>
              <CardTitle>Time-series – TotalVoiceTraffic_Erl</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tsRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dt" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="TotalVoiceTraffic_Erl"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Data traffic */}
          <Card>
            <CardHeader>
              <CardTitle>Time-series – Total_Traffic_GB</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tsRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dt" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="Total_Traffic_GB"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// app/Utilization/page.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import {
  fetchSubregions,
  fetchAreaCounts,
  fetchHuTimeseries,
  type AreaRow,
  type TsRow,
  type AreaLevel,
} from "@/app/lib/rpc/cu"; // If your RPC file is different, adjust this path.

const ALL = "All";
const DEBUG_TS = true;

/* ---------- tiny helpers ---------- */
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const friendly = (n: number | null | undefined, d = 2) =>
  typeof n === "number" ? n.toFixed(d) : "—";

/** Build a left-to-right gradient proportional to column max. */
function gradientStyle(value: number, max: number, hue = 220) {
  const safeMax = max <= 0 ? 1 : max;
  const pct = Math.min(100, Math.max(0, (value / safeMax) * 100));
  const fill = `hsl(${hue} 90% 56% / 0.14)`;
  return {
    backgroundImage: `linear-gradient(to right, ${fill} 0%, ${fill} ${pct}%, transparent ${pct}%)`,
  } as React.CSSProperties;
}

/** Sorting helper */
type SortKey = "area" | "hu_cells" | "hu_sites" | "lu_cells" | "lu_sites";
type SortDir = "asc" | "desc";
function sortRows(rows: AreaRow[], key: SortKey, dir: SortDir): AreaRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const av = key === "area" ? a.area ?? "" : (a as any)[key] ?? 0;
    const bv = key === "area" ? b.area ?? "" : (b as any)[key] ?? 0;
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    return 0;
  });
  return copy;
}

/* ---------- Color tokens (Tailwind palette) ---------- */
const GREEN_FILL = "#22c55e"; // green-500
const PINK_FILL = "#ec4899"; // pink-500
const PURPLE_FILL = "#a855f7"; // purple-500

export default function UtilizationPage() {
  /* ---------- Filters ---------- */
  const [subregions, setSubregions] = useState<string[]>([]);
  const [subregion, setSubregion] = useState<string>(ALL);
  const [level, setLevel] = useState<AreaLevel>("DISTRICT");

  /* ---------- Data ---------- */
  const [areaRows, setAreaRows] = useState<AreaRow[]>([]);
  const [tsRows, setTsRows] = useState<TsRow[]>([]);
  const [loading, setLoading] = useState(false);

  /* ---------- Sorting ---------- */
  const [sortKey, setSortKey] = useState<SortKey>("hu_cells");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const toggleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey]
  );

  /* ---------- Load picklist ---------- */
  useEffect(() => {
    (async () => {
      try {
        const subs = await fetchSubregions();
        setSubregions(subs);
      } catch (e) {
        console.error("fetchSubregions error:", e);
      }
    })();
  }, []);

  /* ---------- Fetch data ---------- */
  const run = async () => {
    setLoading(true);
    try {
      const scope = {
        subregion: subregion === ALL ? null : subregion,
        dateFrom: null,
        dateTo: null,
      };

      const [areas, ts] = await Promise.all([
        fetchAreaCounts(level, scope),
        fetchHuTimeseries(scope),
      ]);

      setAreaRows(areas.filter((x) => x.area));
      setTsRows(ts);

      // ---------- DEBUG ----------
      if (DEBUG_TS) {
        console.groupCollapsed(
          `%c[TS] scope: ${scope.subregion ?? "All"} | level: ${level}`,
          "color:#2563eb;font-weight:600"
        );
        console.log("rows count:", ts.length);
        if (ts.length) {
          console.log("first row:", ts[0]);
          console.log("last row:", ts.at(-1));
          console.log("types:", {
            avgdl_tp: typeof ts[0].avgdl_tp,
            prb_dl: typeof ts[0].prb_dl,
            avgrrc: typeof ts[0].avgrrc,
          });
          console.table(ts.slice(Math.max(0, ts.length - 10)));
        }
        console.groupEnd();
      }
    } finally {
      setLoading(false);
    }
  };

  // initial & on level change
  useEffect(() => {
    if (DEBUG_TS) console.log(`[TS] Level changed -> ${level}`);
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  // re-fetch & log on subregion change, too
  useEffect(() => {
    if (DEBUG_TS) console.log(`[TS] SubRegion changed -> ${subregion}`);
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subregion]);

  // log any updates to tsRows
  useEffect(() => {
    if (DEBUG_TS) {
      console.log(
        `[TS] tsRows updated -> count=${tsRows.length}`,
        tsRows.length ? { first: tsRows[0], last: tsRows.at(-1) } : null
      );
    }
  }, [tsRows]);

  /* ---------- Derived ---------- */
  const recordCount = areaRows.length;

  // column maximums for heat background
  const maxHuCells = useMemo(
    () => areaRows.reduce((m, r) => Math.max(m, num(r.hu_cells)), 0),
    [areaRows]
  );
  const maxHuSites = useMemo(
    () => areaRows.reduce((m, r) => Math.max(m, num(r.hu_sites)), 0),
    [areaRows]
  );
  const maxLuCells = useMemo(
    () => areaRows.reduce((m, r) => Math.max(m, num(r.lu_cells)), 0),
    [areaRows]
  );
  const maxLuSites = useMemo(
    () => areaRows.reduce((m, r) => Math.max(m, num(r.lu_sites)), 0),
    [areaRows]
  );

  // Sorted view
  const rowsSorted = useMemo(
    () => sortRows(areaRows, sortKey, sortDir),
    [areaRows, sortKey, sortDir]
  );

  // bar chart titles based on latest point
  const lastTs = tsRows.length ? tsRows[tsRows.length - 1] : null;
  const titleDL = `Avg DL_TP — latest: ${friendly(lastTs?.avgdl_tp)}`;
  const titlePRB = `PRB_DL — latest: ${friendly(lastTs?.prb_dl)}`;
  const titleRRC = `Avg RRC — latest: ${friendly(lastTs?.avgrrc)}`;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">
        Cell Utilization — District/Grid & Averages
      </h1>

      {/* Filters */}
      <Card className="p-4 grid grid-cols-1 md:grid-cols-5 gap-4 items-end bg-purple-50 border-purple-200">
        <div>
          <label className="text-sm text-purple-900">Level</label>
          <Select value={level} onValueChange={(v) => setLevel(v as AreaLevel)}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DISTRICT">District</SelectItem>
              <SelectItem value="GRID">Grid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm text-purple-900">SubRegion</label>
          <Select value={subregion} onValueChange={setSubregion}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select SubRegion" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{ALL}</SelectItem>
              {subregions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-1">
          <Button
            className="w-full"
            onClick={run}
            disabled={loading}
            variant="default"
          >
            {loading ? "Loading…" : "Apply"}
          </Button>
        </div>
      </Card>

      {/* KPI strip (colored cards) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="text-sm text-green-900">HU Cells</div>
          <div className="text-2xl font-semibold text-green-900">
            {areaRows.reduce((s, r) => s + num(r.hu_cells), 0).toLocaleString()}
          </div>
        </Card>
        <Card className="p-4 bg-pink-50 border-pink-200">
          <div className="text-sm text-pink-900">HU Sites</div>
          <div className="text-2xl font-semibold text-pink-900">
            {areaRows.reduce((s, r) => s + num(r.hu_sites), 0).toLocaleString()}
          </div>
        </Card>
        <Card className="p-4 bg-purple-50 border-purple-200">
          <div className="text-sm text-purple-900">Low Cells</div>
          <div className="text-2xl font-semibold text-purple-900">
            {areaRows.reduce((s, r) => s + num(r.lu_cells), 0).toLocaleString()}
          </div>
        </Card>
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="text-sm text-green-900">Low Sites</div>
          <div className="text-2xl font-semibold text-green-900">
            {areaRows.reduce((s, r) => s + num(r.lu_sites), 0).toLocaleString()}
          </div>
        </Card>
      </div>

      {/* BAR CHARTS (distinct colors) */}
      <Card className="p-4 bg-green-50 border-green-200">
        <div className="text-base font-medium mb-2 text-green-900">
          {titleDL}
        </div>
        {tsRows.length === 0 ? (
          <div className="h-24 grid place-items-center text-sm text-green-900/70">
            No data in selected scope.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={tsRows}
                margin={{ top: 10, right: 18, left: 12, bottom: 18 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="d" />
                <YAxis
                  tickFormatter={(v) =>
                    typeof v === "number" ? v.toFixed(2) : ""
                  }
                />
                <Tooltip
                  formatter={(v) =>
                    typeof v === "number" ? v.toFixed(2) : (v as any)
                  }
                />
                <Legend />
                <Bar
                  dataKey="avgdl_tp"
                  name="Avg DL_TP"
                  fill={GREEN_FILL}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="p-4 bg-pink-50 border-pink-200">
        <div className="text-base font-medium mb-2 text-pink-900">
          {titlePRB}
        </div>
        {tsRows.length === 0 ? (
          <div className="h-24 grid place-items-center text-sm text-pink-900/70">
            No data in selected scope.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={tsRows}
                margin={{ top: 10, right: 18, left: 12, bottom: 18 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="d" />
                <YAxis
                  tickFormatter={(v) =>
                    typeof v === "number" ? v.toFixed(2) : ""
                  }
                />
                <Tooltip
                  formatter={(v) =>
                    typeof v === "number" ? v.toFixed(2) : (v as any)
                  }
                />
                <Legend />
                <Bar
                  dataKey="prb_dl"
                  name="PRB_DL"
                  fill={PINK_FILL}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="p-4 bg-purple-50 border-purple-200">
        <div className="text-base font-medium mb-2 text-purple-900">
          {titleRRC}
        </div>
        {tsRows.length === 0 ? (
          <div className="h-24 grid place-items-center text-sm text-purple-900/70">
            No data in selected scope.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={tsRows}
                margin={{ top: 10, right: 18, left: 12, bottom: 18 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="d" />
                <YAxis
                  tickFormatter={(v) =>
                    typeof v === "number" ? v.toFixed(2) : ""
                  }
                />
                <Tooltip
                  formatter={(v) =>
                    typeof v === "number" ? v.toFixed(2) : (v as any)
                  }
                />
                <Legend />
                <Bar
                  dataKey="avgrrc"
                  name="Avg RRC"
                  fill={PURPLE_FILL}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Area table */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-muted-foreground">
            Records:{" "}
            <span className="font-medium">{recordCount.toLocaleString()}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Click headers to sort {sortDir === "asc" ? "▲" : "▼"}
          </div>
        </div>

        <div className="overflow-y-auto max-h-[440px] rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b">
              <tr className="text-left">
                <th
                  className="py-2 px-3 cursor-pointer select-none"
                  onClick={() => toggleSort("area")}
                >
                  {level === "DISTRICT" ? "District" : "Grid"}{" "}
                  {sortKey === "area" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>
                <th
                  className="py-2 px-3 cursor-pointer select-none"
                  onClick={() => toggleSort("hu_cells")}
                >
                  HU Cells{" "}
                  {sortKey === "hu_cells"
                    ? sortDir === "asc"
                      ? "▲"
                      : "▼"
                    : ""}
                </th>
                <th
                  className="py-2 px-3 cursor-pointer select-none"
                  onClick={() => toggleSort("hu_sites")}
                >
                  HU Sites{" "}
                  {sortKey === "hu_sites"
                    ? sortDir === "asc"
                      ? "▲"
                      : "▼"
                    : ""}
                </th>
                <th
                  className="py-2 px-3 cursor-pointer select-none"
                  onClick={() => toggleSort("lu_cells")}
                >
                  Low Cells{" "}
                  {sortKey === "lu_cells"
                    ? sortDir === "asc"
                      ? "▲"
                      : "▼"
                    : ""}
                </th>
                <th
                  className="py-2 px-3 cursor-pointer select-none"
                  onClick={() => toggleSort("lu_sites")}
                >
                  Low Sites{" "}
                  {sortKey === "lu_sites"
                    ? sortDir === "asc"
                      ? "▲"
                      : "▼"
                    : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {rowsSorted.map((r) => (
                <tr key={r.area!} className="border-b hover:bg-muted/40">
                  <td className="py-2 px-3 font-medium">{r.area}</td>
                  <td
                    className="py-2 px-3"
                    style={gradientStyle(num(r.hu_cells), maxHuCells)}
                  >
                    {r.hu_cells?.toLocaleString?.() ?? "—"}
                  </td>
                  <td
                    className="py-2 px-3"
                    style={gradientStyle(num(r.hu_sites), maxHuSites)}
                  >
                    {r.hu_sites?.toLocaleString?.() ?? "—"}
                  </td>
                  <td
                    className="py-2 px-3"
                    style={gradientStyle(
                      num(r.lu_cells),
                      maxLuCells,
                      12 /* orange hue */
                    )}
                  >
                    {r.lu_cells?.toLocaleString?.() ?? "—"}
                  </td>
                  <td
                    className="py-2 px-3"
                    style={gradientStyle(num(r.lu_sites), maxLuSites, 12)}
                  >
                    {r.lu_sites?.toLocaleString?.() ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

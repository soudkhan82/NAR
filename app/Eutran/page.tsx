// app/Eutran/page.tsx
"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";

/* ---------------- Local types (mirror your RPC return shapes) ---------------- */
type FilterState = { subRegion?: string | null };
type SummaryRow = {
  total_cells: number | null;
  avg_avgdl_tp: number | null;
  avg_prb_dl: number | null;
  avg_avgrrc: number | null;
};
type HourPoint = {
  t: string;
  avgdl_tp?: number | null;
  prb_dl?: number | null;
  avgrrc?: number | null;
};
type GridDaily = { grid: string; d: string; cells: number };
type DistrictDaily = { district: string; d: string; cells: number };

/* --------- Dynamic RPC loader (prevents env access during prerender) --------- */
type RpcModule = {
  fetchSubRegions: () => Promise<string[]>;
  fetchSummaryWindow: (f: FilterState, days: number) => Promise<SummaryRow>;
  fetchTimeseriesHourlyWindow: (
    f: FilterState,
    days: number
  ) => Promise<HourPoint[]>;
  fetchTop5GridDailyWindow: (
    f: FilterState,
    days: number
  ) => Promise<GridDaily[]>;
  fetchTop5DistrictDailyWindow: (
    f: FilterState,
    days: number
  ) => Promise<DistrictDaily[]>;
};

async function loadRpc(): Promise<RpcModule> {
  // Import only on the client, at runtime
  const mod = await import("@/app/lib/rpc/eutranHu");
  return {
    fetchSubRegions: mod.fetchSubRegions,
    fetchSummaryWindow: mod.fetchSummaryWindow,
    fetchTimeseriesHourlyWindow: mod.fetchTimeseriesHourlyWindow,
    fetchTop5GridDailyWindow: mod.fetchTop5GridDailyWindow,
    fetchTop5DistrictDailyWindow: mod.fetchTop5DistrictDailyWindow,
  };
}

/* ---------------------- Tiny hour tick formatting helper --------------------- */
function fmtHour(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d
    .toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(", ", " ");
}

const palette = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#7c3aed"];

export default function Page() {
  // Defaults: North-1, 7 days
  const [filters, setFilters] = useState<FilterState>({ subRegion: "North-1" });
  const [days, setDays] = useState<number>(7);

  const [subRegions, setSubRegions] = useState<string[]>(["North-1"]);
  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [hourly, setHourly] = useState<HourPoint[]>([]);
  const [gridRows, setGridRows] = useState<GridDaily[]>([]);
  const [districtRows, setDistrictRows] = useState<DistrictDaily[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Cache the loaded RPC module so we import only once
  const rpcRef = useRef<RpcModule | null>(null);
  const getRpc = async () => {
    if (!rpcRef.current) rpcRef.current = await loadRpc();
    return rpcRef.current;
  };

  useEffect(() => {
    (async () => {
      try {
        const rpc = await getRpc();
        setSubRegions(await rpc.fetchSubRegions());
      } catch {
        // ignore subregion init error; page still usable
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAll = async (f: FilterState, d: number) => {
    setLoading(true);
    setErr(null);
    try {
      const rpc = await getRpc();
      const [s, h, g, di] = await Promise.all([
        rpc.fetchSummaryWindow(f, d),
        rpc.fetchTimeseriesHourlyWindow(f, d),
        rpc.fetchTop5GridDailyWindow(f, d),
        rpc.fetchTop5DistrictDailyWindow(f, d),
      ]);
      setSummary(s);
      setHourly(h);
      setGridRows(g);
      setDistrictRows(di);
    } catch (e) {
      console.error("[EUTRAN] load error", e);
      setErr("Failed to load data");
      setSummary(null);
      setHourly([]);
      setGridRows([]);
      setDistrictRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll(filters, days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // initial

  const onChangeSubRegion = (subRegion: string) => {
    const f = { ...filters, subRegion };
    setFilters(f);
    void loadAll(f, days);
  };

  const onLoadMore = () => {
    const next = days === 7 ? 14 : days === 14 ? 30 : 30;
    setDays(next);
    void loadAll(filters, next);
  };

  // distinct grid / district labels (already top-5 pre-filtered by SQL)
  const gridLabels = useMemo(
    () => Array.from(new Set(gridRows.map((r) => r.grid))),
    [gridRows]
  );
  const districtLabels = useMemo(
    () => Array.from(new Set(districtRows.map((r) => r.district))),
    [districtRows]
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            EUTRAN — KPIs & Distinct Cells (Windowed)
          </h1>
          <p className="text-sm text-muted-foreground">
            Default SubRegion: North-1. Windowed 7/14/30 days to keep things
            fast.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void loadAll(filters, days)}
          disabled={loading}
          className="gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Refresh
        </Button>
      </div>

      {/* Controls */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4">
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">SubRegion</Label>
              <select
                className="h-9 border rounded-md px-2 bg-white"
                value={filters.subRegion ?? "North-1"}
                onChange={(e) => onChangeSubRegion(e.target.value)}
                disabled={loading}
              >
                {subRegions.map((sr) => (
                  <option key={sr} value={sr}>
                    {sr}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="outline"
              onClick={onLoadMore}
              disabled={loading || days === 30}
            >
              {days === 7
                ? "Load 14 days"
                : days === 14
                ? "Load 30 days"
                : "Max 30 days"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <KPI
          label={`Distinct EUtranCellFDD (last ${days}d)`}
          value={summary?.total_cells ?? 0}
          bgClass="bg-amber-50"
        />
        <KPI
          label="AvgDL_TP (avg)"
          value={summary?.avg_avgdl_tp ?? null}
          suffix=" Mbps"
          bgClass="bg-rose-50"
        />
        <KPI
          label="PRB_DL (avg)"
          value={summary?.avg_prb_dl ?? null}
          suffix=" %"
          bgClass="bg-sky-50"
        />
        <KPI
          label="AvgRRC (avg)"
          value={summary?.avg_avgrrc ?? null}
          bgClass="bg-emerald-50"
        />
      </div>

      {/* Three hourly charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard
          title={`AvgDL_TP — Hourly (last ${days}d)`}
          loading={loading}
        >
          <SeriesHour data={hourly} yKey="avgdl_tp" />
        </ChartCard>
        <ChartCard title={`PRB_DL — Hourly (last ${days}d)`} loading={loading}>
          <SeriesHour data={hourly} yKey="prb_dl" />
        </ChartCard>
        <ChartCard title={`AvgRRC — Hourly (last ${days}d)`} loading={loading}>
          <SeriesHour data={hourly} yKey="avgrrc" />
        </ChartCard>
      </div>

      {/* Separate bar charts — Top-5 Grids */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4">
          <h2 className="text-sm font-medium mb-3">
            Distinct EUtranCellFDD per Day — Top-5 Grids
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4">
            {gridLabels.map((g, i) => (
              <SingleBar
                key={g}
                title={`Grid: ${g}`}
                color={palette[i % palette.length]}
                data={gridRows.filter((r) => r.grid === g)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Separate bar charts — Top-5 Districts */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4">
          <h2 className="text-sm font-medium mb-3">
            Distinct EUtranCellFDD per Day — Top-5 Districts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4">
            {districtLabels.map((d, i) => (
              <SingleBar
                key={d}
                title={`District: ${d}`}
                color={palette[i % palette.length]}
                data={districtRows.filter((r) => r.district === d)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* --- UI bits (no computations) --- */

function KPI({
  label,
  value,
  suffix,
  bgClass,
}: {
  label: string;
  value: number | null;
  suffix?: string;
  bgClass?: string;
}) {
  const text =
    value == null
      ? "—"
      : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return (
    <Card className={`border-0 shadow-sm ${bgClass ?? "bg-gray-50"}`}>
      <CardContent className="pt-4">
        <div className="text-xs text-gray-600">{label}</div>
        <div className="text-xl font-semibold">
          {text}
          {suffix ?? ""}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  loading,
  children,
}: {
  title: string;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium">{title}</h2>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : null}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function SeriesHour({
  data,
  yKey,
}: {
  data: { t: string }[];
  yKey: "avgdl_tp" | "prb_dl" | "avgrrc";
}) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
        >
          <XAxis dataKey="t" tick={{ fontSize: 11 }} tickFormatter={fmtHour} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip labelFormatter={(v) => fmtHour(String(v))} />
          <Legend />
          <Line type="monotone" dataKey={yKey} dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SingleBar({
  title,
  color,
  data,
}: {
  title: string;
  color: string;
  data: { d: string; cells: number }[];
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-4">
        <div className="text-sm font-medium mb-3">{title}</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[...data].sort((a, b) => (a.d < b.d ? -1 : 1))}
              margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
            >
              <XAxis dataKey="d" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="cells" fill={color} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// app/eas/page.tsx
"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";

/* ---------- Local types mirroring RPC return shapes (nullable where needed) ---------- */
type StatusSummaryRow = {
  total_sites: number;
  ok_sites: number;
  nok_sites: number;
};

type NokTimeseriesRow = {
  report_date: string; // ISO date (yyyy-mm-dd)
  nok_sites: number;
};

type WeeklyNokRow = {
  week_start: string; // ISO date of week start
  nok_sites: number; // distinct NOK sites for that week
};

type DistrictTotalRow = {
  district: string | null; // <-- nullable to match RPC
  total_nok: number;
};

type GridTotalRow = {
  grid: string | null; // <-- nullable to match RPC
  total_nok: number;
};

/* ------------------- Dynamic RPC loader (import at runtime only) ------------------- */
type RpcModule = {
  fetchSubregions: () => Promise<string[]>;
  fetchSummaryOkNok: (
    from: string,
    to: string,
    subregion?: string | null
  ) => Promise<StatusSummaryRow>;
  fetchTimeseriesNok: (
    from: string,
    to: string,
    subregion?: string | null
  ) => Promise<NokTimeseriesRow[]>;
  fetchWeeklyNok: (
    from: string,
    to: string,
    subregion?: string | null
  ) => Promise<WeeklyNokRow[]>;
  fetchNokByDistrictTotal: (
    from: string,
    to: string,
    subregion?: string | null
  ) => Promise<DistrictTotalRow[]>;
  fetchNokByGridTotal: (
    from: string,
    to: string,
    subregion?: string | null
  ) => Promise<GridTotalRow[]>;
};

async function loadRpc(): Promise<RpcModule> {
  const mod = await import("@/app/lib/rpc/eas");
  return {
    fetchSubregions: mod.fetchSubregions,
    fetchSummaryOkNok: mod.fetchSummaryOkNok,
    fetchTimeseriesNok: mod.fetchTimeseriesNok,
    fetchWeeklyNok: mod.fetchWeeklyNok,
    fetchNokByDistrictTotal: mod.fetchNokByDistrictTotal,
    fetchNokByGridTotal: mod.fetchNokByGridTotal,
  };
}

/* --------------------------------- Helpers --------------------------------- */
const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = new Date();
const thirtyDaysAgo = new Date(Date.now() - 29 * 24 * 3600 * 1000);

export default function EASPage() {
  const [from, setFrom] = useState(iso(thirtyDaysAgo));
  const [to, setTo] = useState(iso(today));

  const [subregions, setSubregions] = useState<string[]>([]);
  const [subregion, setSubregion] = useState<string | null>(null);

  const [summary, setSummary] = useState<StatusSummaryRow | null>(null);
  const [tsNok, setTsNok] = useState<NokTimeseriesRow[]>([]);
  const [weeklyNok, setWeeklyNok] = useState<WeeklyNokRow[]>([]);
  const [districtTotals, setDistrictTotals] = useState<DistrictTotalRow[]>([]);
  const [gridTotals, setGridTotals] = useState<GridTotalRow[]>([]);
  const [loading, setLoading] = useState(false);

  const rpcRef = useRef<RpcModule | null>(null);
  const getRpc = async () => {
    if (!rpcRef.current) rpcRef.current = await loadRpc();
    return rpcRef.current;
  };

  useEffect(() => {
    (async () => {
      try {
        const rpc = await getRpc();
        const srs = await rpc.fetchSubregions();
        setSubregions(srs);
        if (srs.length === 1) setSubregion(srs[0]);
      } catch {
        // ignore — page still usable
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const rpc = await getRpc();
      const [sum, ts, wk, dTot, gTot] = await Promise.all([
        rpc.fetchSummaryOkNok(from, to, subregion ?? undefined),
        rpc.fetchTimeseriesNok(from, to, subregion ?? undefined),
        rpc.fetchWeeklyNok(from, to, subregion ?? undefined),
        rpc.fetchNokByDistrictTotal(from, to, subregion ?? undefined),
        rpc.fetchNokByGridTotal(from, to, subregion ?? undefined),
      ]);
      setSummary(sum);
      setTsNok(ts);
      setWeeklyNok(wk);
      setDistrictTotals(dTot);
      setGridTotals(gTot);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(); // initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nok / Total × 100
  const faultRatio = useMemo(() => {
    const total = summary?.total_sites ?? 0;
    const nok = summary?.nok_sites ?? 0;
    return total ? (nok / total) * 100 : 0;
  }, [summary]);

  // Derived, label-safe arrays for charts (coalesce nulls to "UNKNOWN")
  const districtBars = useMemo(
    () =>
      districtTotals.map((r) => ({
        districtLabel: r.district ?? "UNKNOWN",
        total_nok: r.total_nok,
      })),
    [districtTotals]
  );

  const gridBars = useMemo(
    () =>
      gridTotals.map((r) => ({
        gridLabel: r.grid ?? "UNKNOWN",
        total_nok: r.total_nok,
      })),
    [gridTotals]
  );

  return (
    <div className="p-4 space-y-4">
      {/* Filters */}
      <Card className="p-3">
        <div className="grid md:grid-cols-6 gap-3">
          <div className="flex flex-col">
            <label className="text-xs mb-1">From</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs mb-1">To</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs mb-1">SubRegion</label>
            <Select
              value={subregion ?? "__ALL__"}
              onValueChange={(v) => setSubregion(v === "__ALL__" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All SubRegions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">All SubRegions</SelectItem>
                {subregions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={load} disabled={loading}>
              {loading ? "Loading..." : "Apply"}
            </Button>
          </div>
          <div className="flex items-end">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setFrom(iso(thirtyDaysAgo));
                setTo(iso(today));
                setSubregion(subregions.length === 1 ? subregions[0] : null);
                void load();
              }}
            >
              Last 30 days
            </Button>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs opacity-70">Total Distinct SiteName</div>
          <div className="text-2xl font-semibold">
            {summary?.total_sites ?? 0}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs opacity-70">Distinct SiteName (Nok)</div>
          <div className="text-2xl font-semibold text-red-600">
            {summary?.nok_sites ?? 0}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs opacity-70">Distinct SiteName (Ok)</div>
          <div className="text-2xl font-semibold text-emerald-600">
            {summary?.ok_sites ?? 0}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs opacity-70">
            EAS Fault Ratio (Nok / Total × 100)
          </div>
          <div className="text-2xl font-semibold">
            {Math.round((faultRatio + Number.EPSILON) * 100) / 100}%
          </div>
        </Card>
      </div>

      {/* Row 1: Area chart (daily) + Weekly bar chart */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-3">
          <div className="text-sm font-semibold mb-2">
            Daily Distinct NOK Sites (Time Series)
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={tsNok}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="report_date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="nok_sites"
                name="NOK Sites"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-3">
          <div className="text-sm font-semibold mb-2">
            Weekly Distinct NOK Sites
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={weeklyNok}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week_start" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="nok_sites" name="Distinct NOK (Week)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Row 2: Districts + Grids (TOTAL DISTINCT NOK over the window) */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-3">
          <div className="text-sm font-semibold mb-2">
            Top 5 Districts — Total Distinct NOK (Window)
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={districtBars}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="districtLabel" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total_nok" name="Total Distinct NOK" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-3">
          <div className="text-sm font-semibold mb-2">
            Grids — Total Distinct NOK (Window){" "}
            {subregion ? `— ${subregion}` : ""}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={gridBars}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="gridLabel"
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-40}
                height={80}
              />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total_nok" name="Total Distinct NOK" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

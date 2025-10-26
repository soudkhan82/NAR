// app/eas/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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
  fetchSubregions,
  fetchSummaryOkNok,
  fetchTimeseriesNok,
  fetchNokByDistrictTotal,
  fetchNokByGridTotal,
  fetchWeeklyNok,
  type StatusSummaryRow,
  type NokTimeseriesRow,
  type DistrictTotalRow,
  type GridTotalRow,
  type WeeklyNokRow,
} from "@/app/lib/rpc/eas";

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

  useEffect(() => {
    (async () => {
      const srs = await fetchSubregions();
      setSubregions(srs);
      if (srs.length === 1) setSubregion(srs[0]);
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [sum, ts, wk, dTot, gTot] = await Promise.all([
        fetchSummaryOkNok(from, to, subregion),
        fetchTimeseriesNok(from, to, subregion),
        fetchWeeklyNok(from, to, subregion), // NEW: weekly distinct NOK sites
        fetchNokByDistrictTotal(from, to, subregion),
        fetchNokByGridTotal(from, to, subregion),
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
    load(); // initial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nok / Total × 100
  const faultRatio = useMemo(() => {
    const total = summary?.total_sites ?? 0;
    const nok = summary?.nok_sites ?? 0;
    return total ? (nok / total) * 100 : 0;
  }, [summary]);

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
                load();
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

      {/* Row 1: Area chart (daily) + Weekly bar chart (weekly distinct) */}
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
            <BarChart data={districtTotals}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="district" />
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
            <BarChart data={gridTotals}>
              <CartesianGrid strokeDasharray="3 3" />
              {/* Smaller font + angled labels for readability */}
              <XAxis
                dataKey="grid"
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

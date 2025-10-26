// app/traffic/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import supabase from "@/app/config/supabase-config";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

/* ----------------------------- Types ----------------------------- */

type TrafficDailyRow = {
  date: string;          // "YYYY-MM-DD"
  voice_erl: number | null;
  total_gb: number | null;
  // (keeping other metrics optional for later extension)
  voice_2g?: number | null;
  voice_3g?: number | null;
  volte_voice?: number | null;
  data_2g_gb?: number | null;
  data_3g_gb?: number | null;
  data_4g_gb?: number | null;
};

type LatestGridRow = {
  grid: string | null;
  latest_date: string | null;
  total_gb: number | null;
  voice_erl: number | null;
};

type LatestDistrictRow = {
  district: string | null;
  latest_date: string | null;
  total_gb: number | null;
  voice_erl: number | null;
};

type LatestAggRow = {
  key: string;        // grid or district
  latest_date: string;
  total_gb: number;
  voice_erl: number;
};

type SortKey = "total_gb" | "voice_erl";
type SortDir = "asc" | "desc";

/* ------------------------ Number formatters ----------------------- */
/* Standardize everything to 2 decimals */
const nf2 = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/* Recharts helpers */
const yTickFmt = (v: number) => nf2.format(Number(v));
const tipFmt = (v: unknown) => nf2.format(Number(v));
const tipLabelFmt = (label: string) => label;

/* ------------------------- Helper mappers ------------------------- */

function toDailySeries(arr: unknown[]): TrafficDailyRow[] {
  const out: TrafficDailyRow[] = [];
  for (const x of arr) {
    const r = x as Partial<TrafficDailyRow>;
    out.push({
      date: String(r.date ?? "").slice(0, 10),
      voice_erl: r.voice_erl ?? 0,
      total_gb: r.total_gb ?? 0,
      voice_2g: r.voice_2g ?? 0,
      voice_3g: r.voice_3g ?? 0,
      volte_voice: r.volte_voice ?? 0,
      data_2g_gb: r.data_2g_gb ?? 0,
      data_3g_gb: r.data_3g_gb ?? 0,
      data_4g_gb: r.data_4g_gb ?? 0,
    });
  }
  return out;
}

function mapLatestGrid(arr: unknown[]): LatestAggRow[] {
  const out: LatestAggRow[] = [];
  for (const x of arr) {
    const r = x as Partial<LatestGridRow>;
    out.push({
      key: String(r.grid ?? "UNKNOWN"),
      latest_date: String(r.latest_date ?? "").slice(0, 10),
      total_gb: Number(r.total_gb ?? 0),
      voice_erl: Number(r.voice_erl ?? 0),
    });
  }
  return out;
}

function mapLatestDistrict(arr: unknown[]): LatestAggRow[] {
  const out: LatestAggRow[] = [];
  for (const x of arr) {
    const r = x as Partial<LatestDistrictRow>;
    out.push({
      key: String(r.district ?? "UNKNOWN"),
      latest_date: String(r.latest_date ?? "").slice(0, 10),
      total_gb: Number(r.total_gb ?? 0),
      voice_erl: Number(r.voice_erl ?? 0),
    });
  }
  return out;
}

function sortLatest(rows: LatestAggRow[], key: SortKey, dir: SortDir): LatestAggRow[] {
  const s = [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === bv) return a.key.localeCompare(b.key);
    return av < bv ? -1 : 1;
  });
  return dir === "desc" ? s.reverse() : s;
}

/* ------------------- Gradient cell background -------------------- */
/* Creates a left-to-right gradient proportional to value/max */
function cellGradientStyle(value: number, max: number, color: "data" | "voice"): React.CSSProperties {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const col = color === "data" ? "rgba(37, 99, 235, 0.18)" : "rgba(22, 163, 74, 0.18)"; // blue / green
  return {
    background: `linear-gradient(90deg, ${col} ${pct}%, transparent ${pct}%)`,
  };
}

/* ============================== Page ============================== */

export default function TrafficPage() {
  const [subs, setSubs] = useState<string[]>([]);
  const [selectedSub, setSelectedSub] = useState<string>("__ALL__");

  const [daily, setDaily] = useState<TrafficDailyRow[]>([]);
  const [gridLatest, setGridLatest] = useState<LatestAggRow[]>([]);
  const [districtLatest, setDistrictLatest] = useState<LatestAggRow[]>([]);

  const [gridSortKey, setGridSortKey] = useState<SortKey>("total_gb");
  const [gridSortDir, setGridSortDir] = useState<SortDir>("desc");
  const [distSortKey, setDistSortKey] = useState<SortKey>("total_gb");
  const [distSortDir, setDistSortDir] = useState<SortDir>("desc");

  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  /* ---------- Load SubRegion options via RPC fetch_ssl_subregions() ---------- */
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.rpc("fetch_ssl_subregions");
        if (error) throw error;
        const arr: unknown[] = Array.isArray(data) ? data : [];
        const seen = new Map<string, string>();
        for (const x of arr) {
          const v = String((x as { subregion?: string | null }).subregion ?? "").trim();
          if (!v) continue;
          const k = v.toLowerCase();
          if (!seen.has(k)) seen.set(k, v);
        }
        setSubs(Array.from(seen.values()));
      } catch (e: unknown) {
        setErr((e as Error)?.message ?? "Failed to load subregions");
      }
    })();
  }, []);

  /* ---- Fetch daily series + latest-by-grid/district whenever SubRegion changes ---- */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const sub = selectedSub === "__ALL__" ? null : selectedSub;

        const [dRes, gRes, diRes] = await Promise.all([
          supabase.rpc("rpc_traffic_daily", {
            in_date_from: null,
            in_date_to: null,
            in_subregion: sub,
          }),
          supabase.rpc("rpc_traffic_latest_by_grid", { in_subregion: sub }),
          supabase.rpc("rpc_traffic_latest_by_district", { in_subregion: sub }),
        ]);

        if (dRes.error) throw dRes.error;
        if (gRes.error) throw gRes.error;
        if (diRes.error) throw diRes.error;

        const dArr: unknown[] = Array.isArray(dRes.data) ? dRes.data : [];
        const gArr: unknown[] = Array.isArray(gRes.data) ? gRes.data : [];
        const diArr: unknown[] = Array.isArray(diRes.data) ? diRes.data : [];

        setDaily(toDailySeries(dArr));
        setGridLatest(mapLatestGrid(gArr));
        setDistrictLatest(mapLatestDistrict(diArr));
      } catch (e: unknown) {
        setErr((e as Error)?.message ?? "Failed to load data");
        setDaily([]); setGridLatest([]); setDistrictLatest([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedSub]);

  /* ------------------------- Derived / helpers ------------------------- */

  const avgDataGB = useMemo(() => {
    const n = daily.length || 1;
    const sum = daily.reduce((s, r) => s + Number(r.total_gb ?? 0), 0);
    return sum / n;
  }, [daily]);

  const avgVoiceErl = useMemo(() => {
    const n = daily.length || 1;
    const sum = daily.reduce((s, r) => s + Number(r.voice_erl ?? 0), 0);
    return sum / n;
  }, [daily]);

  const gridRows = useMemo(
    () => sortLatest(gridLatest, gridSortKey, gridSortDir),
    [gridLatest, gridSortKey, gridSortDir]
  );
  const districtRows = useMemo(
    () => sortLatest(districtLatest, distSortKey, distSortDir),
    [districtLatest, distSortKey, distSortDir]
  );

  const series = useMemo(
    () =>
      daily.map((r) => ({
        date: (r.date ?? "").slice(0, 10),
        total_gb: Number(r.total_gb ?? 0),
        voice_erl: Number(r.voice_erl ?? 0),
      })),
    [daily]
  );

  /* max per table for gradient scaling */
  const gridMax = useMemo(
    () => ({
      total_gb: Math.max(0, ...gridRows.map((r) => r.total_gb)),
      voice_erl: Math.max(0, ...gridRows.map((r) => r.voice_erl)),
    }),
    [gridRows]
  );
  const distMax = useMemo(
    () => ({
      total_gb: Math.max(0, ...districtRows.map((r) => r.total_gb)),
      voice_erl: Math.max(0, ...districtRows.map((r) => r.voice_erl)),
    }),
    [districtRows]
  );

  /* ------------------------------- UI ------------------------------- */

  return (
    <div className="p-4 space-y-4">
      {/* Header + SubRegion select */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Network Traffic — Latest Totals & Daily Series</h1>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm text-gray-600">SubRegion</label>
          <select
            className="border rounded p-2 bg-white"
            value={selectedSub}
            onChange={(e) => setSelectedSub(e.target.value)}
          >
            <option value="__ALL__">All</option>
            {subs.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {err && <div className="text-sm text-red-600">Error: {err}</div>}

      {/* KPI cards (2 decimals) */}
      {!loading && !err && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl p-4 shadow-sm border bg-white/60">
            <div className="text-xs text-gray-500 mb-1">Days</div>
            <div className="text-2xl font-semibold">{daily.length}</div>
          </div>
          <div className="rounded-2xl p-4 shadow-sm border bg-white/60">
            <div className="text-xs text-gray-500 mb-1">Net Average Data</div>
            <div className="text-2xl font-semibold">{nf2.format(avgDataGB)} GB/day</div>
          </div>
          <div className="rounded-2xl p-4 shadow-sm border bg-white/60">
            <div className="text-xs text-gray-500 mb-1">Net Average Voice</div>
            <div className="text-2xl font-semibold">{nf2.format(avgVoiceErl)} Erl/day</div>
          </div>
        </div>
      )}

      {/* Two side-by-side, scrollable, sortable tables with gradient numeric cells */}
      {!loading && !err && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* District table */}
          <div className="rounded-2xl border bg-white/60">
            <div className="px-4 py-3 border-b flex items-center gap-3">
              <span className="font-medium">Latest Totals — by District</span>
              <div className="ml-auto flex items-center gap-2 text-sm">
                <label>Sort:</label>
                <select
                  className="border rounded p-1"
                  value={distSortKey}
                  onChange={(e) => setDistSortKey(e.target.value as SortKey)}
                >
                  <option value="total_gb">Total GB</option>
                  <option value="voice_erl">Voice Erl</option>
                </select>
                <button
                  className="border rounded px-2 py-1"
                  onClick={() => setDistSortDir((d) => (d === "desc" ? "asc" : "desc"))}
                  title="Toggle ASC/DESC"
                >
                  {distSortDir.toUpperCase()}
                </button>
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white/90 backdrop-blur z-10">
                  <tr className="[&>th]:px-4 [&>th]:py-2 text-left text-gray-600">
                    <th style={{ width: 48 }}>#</th>
                    <th>District</th>
                    <th>Date</th>
                    <th className="text-right">Total GB</th>
                    <th className="text-right">Voice Erl</th>
                  </tr>
                </thead>
                <tbody>
                  {districtRows.map((r, idx) => (
                    <tr key={`${r.key}-${r.latest_date}`} className="border-t">
                      <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-2">{r.key}</td>
                      <td className="px-4 py-2">{r.latest_date}</td>
                      <td
                        className="px-4 py-2 text-right rounded-sm"
                        style={cellGradientStyle(r.total_gb, distMax.total_gb, "data")}
                        title={nf2.format(r.total_gb)}
                      >
                        {nf2.format(r.total_gb)}
                      </td>
                      <td
                        className="px-4 py-2 text-right rounded-sm"
                        style={cellGradientStyle(r.voice_erl, distMax.voice_erl, "voice")}
                        title={nf2.format(r.voice_erl)}
                      >
                        {nf2.format(r.voice_erl)}
                      </td>
                    </tr>
                  ))}
                  {districtRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                        No data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grid table */}
          <div className="rounded-2xl border bg-white/60">
            <div className="px-4 py-3 border-b flex items-center gap-3">
              <span className="font-medium">Latest Totals — by Grid</span>
              <div className="ml-auto flex items-center gap-2 text-sm">
                <label>Sort:</label>
                <select
                  className="border rounded p-1"
                  value={gridSortKey}
                  onChange={(e) => setGridSortKey(e.target.value as SortKey)}
                >
                  <option value="total_gb">Total GB</option>
                  <option value="voice_erl">Voice Erl</option>
                </select>
                <button
                  className="border rounded px-2 py-1"
                  onClick={() => setGridSortDir((d) => (d === "desc" ? "asc" : "desc"))}
                  title="Toggle ASC/DESC"
                >
                  {gridSortDir.toUpperCase()}
                </button>
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white/90 backdrop-blur z-10">
                  <tr className="[&>th]:px-4 [&>th]:py-2 text-left text-gray-600">
                    <th style={{ width: 48 }}>#</th>
                    <th>Grid</th>
                    <th>Date</th>
                    <th className="text-right">Total GB</th>
                    <th className="text-right">Voice Erl</th>
                  </tr>
                </thead>
                <tbody>
                  {gridRows.map((r, idx) => (
                    <tr key={`${r.key}-${r.latest_date}`} className="border-t">
                      <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-2">{r.key}</td>
                      <td className="px-4 py-2">{r.latest_date}</td>
                      <td
                        className="px-4 py-2 text-right rounded-sm"
                        style={cellGradientStyle(r.total_gb, gridMax.total_gb, "data")}
                        title={nf2.format(r.total_gb)}
                      >
                        {nf2.format(r.total_gb)}
                      </td>
                      <td
                        className="px-4 py-2 text-right rounded-sm"
                        style={cellGradientStyle(r.voice_erl, gridMax.voice_erl, "voice")}
                        title={nf2.format(r.voice_erl)}
                      >
                        {nf2.format(r.voice_erl)}
                      </td>
                    </tr>
                  ))}
                  {gridRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                        No data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Area charts (Total GB + Voice Erl) with 2-decimal ticks/tooltips */}
      {!loading && !err && series.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: "total_gb", label: "Total Data (GB)", color: "#2563eb" },
            { key: "voice_erl", label: "Total Voice (Erl)", color: "#16a34a" },
          ].map(({ key, label, color }) => {
            const gradId = `fill-${key}`;
            return (
              <div key={key} className="rounded-2xl border bg-white/60 p-4">
                <div className="text-sm text-gray-600 mb-2">
                  {label} {selectedSub !== "__ALL__" ? `— ${selectedSub}` : "— All SubRegions"}
                </div>
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <AreaChart data={series} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                      <XAxis dataKey="date" type="category" allowDuplicatedCategory={false} tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={yTickFmt} />
                      <Tooltip formatter={(v) => tipFmt(v)} labelFormatter={tipLabelFmt} />
                      <Legend />
                      <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.55} />
                          <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey={key as "total_gb" | "voice_erl"}
                        name={label}
                        stroke={color}
                        fill={`url(#${gradId})`}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
  
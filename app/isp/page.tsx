// app/isp/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchIspTimeseries,
  fetchIspNumericSummary,
  type IspTimeseries,
  type IspNumericSummary,
  type IspSeriesPoint,
} from "@/app/lib/rpc/isp";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import type {
  ValueType,
  NameType,
} from "recharts/types/component/DefaultTooltipContent";

/* ---------------- helpers ---------------- */
const fmt = (n: number | null | undefined, dp = 2) =>
  typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: dp })
    : "—";

const tooltipFormatter = (
  value: ValueType,
  name: NameType
): [React.ReactNode, NameType] => {
  const num = typeof value === "number" ? value : Number(value);
  const out =
    typeof num === "number" && Number.isFinite(num)
      ? num.toLocaleString(undefined, { maximumFractionDigits: 3 })
      : String(value ?? "");
  return [out, name];
};

// ISO week label like 2025-W43
function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (t.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const firstThuDay = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstThuDay + 3);
  const week = 1 + Math.round((+t - +firstThu) / (7 * 24 * 3600 * 1000));
  const year = t.getUTCFullYear();
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/* Week start (Monday) at UTC midnight + ymd */
function weekStartUTC(d: Date): Date {
  const t = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const day = (t.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  t.setUTCDate(t.getUTCDate() - day);
  return t;
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Weekly average trend for EVERY calendar week in [rangeStart, rangeEnd].
 * Fills missing weeks with avg = 0.
 */
function buildWeeklyAvgTrendInRange(
  series: IspSeriesPoint[],
  metricKey: string,
  rangeStart: string,
  rangeEnd: string
): Array<{ week: string; start: string; avg: number }> {
  if (!series?.length) return [];

  const sums = new Map<string, number>();
  const counts = new Map<string, number>();

  for (const r of series) {
    const d = new Date(String(r.date));
    const ws = weekStartUTC(d);
    const key = ymd(ws);
    const v = (r as any)[metricKey];
    if (typeof v === "number" && Number.isFinite(v)) {
      sums.set(key, (sums.get(key) ?? 0) + v);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  // loop bounds from filter (or data edges)
  const minD = rangeStart
    ? new Date(rangeStart + "T00:00:00Z")
    : new Date(String(series[0]?.date));
  const maxD = rangeEnd
    ? new Date(rangeEnd + "T00:00:00Z")
    : new Date(String(series[series.length - 1]?.date));
  const start = weekStartUTC(minD);
  const end = weekStartUTC(maxD);

  const out: Array<{ week: string; start: string; avg: number }> = [];
  for (
    let cur = new Date(start);
    cur <= end;
    cur.setUTCDate(cur.getUTCDate() + 7)
  ) {
    const k = ymd(cur);
    const sum = sums.get(k) ?? 0;
    const c = counts.get(k) ?? 0;
    out.push({ start: k, week: isoWeekKey(k), avg: c ? sum / c : 0 });
  }
  return out;
}

/* ---------------- page ---------------- */
export default function IspTimeseriesPage() {
  const [dateFrom, setDateFrom] = useState<string | "">("");
  const [dateTo, setDateTo] = useState<string | "">("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [ts, setTs] = useState<IspTimeseries | null>(null);
  const [sum, setSum] = useState<IspNumericSummary | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  // tooltips follow cursor (via explicit position)
  type ChartMousePos = { x: number; y: number } | null;
  const [mousePosLine, setMousePosLine] = useState<ChartMousePos>(null);
  const [mousePosBar, setMousePosBar] = useState<ChartMousePos>(null);

  const PALETTE = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
    "#393b79",
    "#637939",
    "#8c6d31",
    "#843c39",
    "#7b4173",
  ];
  const colorFor = (key: string) => {
    if (!ts) return "#000000";
    const idx = ts.numericKeys.indexOf(key);
    return PALETTE[(idx >= 0 ? idx : 0) % PALETTE.length];
  };

  const load = async () => {
    try {
      setLoading(true);
      setErr(null);
      const [seriesRes, summaryRes] = await Promise.all([
        fetchIspTimeseries({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          table: "ISP_summary",
        }),
        fetchIspNumericSummary({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          table: "ISP_summary",
        }),
      ]);
      setTs(seriesRes);
      setSum(summaryRes);
      setSelected(seriesRes.numericKeys); // default: select all
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, []);

  useEffect(() => {
    if (!ts) return;
    if (selected.some((k) => !ts.numericKeys.includes(k))) {
      setSelected((prev) => prev.filter((k) => ts.numericKeys.includes(k)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ts?.numericKeys.join("|")]);

  const handleToggle = (key: string) =>
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  const handleSelectAll = () => ts && setSelected(ts.numericKeys);
  const handleClearAll = () => setSelected([]);

  // Pills show **range average** per metric (no “selected week”, no label in header)
  const rangeAvgByKey = useMemo<Record<string, number>>(() => {
    if (!sum) return {};
    const m: Record<string, number> = {};
    for (const k of sum.numericKeys) m[k] = sum.avgs[k] ?? 0;
    return m;
  }, [sum]);

  // Weekly bars across EVERY week in the selected date range (gap-filled)
  const primaryMetric = useMemo(
    () => (ts ? selected[0] || ts.numericKeys[0] || null : null),
    [ts, selected]
  );

  const weeklyBarData = useMemo(() => {
    if (!ts || !primaryMetric) return [];
    const rangeStart = dateFrom || ts.series[0]?.date || "";
    const rangeEnd = dateTo || ts.series[ts.series.length - 1]?.date || "";
    return buildWeeklyAvgTrendInRange(
      ts.series,
      primaryMetric,
      rangeStart,
      rangeEnd
    );
  }, [ts?.series, ts?.numericKeys, primaryMetric, dateFrom, dateTo]);

  // Table rows = Sum over selected range, descending
  const tableRows = useMemo(() => {
    if (!sum) return [] as Array<{ key: string; value: number }>;
    const rows = sum.numericKeys.map((k) => ({
      key: k,
      value: sum.sums[k] ?? 0,
    }));
    rows.sort((a, b) => b.value - a.value);
    return rows;
  }, [sum]);

  const maxValue = useMemo(
    () => (tableRows.length ? Math.max(...tableRows.map((r) => r.value)) : 0),
    [tableRows]
  );

  return (
    <div className="p-6 space-y-6 bg-gradient-to-b from-gray-50 to-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          ISP — Numeric Timeseries & Summary
        </h1>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border bg-white shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">From</label>
            <input
              type="date"
              className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">To</label>
            <input
              type="date"
              className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          <button
            onClick={load}
            className="h-10 px-5 rounded-xl bg-gray-900 text-white disabled:opacity-50 shadow-sm hover:opacity-90 transition"
            disabled={loading}
          >
            {loading ? "Loading…" : "Apply"}
          </button>

          {err && (
            <span className="text-red-600 text-sm whitespace-nowrap">
              {err}
            </span>
          )}
        </div>
      </div>

      {/* Metric toggles (pills show **Avg (range)**) */}
      <div className="rounded-2xl border bg-white shadow-sm p-4">
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <button
            type="button"
            onClick={handleSelectAll}
            className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-50 shadow-sm"
            disabled={!ts || ts.numericKeys.length === 0}
          >
            Select all
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-900 text-sm border"
          >
            Clear all
          </button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {ts?.numericKeys.map((k) => {
            const color = colorFor(k);
            const checked = selected.includes(k);
            const avg = rangeAvgByKey[k] ?? 0;
            return (
              <label
                key={k}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                  checked ? "bg-gray-50 border-gray-300" : "bg-white"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggle(k)}
                    className="h-4 w-4"
                  />
                  <span className="px-2 py-1 rounded-md bg-gray-100 border">
                    {k}
                  </span>
                </span>

                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[11px] text-gray-600">
                    Avg (range): <span className="font-medium">{fmt(avg)}</span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Line chart (cursor-follow) */}
      <div className="rounded-2xl border bg-white shadow-sm p-4">
        <div className="px-1 pb-2 font-medium text-gray-800">
          Values vs Date
        </div>
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={ts?.series ?? []}
              margin={{ top: 10, right: 20, bottom: 30, left: 10 }}
              onMouseMove={(s: any) => {
                if (
                  s &&
                  typeof s.chartX === "number" &&
                  typeof s.chartY === "number"
                ) {
                  setMousePosLine({ x: s.chartX + 14, y: s.chartY + 14 });
                }
              }}
              onMouseLeave={() => setMousePosLine(null)}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                angle={-30}
                textAnchor="end"
                interval="preserveStartEnd"
                minTickGap={10}
                tickMargin={12}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={tooltipFormatter}
                position={mousePosLine ?? undefined}
                allowEscapeViewBox={{ x: true, y: true }}
                cursor={{ strokeDasharray: "3 3" }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                iconType="plainline"
                verticalAlign="top"
                height={24}
              />
              {selected.map((k) => (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  dot={false}
                  stroke={colorFor(k)}
                  strokeWidth={1.6}
                  isAnimationActive={false}
                  activeDot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Value-only table + Weekly bar chart (every week in range) */}
      {sum && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Compact value-only table with gradient bars */}
          <div className="rounded-2xl border bg-white shadow-sm p-3">
            <div className="text-sm text-gray-700 mb-2">
              Values over selected range
            </div>
            <div className="max-h-[340px] overflow-auto rounded-xl border">
              <table className="min-w-[520px] w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2 border">Metric</th>
                    <th className="text-right p-2 border">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map(({ key, value }) => {
                    const pct =
                      maxValue > 0 ? Math.max(2, (value / maxValue) * 100) : 0;
                    return (
                      <tr key={key} className="odd:bg-white even:bg-gray-50">
                        <td className="p-2 border font-medium">{key}</td>
                        <td className="p-0 border">
                          <div className="relative px-2 py-2 text-right">
                            <div
                              className="absolute inset-y-0 left-0 rounded-sm pointer-events-none"
                              style={{
                                width: `${pct}%`,
                                background:
                                  "linear-gradient(90deg, rgba(31,119,180,0.20), rgba(31,119,180,0.06))",
                              }}
                            />
                            <span className="relative font-medium">
                              {fmt(value, 2)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Weekly bar chart — EVERY week in selected date range (gap-filled), tooltip follows cursor */}
          <div className="rounded-2xl border bg-white shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-700">
                Weekly Avg —{" "}
                <span className="font-medium">{primaryMetric ?? "—"}</span>
              </div>
            </div>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weeklyBarData}
                  margin={{ top: 10, right: 10, bottom: 30, left: 0 }}
                  onMouseMove={(s: any) => {
                    if (
                      s &&
                      typeof s.chartX === "number" &&
                      typeof s.chartY === "number"
                    ) {
                      setMousePosBar({ x: s.chartX + 14, y: s.chartY + 14 });
                    }
                  }}
                  onMouseLeave={() => setMousePosBar(null)}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 11 }}
                    angle={-25}
                    textAnchor="end"
                    interval="preserveEnd"
                    minTickGap={8}
                    tickMargin={10}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={tooltipFormatter}
                    position={mousePosBar ?? undefined}
                    allowEscapeViewBox={{ x: true, y: true }}
                  />
                  <Bar dataKey="avg" fill="#1f77b4" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              Weekly averages across every calendar week in the selected date
              range.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { fetchDailySeries, type DailyPoint } from "@/app/lib/rpc/pscore_subs";
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
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/* ---------- Helper formatting ---------- */
const numFmt = (n: number | null | undefined) =>
  typeof n === "number"
    ? n >= 1_000_000_000
      ? (n / 1_000_000_000).toFixed(1) + "B"
      : n >= 1_000_000
      ? (n / 1_000_000).toFixed(1) + "M"
      : n >= 1_000
      ? (n / 1_000).toFixed(0) + "K"
      : n.toString()
    : "—";

/* ---------- Indicators config ---------- */
const INDICATORS: { key: keyof DailyPoint; label: string }[] = [
  { key: "attach_total", label: "Total Attach Users" },
  { key: "active_total", label: "Total Active Users" },
  { key: "attach_2g", label: "2G Attach" },
  { key: "attach_3g_total", label: "3G Attach (incl. Cloud)" },
  { key: "attach_4g_total", label: "4G Attach (incl. Cloud)" },
  { key: "active_2g", label: "2G Active" },
  { key: "active_3g_total", label: "3G Active (incl. Cloud)" },
  { key: "active_4g_total", label: "4G Active (incl. Cloud)" },
];

/* ---------- Page ---------- */
export default function PSCorePage() {
  const [series, setSeries] = useState<DailyPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDailySeries();
      setSeries(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">PS Core Subscribers</h1>
        <Button onClick={loadData} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {/* Responsive grid: 2 charts per row on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {INDICATORS.map((ind) => (
          <IndicatorChart
            key={ind.key}
            title={ind.label}
            dataKey={ind.key}
            data={series}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- Chart Component ---------- */
function IndicatorChart({
  title,
  dataKey,
  data,
}: {
  title: string;
  dataKey: keyof DailyPoint;
  data: DailyPoint[];
}) {
  return (
    <Card className="p-4">
      <h2 className="text-lg font-medium mb-2">{title}</h2>
      <div className="h-72">
        <ResponsiveContainer>
          <LineChart
            data={data}
            margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="d" tick={{ fontSize: 10 }} />
            <YAxis
              tickFormatter={(v) => numFmt(v)}
              tick={{ fontSize: 10 }}
              domain={["auto", "auto"]}
              width={60}
            />
            <Tooltip
              formatter={(v: number) => numFmt(v)}
              labelFormatter={(d) => `Date: ${d}`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey={dataKey}
              name={title}
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

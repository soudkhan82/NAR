"use client";

import { useEffect, useState } from "react";
import {
  fetchTrafficSeries,
  type TrafficPoint,
} from "@/app/lib/rpc/pscore_traffic";
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

/* ---------- Formatting ---------- */
const numFmt = (n: number | null | undefined) =>
  typeof n === "number"
    ? n >= 1_000_000_000
      ? (n / 1_000_000_000).toFixed(2) + "B"
      : n >= 1_000_000
      ? (n / 1_000_000).toFixed(2) + "M"
      : n >= 1_000
      ? (n / 1_000).toFixed(1) + "K"
      : n.toString()
    : "—";

/* ---------- Field List ---------- */
const INDICATORS: { key: keyof TrafficPoint; label: string }[] = [
  // Throughput metrics
  { key: "Total_Throughput_Gbps", label: "Total Throughput (Gbps)" },
  { key: "KHI_UGW_2_Throughput", label: "KHI UGW 2 Throughput" },
  { key: "ISB_UGW_2_Throughput", label: "ISB UGW 2 Throughput" },
  { key: "LHR_UGW_2_Throughput", label: "LHR UGW 2 Throughput" },
  { key: "LHR_UGW_3_Throughput", label: "LHR UGW 3 Throughput" },
  { key: "LHR_UGW_4_Throughput", label: "LHR UGW 4 Throughput" },
  { key: "LHR_UPF01_Throughput", label: "LHR UPF01 Throughput" },
  { key: "ISB_UPF01_Throughput", label: "ISB UPF01 Throughput" },
  { key: "KHI_VDGW01_Throughput", label: "KHI VDGW01 Throughput" },
  { key: "KHI_VDGW02_Throughput", label: "KHI VDGW02 Throughput" },
  { key: "ISB_VDGW01_Throughput", label: "ISB VDGW01 Throughput" },
  { key: "ISB_VDGW02_Throughput", label: "ISB VDGW02 Throughput" },
  { key: "LHR_VDGW01_Throughput", label: "LHR VDGW01 Throughput" },
  { key: "LHR_VDGW02_Throughput", label: "LHR VDGW02 Throughput" },
  // Volume metrics
  { key: "Total_Traffic_TB", label: "Total Traffic (TB)" },
  { key: "KHI_UGW_2_Volume", label: "KHI UGW 2 Volume" },
  { key: "ISB_UGW_2_Volume", label: "ISB UGW 2 Volume" },
  { key: "LHR_UGW_2_Volume", label: "LHR UGW 2 Volume" },
  { key: "LHR_UGW_3_Volume", label: "LHR UGW 3 Volume" },
  { key: "LHR_UGW_4_Volume", label: "LHR UGW 4 Volume" },
  { key: "LHR_UPF01_Volume", label: "LHR UPF01 Volume" },
  { key: "ISB_UPF01_Volume", label: "ISB UPF01 Volume" },
  { key: "KHI_VDGW01_Volume", label: "KHI VDGW01 Volume" },
  { key: "KHI_VDGW02_Volume", label: "KHI VDGW02 Volume" },
  { key: "ISB_VDGW01_Volume", label: "ISB VDGW01 Volume" },
  { key: "ISB_VDGW02_Volume", label: "ISB VDGW02 Volume" },
  { key: "LHR_VDGW01_Volume", label: "LHR VDGW01 Volume" },
  { key: "LHR_VDGW02_Volume", label: "LHR VDGW02 Volume" },
];

/* ---------- Main Component ---------- */
export default function PSCoreTrafficPage() {
  const [series, setSeries] = useState<TrafficPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTrafficSeries();
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
        <h1 className="text-2xl font-semibold">PS Core Throughput & Traffic</h1>
        <Button onClick={loadData} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {/* Responsive grid - 2 charts per row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {INDICATORS.map((ind) => (
          <IndicatorChart
            key={ind.key as string}
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
  dataKey: keyof TrafficPoint;
  data: TrafficPoint[];
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
              width={70}
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

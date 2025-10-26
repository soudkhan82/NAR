"use client";

import {
  BarChart as RCBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const COLORS: Record<"PGS" | "SB", string> = {
  PGS: "#2563eb", // blue
  SB:  "#10b981", // green
};

export default function BarChart({
  title,
  data,
  xKey,
  yKey,     // "pgs" or "sb"
  series,   // "PGS" | "SB"
}: {
  title: string;
  data: Array<Record<string, any>>;
  xKey: string;
  yKey: string;
  series: "PGS" | "SB";
}) {
  const color = COLORS[series];

  return (
    <div className="p-4 rounded-2xl border shadow-sm bg-white">
      <div className="text-sm font-medium mb-2">{title}</div>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <RCBarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey={yKey} fill={color} />
          </RCBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

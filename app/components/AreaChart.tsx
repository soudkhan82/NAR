"use client";

import {
  AreaChart as RCAreaChart,
  Area,
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

export default function AreaChart({
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
  const gradId = `grad-${series}-${xKey}-${yKey}`;

  return (
    <div className="p-4 rounded-2xl border shadow-sm bg-white">
      <div className="text-sm font-medium mb-2">{title}</div>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <RCAreaChart data={data}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey={yKey}
              stroke={color}
              fill={`url(#${gradId})`}
              dot={false}
            />
          </RCAreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

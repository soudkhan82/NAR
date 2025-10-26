"use client";

import {
  LineChart as RCLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function LineChart({
  title,
  data,
  xKey,
  yKey,
}: {
  title: string;
  data: Array<Record<string, any>>;
  xKey: string;
  yKey: string; // "pgs" or "sb"
}) {
  return (
    <div className="p-4 rounded-2xl border shadow-sm bg-white">
      <div className="text-sm font-medium mb-2">{title}</div>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <RCLineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey={yKey} dot={false} />
          </RCLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

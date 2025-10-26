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

export default function HorizontalBarChart({
  title,
  data,
  nameKey = "name",
  valueKey = "value",
  color = "#6b7280", // neutral slate by default
  maxItems = 15, // keep it readable
}: {
  title: string;
  data: Array<Record<string, any>>;
  nameKey?: string;
  valueKey?: string;
  color?: string;
  maxItems?: number;
}) {
  const rows = (data ?? []).slice(0, maxItems);
  return (
    <div className="p-4 rounded-2xl border shadow-sm bg-white">
      <div className="text-sm font-medium mb-2">{title}</div>
      <div style={{ width: "100%", height: 360 }}>
        <ResponsiveContainer>
          <RCBarChart
            data={rows}
            layout="vertical"
            margin={{ left: 16, right: 12, top: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey={nameKey}
              width={140}
              tick={{ fontSize: 12 }}
            />
            <Tooltip />
            <Bar dataKey={valueKey} fill={color} />
          </RCBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

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

type RowLike = Record<string, string | number>;
type KeyOf<T> = Extract<keyof T, string>;

type Props<T extends RowLike> = {
  title: string;
  data: T[];
  nameKey?: KeyOf<T>;
  valueKey?: KeyOf<T>;
  color?: string;
  maxItems?: number;
  height?: number;
};

export default function HorizontalBarChart<T extends RowLike>({
  title,
  data,
  nameKey = "name" as KeyOf<T>,
  valueKey = "value" as KeyOf<T>,
  color = "#6b7280",
  maxItems = 15,
  height = 360,
}: Props<T>) {
  const rows = (data ?? []).slice(0, maxItems);

  return (
    <div className="p-4 rounded-2xl border shadow-sm bg-white">
      <div className="text-sm font-medium mb-2">{title}</div>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <RCBarChart
            data={rows as RowLike[]}
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

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

// allow nulls alongside numbers/strings
type RowLike = Record<string, string | number | null>;
type KeyOf<T> = Extract<keyof T, string>;

const COLORS: Record<"PGS" | "SB", string> = {
  PGS: "#2563eb",
  SB: "#10b981",
};

type Props<T extends RowLike> = {
  title: string;
  data: T[];
  xKey: KeyOf<T>;
  yKey: KeyOf<T>;
  series: "PGS" | "SB";
  height?: number;
};

export default function AreaChart<T extends RowLike>({
  title,
  data,
  xKey,
  yKey,
  series,
  height = 260,
}: Props<T>) {
  const color = COLORS[series];

  return (
    <div className="p-4 rounded-2xl border shadow-sm bg-white">
      <div className="text-sm font-medium mb-2">{title}</div>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <RCBarChart data={data as RowLike[]}>
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

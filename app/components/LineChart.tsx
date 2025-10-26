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

type RowLike = Record<string, string | number | null>;
type KeyOf<T> = Extract<keyof T, string>;

type Props<T extends RowLike> = {
  title: string;
  data: T[];
  xKey: KeyOf<T>;
  yKey: KeyOf<T>;
  height?: number;
};

export default function LineChart<T extends RowLike>({
  title,
  data,
  xKey,
  yKey,
  height = 260,
}: Props<T>) {
  return (
    <div className="p-4 rounded-2xl border shadow-sm bg-white">
      <div className="text-sm font-medium mb-2">{title}</div>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <RCLineChart data={data as RowLike[]}>
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

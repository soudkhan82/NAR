"use client";

import { memo } from "react";
import type { SlabBucket } from "@/app/lib/rpc/lpa";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  data: SlabBucket[];       // [{ aging_slab: '3–7d', cnt: 42 }, ...]
  title?: string;
  className?: string;
};

function formatLabel(label?: string) {
  return label ?? "";
}

function formatValue(v?: number) {
  if (v == null) return "";
  return v.toLocaleString();
}

const LpaSlabBars = ({ data, title = "Aging Distribution", className = "" }: Props) => {
  const isEmpty = !data || data.length === 0 || data.every((d) => !d?.cnt);

  return (
    <div className={`rounded-2xl p-4 bg-white shadow-sm ${className}`}>
      <div className="text-sm mb-2 opacity-70">{title}</div>

      {isEmpty ? (
        <div className="h-[280px] flex items-center justify-center text-sm text-gray-500">
          No data to display
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <defs>
              <linearGradient id="slabGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="red" stopOpacity={0.9} />
                <stop offset="100%" stopColor="orange" stopOpacity={0.4} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="aging_slab"
              tickFormatter={formatLabel}
              interval={0}
              height={40}
            />
            <YAxis allowDecimals={false} tickFormatter={formatValue} />
            <Tooltip
              formatter={(value: number) => [formatValue(value), "Count"]}
              labelFormatter={(label) => `Slab: ${formatLabel(label as string)}`}
            />
            <Bar dataKey="cnt" fill="url(#slabGrad)" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default memo(LpaSlabBars);

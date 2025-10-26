"use client";

import { memo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
// import type { RegionBucket } from "@/app/lib/rpc/lpa";

// If you already export RegionBucket from your rpc file, replace this with:
// import type { RegionBucket } from "@/app/lib/rpc/lpa";
type RegionBucket = { region: string | null; cnt: number };

type Props = {
  data: RegionBucket[]; // [{ region: "South", cnt: 42 }, ...]
  title?: string;
  className?: string;
};

function fmtVal(v?: number) {
  if (v == null) return "";
  return v.toLocaleString();
}

const LpaRegionBars = ({
  data,
  title = "Alarms by Region",
  className = "",
}: Props) => {
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
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={(d: RegionBucket) => d.region ?? "Unknown"}
              interval={0}
              height={60}
              tick={{ fontSize: 12 }}
              angle={-30}
              textAnchor="end"
            />
            <YAxis allowDecimals={false} tickFormatter={fmtVal} />
            <Tooltip
              formatter={(value: number) => [fmtVal(value), "Count"]}
              labelFormatter={(label) => `Region: ${label ?? "Unknown"}`}
            />
            <Bar dataKey="cnt" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default memo(LpaRegionBars);

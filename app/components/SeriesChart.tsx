// app/components/SeriesChart.tsx
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceArea,
} from "recharts";
import { memo, useMemo } from "react";

export type SeriesPoint = Record<string, string | number | null>;
export type SeriesDef = { key: string; name: string };

type Props = {
  title?: string;
  data: SeriesPoint[];
  series: SeriesDef[];
  xKey: string; // e.g. "t" (timestamp ISO)
};

function colorAt(i: number) {
  const colors = [
    "#2563eb",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#7c3aed",
    "#14b8a6",
  ];
  return colors[i % colors.length];
}

/** ALWAYS show time + date, e.g. "14:05 • 11 Oct" (same year) or "14:05 • 11 Oct 2025" (different year) */
function makeTimeAndDateFormatter() {
  const fmtTime = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const fmtDayThisYear = new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
  });
  const fmtDayOtherYear = new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const currYear = new Date().getFullYear();

  return (iso: unknown) => {
    if (typeof iso !== "string") return String(iso ?? "");
    const d = new Date(iso);
    if (Number.isNaN(+d)) return iso;
    const datePart =
      d.getFullYear() === currYear
        ? fmtDayThisYear.format(d)
        : fmtDayOtherYear.format(d);
    return `${fmtTime.format(d)} • ${datePart}`;
  };
}

function numberFmt(v: unknown) {
  if (typeof v === "number")
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return "—";
}

function SeriesChart({ title, data, series, xKey }: Props) {
  const fmtX = useMemo(() => makeTimeAndDateFormatter(), []);
  return (
    <div className="p-4 rounded-2xl border bg-white shadow-sm">
      {title ? <h2 className="text-sm font-medium mb-3">{title}</h2> : null}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 10, right: 16, bottom: 10, left: 0 }}
          >
            <defs>
              {series.map((s, i) => (
                <linearGradient
                  id={`grad-${s.key}`}
                  key={s.key}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={colorAt(i)} stopOpacity={0.3} />
                  <stop
                    offset="100%"
                    stopColor={colorAt(i)}
                    stopOpacity={0.02}
                  />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

            <XAxis
              dataKey={xKey}
              tickFormatter={fmtX}
              minTickGap={24}
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              tickFormatter={(v) => numberFmt(v)}
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={{ stroke: "#e5e7eb" }}
            />

            <Tooltip
              labelFormatter={(x) => fmtX(x)}
              formatter={(v) => numberFmt(v)}
              contentStyle={{ borderRadius: 12, borderColor: "#e5e7eb" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />

            <ReferenceArea y1={0} y2={0} ifOverflow="extendDomain" />

            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={colorAt(i)}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(SeriesChart);

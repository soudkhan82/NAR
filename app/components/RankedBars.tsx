// app/components/RankedBars.tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { memo } from "react";

export type RankedItem = {
  label: string;   // e.g. Site_ID
  value: number;   // e.g. AvgDL_TP
  // You can carry extra metadata if needed, typed where consumed
};

type Props = {
  title?: string;
  items: RankedItem[];
  valueFormatter?: (v: number) => string;
  onBarClick?: (item: RankedItem) => void;
};

function RankedBars({ title, items, valueFormatter, onBarClick }: Props) {
  const data = items.map((it) => ({ name: it.label, value: it.value }));

  return (
    <div className="p-4 rounded-2xl shadow-sm border bg-white">
      {title ? <h2 className="text-sm font-medium mb-3">{title}</h2> : null}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 10, right: 24, bottom: 10, left: 80 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickFormatter={(v: number) =>
                valueFormatter ? valueFormatter(v) : v.toLocaleString()
              }
            />
            <YAxis type="category" dataKey="name" width={80} />
            <Tooltip
              formatter={(value) =>
                typeof value === "number"
                  ? valueFormatter
                    ? valueFormatter(value)
                    : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : String(value)
              }
            />
            <Bar
              dataKey="value"
              isAnimationActive={false}
              onClick={(d) => {
                // Recharts passes a payload with `payload.name` and `payload.value`
                const name =
                  typeof d?.payload?.name === "string" ? d.payload.name : "";
                const val =
                  typeof d?.payload?.value === "number" ? d.payload.value : 0;
                if (onBarClick && name) onBarClick({ label: name, value: val });
              }}
            >
              {data.map((_d, i) => (
                <Cell key={_d.name} fill="#2563eb" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(RankedBars);

// app/components/FilterBar.tsx
"use client";

import { memo } from "react";

export type FilterState = {
  subRegion: string | null;
  grid: string | null;
  district: string | null;
  siteName: string | null;
  dateFrom: string | null; // YYYY-MM-DD
  dateTo: string | null;   // YYYY-MM-DD
};

type Props = {
  value: FilterState;
  onChange: (next: Partial<FilterState>) => void;
  loading?: boolean;
  options: {
    subRegions: string[];
    grids: string[];
    districts: string[];
    siteNames: string[];
  };
  onQuickLast30?: () => void;
};

function FilterBar({ value, onChange, loading, options, onQuickLast30 }: Props) {
  const disabled = !!loading;

  return (
    <div className="p-4 rounded-2xl shadow-sm border bg-white">
      <div className="grid gap-3 md:grid-cols-6">
        {/* SubRegion */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">SubRegion</label>
          <select
            className="border rounded-md px-2 py-1"
            disabled={disabled}
            value={value.subRegion ?? ""}
            onChange={(e) => onChange({ subRegion: e.target.value || null })}
          >
            <option value="">All</option>
            {options.subRegions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Grid */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Grid</label>
          <select
            className="border rounded-md px-2 py-1"
            disabled={disabled}
            value={value.grid ?? ""}
            onChange={(e) => onChange({ grid: e.target.value || null })}
          >
            <option value="">All</option>
            {options.grids.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* District */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">District</label>
          <select
            className="border rounded-md px-2 py-1"
            disabled={disabled}
            value={value.district ?? ""}
            onChange={(e) => onChange({ district: e.target.value || null })}
          >
            <option value="">All</option>
            {options.districts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Site Name */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Site</label>
          <input
            className="border rounded-md px-2 py-1"
            disabled={disabled}
            list="siteNameList"
            value={value.siteName ?? ""}
            onChange={(e) => onChange({ siteName: e.target.value || null })}
            placeholder="Site_ID / SiteName"
          />
          <datalist id="siteNameList">
            {options.siteNames.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        {/* Date From */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">From</label>
          <input
            type="date"
            className="border rounded-md px-2 py-1"
            disabled={disabled}
            value={value.dateFrom ?? ""}
            onChange={(e) => onChange({ dateFrom: e.target.value || null })}
          />
        </div>

        {/* Date To */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">To</label>
          <input
            type="date"
            className="border rounded-md px-2 py-1"
            disabled={disabled}
            value={value.dateTo ?? ""}
            onChange={(e) => onChange({ dateTo: e.target.value || null })}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {onQuickLast30 ? (
          <button
            type="button"
            className="text-xs px-2 py-1 rounded-md border hover:bg-gray-50 disabled:opacity-50"
            onClick={onQuickLast30}
            disabled={disabled}
          >
            Last 30 days
          </button>
        ) : null}
        {disabled ? <span className="text-xs text-gray-500">Loading…</span> : null}
      </div>
    </div>
  );
}

export default memo(FilterBar);

// app/lib/rpc/traffic.ts
import supabase from "@/app/config/supabase-config";

/* ---------- Types ---------- */

export type TrafficTimeseriesRow = {
  dt: string; // YYYY-MM-DD (normalized)
  voice_2g: number | null;
  voice_3g: number | null;
  volte_voice: number | null;
  total_voice_erl: number | null;
  data_2g_gb: number | null;
  data_3g_gb: number | null;
  data_4g_gb: number | null;
  total_data_gb: number | null;
};

export type TrafficComparisonRow = {
  metric_code: string;
  metric_label: string;
  old_date: string | null;
  old_value: number | null;
  new_date: string | null;
  new_value: number | null;
  pct_change: number | null;
};

export type TrafficFilterParams = {
  region?: string | null;
  subregion?: string | null;
  district?: string | null;
  grid?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  oldDate?: string | null;
  newDate?: string | null;
};

/* ---------- Filter option row types ---------- */

type RegionRow = { region: string | null };
type SubregionRow = { subregion: string | null };
type GridRow = { grid: string | null };
type DistrictRow = { district: string | null };

/* ---------- Extra types for bounds / grid / district stats ---------- */

export type TrafficDateBounds = {
  min_date: string | null;
  max_date: string | null;
};

export type TrafficGridChangeRow = {
  grid: string | null;
  old_total_voice_erl: number | null;
  new_total_voice_erl: number | null;
  pct_change_voice: number | null;
  old_total_data_gb: number | null;
  new_total_data_gb: number | null;
  pct_change_data: number | null;
};

export type TrafficDistrictChangeRow = {
  district: string | null;
  old_total_voice_erl: number | null;
  new_total_voice_erl: number | null;
  pct_change_voice: number | null;
  old_total_data_gb: number | null;
  new_total_data_gb: number | null;
  pct_change_data: number | null;
};

/* ---------- Date helpers (IMPORTANT) ---------- */

const toDateOnly = (dt: unknown): string | null => {
  if (typeof dt !== "string") return null;
  // Supports "YYYY-MM-DD" or timestamp "YYYY-MM-DDTHH:mm:ss..."
  if (dt.length >= 10) return dt.slice(0, 10);
  return null;
};

const clampAndNormalizeTimeseries = (
  rows: TrafficTimeseriesRow[],
  dateFrom: string,
  dateTo: string
): TrafficTimeseriesRow[] => {
  const from = dateFrom;
  const to = dateTo;

  // 1) filter strictly within [from,to]
  const filtered = rows
    .map((r) => {
      const d = toDateOnly((r as any).dt);
      if (!d) return null;
      return { ...r, dt: d } as TrafficTimeseriesRow;
    })
    .filter((r): r is TrafficTimeseriesRow => !!r)
    .filter((r) => r.dt >= from && r.dt <= to);

  // 2) dedupe by dt (keep last occurrence)
  const byDate = new Map<string, TrafficTimeseriesRow>();
  for (const r of filtered) byDate.set(r.dt, r);

  // 3) sort by date
  return Array.from(byDate.values()).sort((a, b) => a.dt.localeCompare(b.dt));
};

/* ---------- SSL filter RPCs (Region-dependent) ---------- */

export async function fetchRegions(): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_regions");
  if (error) {
    console.error("fetchRegions error:", error);
    throw new Error(error.message);
  }
  console.log("[Traffic] Regions:", data);
  return (data as RegionRow[])
    .map((r) => r.region)
    .filter((r): r is string => !!r);
}

export async function fetchSubregionsByRegion(
  region: string | null
): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_subregions_by_region", {
    in_region: region ?? null,
  });
  if (error) {
    console.error("fetchSubregionsByRegion error:", error);
    throw new Error(error.message);
  }
  console.log("[Traffic] Subregions for region", region, ":", data);
  return (data as SubregionRow[])
    .map((r) => r.subregion)
    .filter((r): r is string => !!r);
}

/* Optional: still available if you ever re-enable Grid/District filters in UI */

export async function fetchGridsByRegion(
  region: string | null,
  subregion: string | null
): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_grids_by_region", {
    in_region: region ?? null,
    in_subregion: subregion ?? null,
  });
  if (error) {
    console.error("fetchGridsByRegion error:", error);
    throw new Error(error.message);
  }
  console.log(
    "[Traffic] Grids for region/subregion",
    region,
    subregion,
    ":",
    data
  );
  return (data as GridRow[]).map((r) => r.grid).filter((r): r is string => !!r);
}

export async function fetchDistrictsByRegion(
  region: string | null,
  subregion: string | null,
  grid: string | null
): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_districts_by_region", {
    in_region: region ?? null,
    in_subregion: subregion ?? null,
    in_grid: grid ?? null,
  });
  if (error) {
    console.error("fetchDistrictsByRegion error:", error);
    throw new Error(error.message);
  }
  console.log(
    "[Traffic] Districts for region/subregion/grid",
    region,
    subregion,
    grid,
    ":",
    data
  );
  return (data as DistrictRow[])
    .map((r) => r.district)
    .filter((r): r is string => !!r);
}

/* ---------- Date bounds (for earliest / latest date in DB) ---------- */

export async function fetchTrafficDateBounds(): Promise<TrafficDateBounds | null> {
  const { data, error } = await supabase.rpc("fetch_traffic_date_bounds");
  if (error) {
    console.error("fetchTrafficDateBounds error:", error);
    throw new Error(error.message);
  }
  console.log("[Traffic] Date bounds:", data);
  if (!data || data.length === 0) return null;
  return data[0] as TrafficDateBounds;
}

/* ---------- Traffic RPCs (timeseries + comparison) ---------- */

export async function fetchTrafficTimeseries(
  params: TrafficFilterParams
): Promise<TrafficTimeseriesRow[]> {
  const { region, subregion, district, grid, dateFrom, dateTo } = params;

  console.log("[Traffic] fetchTrafficTimeseries params:", params);

  // Guard
  if (!dateFrom || !dateTo) {
    console.warn(
      "[Traffic] fetchTrafficTimeseries called without dateFrom/dateTo – returning []"
    );
    return [];
  }

  // If swapped, fix locally (prevents accidental full-range behavior elsewhere)
  const from = dateFrom <= dateTo ? dateFrom : dateTo;
  const to = dateFrom <= dateTo ? dateTo : dateFrom;

  // Split into chunks
  const ranges = splitDateRangeIntoChunks(from, to, 7);
  if (!ranges.length) {
    console.warn(
      "[Traffic] fetchTrafficTimeseries – no valid ranges produced, returning []"
    );
    return [];
  }

  const allRows: TrafficTimeseriesRow[] = [];

  // Sequential RPC calls per chunk
  for (const range of ranges) {
    console.log(
      "[Traffic] fetchTrafficTimeseries chunk:",
      range.from,
      "->",
      range.to
    );

    const { data, error } = await supabase.rpc("fetch_traffic_timeseries", {
      in_region: region ?? null,
      in_subregion: subregion ?? null,
      in_district: district ?? null,
      in_grid: grid ?? null,
      in_date_from: range.from,
      in_date_to: range.to,
    });

    if (error) {
      const errAny = error as any;
      console.error("[Traffic] fetchTrafficTimeseries error in chunk", {
        from: range.from,
        to: range.to,
        errorRaw: error,
        message: errAny?.message,
        details: errAny?.details,
        hint: errAny?.hint,
        code: errAny?.code,
      });

      throw new Error(
        errAny?.message ||
          errAny?.details ||
          `fetch_traffic_timeseries failed for chunk ${range.from} to ${range.to}`
      );
    }

    if (Array.isArray(data)) {
      allRows.push(...(data as TrafficTimeseriesRow[]));
    }
  }

  // ✅ FINAL GUARANTEE: normalize + clamp + dedupe + sort
  const finalRows = clampAndNormalizeTimeseries(allRows, from, to);

  console.log("[Traffic] Timeseries rows (after clamp):", finalRows.length);
  return finalRows;
}

export async function fetchTrafficComparison(
  params: TrafficFilterParams
): Promise<TrafficComparisonRow[]> {
  const { region, subregion, district, grid, oldDate, newDate } = params;

  if (!oldDate || !newDate) {
    console.warn("[Traffic] fetchTrafficComparison missing dates:", {
      oldDate,
      newDate,
    });
    return [];
  }

  const from = oldDate <= newDate ? oldDate : newDate;
  const to = oldDate <= newDate ? newDate : oldDate;

  console.log("[Traffic] fetchTrafficComparison params:", {
    ...params,
    oldDate: from,
    newDate: to,
  });

  const { data, error } = await supabase.rpc("fetch_traffic_comparison", {
    in_old_date: from,
    in_new_date: to,
    in_region: region ?? null,
    in_subregion: subregion ?? null,
    in_district: district ?? null,
    in_grid: grid ?? null,
  });

  if (error) {
    console.error("fetchTrafficComparison error:", error);
    throw new Error(error.message);
  }

  console.log("[Traffic] Comparison rows:", data);
  return (data ?? []) as TrafficComparisonRow[];
}

/* ---------- Grid & District-level change stats ---------- */

export async function fetchTrafficGridChange(
  region: string | null,
  subregion: string | null,
  oldDate: string,
  newDate: string
): Promise<TrafficGridChangeRow[]> {
  const from = oldDate <= newDate ? oldDate : newDate;
  const to = oldDate <= newDate ? newDate : oldDate;

  console.log("[Traffic] fetchTrafficGridChange params:", {
    region,
    subregion,
    oldDate: from,
    newDate: to,
  });

  const { data, error } = await supabase.rpc("fetch_traffic_grid_change", {
    in_old_date: from,
    in_new_date: to,
    in_region: region ?? null,
    in_subregion: subregion ?? null,
  });

  if (error) {
    console.error("fetchTrafficGridChange error:", error);
    throw new Error(error.message);
  }

  console.log("[Traffic] Grid change rows:", data);
  return (data ?? []) as TrafficGridChangeRow[];
}

export async function fetchTrafficDistrictChange(
  region: string | null,
  subregion: string | null,
  oldDate: string,
  newDate: string
): Promise<TrafficDistrictChangeRow[]> {
  const from = oldDate <= newDate ? oldDate : newDate;
  const to = oldDate <= newDate ? newDate : oldDate;

  console.log("[Traffic] fetchTrafficDistrictChange params:", {
    region,
    subregion,
    oldDate: from,
    newDate: to,
  });

  const { data, error } = await supabase.rpc("fetch_traffic_district_change", {
    in_old_date: from,
    in_new_date: to,
    in_region: region ?? null,
    in_subregion: subregion ?? null,
  });

  if (error) {
    console.error("fetchTrafficDistrictChange error:", error);
    throw new Error(error.message);
  }

  console.log("[Traffic] District change rows:", data);
  return (data ?? []) as TrafficDistrictChangeRow[];
}

/* Small helper: split a date range into smaller chunks to avoid timeouts */
function splitDateRangeIntoChunks(
  dateFrom: string | null | undefined,
  dateTo: string | null | undefined,
  chunkSizeDays = 7
): { from: string; to: string }[] {
  if (!dateFrom || !dateTo) return [];

  const start = new Date(dateFrom);
  const end = new Date(dateTo);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (start > end) return [];

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const ranges: { from: string; to: string }[] = [];
  let cursor = new Date(start);

  while (cursor <= end) {
    const chunkStart = new Date(cursor);
    const chunkEnd = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + chunkSizeDays - 1);

    if (chunkEnd > end) {
      chunkEnd.setTime(end.getTime());
    }

    ranges.push({ from: fmt(chunkStart), to: fmt(chunkEnd) });

    cursor = new Date(chunkEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  return ranges;
}

// app/lib/rpc/traffic.ts
import supabase from "@/app/config/supabase-config";

/* ---------- Types ---------- */

export type TrafficTimeseriesRow = {
  dt: string;
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
  district?: string | null; // UI not using now, but kept for flexibility
  grid?: string | null; // UI not using now, but kept for flexibility
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

  // 0) Hard guard: no date → don't smash full 5.1M table
  if (!dateFrom || !dateTo) {
    console.warn(
      "[Traffic] fetchTrafficTimeseries called without dateFrom/dateTo – returning []"
    );
    return [];
  }

  // 1) Split the date range into smaller chunks (7 days each)
  const ranges = splitDateRangeIntoChunks(dateFrom, dateTo, 7);

  if (!ranges.length) {
    console.warn(
      "[Traffic] fetchTrafficTimeseries – no valid ranges produced, returning []"
    );
    return [];
  }

  const allRows: TrafficTimeseriesRow[] = [];

  // 2) Call RPC sequentially per chunk
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
        // Raw object (may show as {} but useful in devtools)
        errorRaw: error,
        // PostgREST usually has these:
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

  // 3) Ensure final data is sorted by date
  allRows.sort((a, b) => {
    // dt comes as ISO string from Supabase
    if (!a.dt || !b.dt) return 0;
    return a.dt.localeCompare(b.dt);
  });

  console.log("[Traffic] Timeseries rows (all chunks):", allRows.length);
  return allRows;
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

  console.log("[Traffic] fetchTrafficComparison params:", params);

  const { data, error } = await supabase.rpc("fetch_traffic_comparison", {
    in_old_date: oldDate,
    in_new_date: newDate,
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
  console.log("[Traffic] fetchTrafficGridChange params:", {
    region,
    subregion,
    oldDate,
    newDate,
  });

  const { data, error } = await supabase.rpc("fetch_traffic_grid_change", {
    in_old_date: oldDate,
    in_new_date: newDate,
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
  console.log("[Traffic] fetchTrafficDistrictChange params:", {
    region,
    subregion,
    oldDate,
    newDate,
  });

  const { data, error } = await supabase.rpc("fetch_traffic_district_change", {
    in_old_date: oldDate,
    in_new_date: newDate,
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
/* Small helper: split a date range into smaller chunks to avoid timeouts */
function splitDateRangeIntoChunks(
  dateFrom: string | null | undefined,
  dateTo: string | null | undefined,
  chunkSizeDays = 7 // <= SHRUNK to 7 days to be very safe with 5.1M rows
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

    // next day after this chunk
    cursor = new Date(chunkEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  return ranges;
}

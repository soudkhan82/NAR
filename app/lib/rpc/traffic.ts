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

  const { data, error } = await supabase.rpc("fetch_traffic_timeseries", {
    in_region: region ?? null,
    in_subregion: subregion ?? null,
    in_district: district ?? null,
    in_grid: grid ?? null,
    in_date_from: dateFrom ?? null,
    in_date_to: dateTo ?? null,
  });

  if (error) {
    console.error("fetchTrafficTimeseries error:", error);
    throw new Error(error.message);
  }

  console.log("[Traffic] Timeseries rows:", data);
  return (data ?? []) as TrafficTimeseriesRow[];
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

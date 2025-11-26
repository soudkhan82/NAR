// app/lib/rpc/ranExpansionComparative.ts

import supabase from "@/app/config/supabase-config";

/* ---------- Row types (mirror RPC result shapes) ---------- */

export type RanProjectRow = { Projects: string | null };
export type RegionRow = { Region: string | null };
export type SubRegionRow = { SubRegion: string | null };

export type TrafficAvgRow = {
  indicator: string;
  avg_value: number | null;
};

export type TrafficGridRow = {
  Grid: string | null;
  earliest_date: string | null;
  latest_date: string | null;
  voice_earliest: number | null;
  voice_latest: number | null;
  voice_pct_change: number | null;
  data_earliest: number | null;
  data_latest: number | null;
  data_pct_change: number | null;
  site_count: number | null; // 👈 NEW
};

export type TrafficTimeseriesRow = {
  dt: string;
  TotalVoiceTraffic_Erl: number | null;
  Total_Traffic_GB: number | null;
};

export type FilterParams = {
  projects: string[] | null;
  region: string | null;
  subregion: string | null;
  startDate: string | null;
  endDate: string | null;
};

/* ---------- Simple lookups ---------- */

export async function fetchRanProjects(): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ran_projects");

  if (error) throw error;

  const rows = (data ?? []) as RanProjectRow[];

  return rows
    .map((row: RanProjectRow) => row.Projects)
    .filter((p): p is string => !!p);
}

export async function fetchEarliestIntegrationDate(
  projects: string[] | null
): Promise<string | null> {
  const { data, error } = await supabase.rpc("fetch_integration_min_date", {
    in_projects: projects && projects.length > 0 ? projects : null,
  });

  if (error) throw error;

  // Supabase rpc data is the raw scalar (date string or null)
  return data as string | null;
}

export async function fetchLatestTrafficDate(
  projects: string[] | null
): Promise<string | null> {
  const { data, error } = await supabase.rpc("fetch_traffic_latest_date", {
    in_projects: projects && projects.length > 0 ? projects : null,
  });

  if (error) throw error;

  return data as string | null;
}

export async function fetchRanRegions(): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ran_regions");

  if (error) throw error;

  const rows = (data ?? []) as RegionRow[];

  return rows.map((r: RegionRow) => r.Region).filter((r): r is string => !!r);
}

export async function fetchRanSubregionsByRegion(
  region: string | null
): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ran_subregions_by_region", {
    in_region: region,
  });

  if (error) throw error;

  const rows = (data ?? []) as SubRegionRow[];

  return rows
    .map((s: SubRegionRow) => s.SubRegion)
    .filter((s): s is string => !!s);
}

/* ---------- Main data fetchers ---------- */

export async function fetchTrafficAverages(
  params: FilterParams
): Promise<TrafficAvgRow[]> {
  const { projects, region, subregion, startDate, endDate } = params;

  const { data, error } = await supabase.rpc(
    "fetch_traffic_indicator_averages",
    {
      in_projects: projects && projects.length > 0 ? projects : null,
      in_region: region,
      in_subregion: subregion,
      in_start_date: startDate,
      in_end_date: endDate,
    }
  );

  if (error) throw error;

  return ((data ?? []) as TrafficAvgRow[]).map((row: TrafficAvgRow) => ({
    indicator: row.indicator,
    avg_value: row.avg_value,
  }));
}

export async function fetchTrafficGridComparison(
  params: FilterParams
): Promise<TrafficGridRow[]> {
  const { projects, region, subregion, startDate, endDate } = params;

  const { data, error } = await supabase.rpc("fetch_traffic_grid_comparison", {
    in_projects: projects && projects.length > 0 ? projects : null,
    in_region: region,
    in_subregion: subregion,
    in_start_date: startDate,
    in_end_date: endDate,
  });

  if (error) throw error;

  return ((data ?? []) as TrafficGridRow[]).map((row) => ({
    Grid: row.Grid,
    earliest_date: row.earliest_date,
    latest_date: row.latest_date,
    voice_earliest: row.voice_earliest,
    voice_latest: row.voice_latest,
    voice_pct_change: row.voice_pct_change,
    data_earliest: row.data_earliest,
    data_latest: row.data_latest,
    data_pct_change: row.data_pct_change,
    site_count: row.site_count, // 👈 NEW
  }));
}

export async function fetchTrafficTimeseries(
  params: FilterParams
): Promise<TrafficTimeseriesRow[]> {
  const { projects, region, subregion, startDate, endDate } = params;

  const { data, error } = await supabase.rpc("fetch_traffic_timeseries", {
    in_projects: projects && projects.length > 0 ? projects : null,
    in_region: region,
    in_subregion: subregion,
    in_start_date: startDate,
    in_end_date: endDate,
  });

  if (error) throw error;

  return ((data ?? []) as TrafficTimeseriesRow[]).map(
    (row: TrafficTimeseriesRow) => ({
      dt: row.dt,
      TotalVoiceTraffic_Erl: row.TotalVoiceTraffic_Erl,
      Total_Traffic_GB: row.Total_Traffic_GB,
    })
  );
}

export async function fetchRanSiteCount(params: FilterParams): Promise<number> {
  const { projects, region, subregion } = params;

  const { data, error } = await supabase.rpc("fetch_ran_site_count", {
    in_projects: projects && projects.length > 0 ? projects : null,
    in_region: region,
    in_subregion: subregion,
  });

  if (error) throw error;

  return (data as number | null) ?? 0;
}

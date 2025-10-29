// app/lib/rpc/gis/gis_avail.ts
import supabase from "@/app/config/supabase-config";

/* ============== Types ============== */
export type MapPoint = {
  site_id: string;
  sitename: string;
  district: string | null;
  grid: string | null;
  subregion: string | null;
  region: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
};

/** Enriched map point with SiteClassification (joined from SSL by SiteName) */
export type MapPointEx = MapPoint & {
  site_classification: string | null;
};

export type AvPoint = {
  dt: string; // ISO date
  overall: number | null;
  v2g: number | null;
  v3g: number | null;
  v4g: number | null;
};

export type DistrictAvg = {
  district: string | null;
  avg_overall: number | null;
};

export type GridAvg = {
  grid: string | null;
  avg_overall: number | null;
};

export type FilterState = {
  region: string | null; // keep in shape for RPCs; you can pass null
  subregion: string | null;
  district: string | null;
  grid: string | null;
  sitename: string | null; // SiteName filter (optional)
  days?: number; // default 30
};

/* ============== Internal helpers ============== */

/** Bulk fetch SiteClassification for a list of SSL.SiteName values. */
async function fetchClassMapBySiteNames(
  siteNames: string[]
): Promise<Record<string, string | null>> {
  const unique = Array.from(new Set(siteNames.filter(Boolean)));
  if (unique.length === 0) return {};

  const { data, error } = await supabase
    .from("SSL")
    .select("SiteName, SiteClassification")
    .in("SiteName", unique);

  if (error) throw error;

  const map: Record<string, string | null> = {};
  for (const row of (data ?? []) as Array<{
    SiteName: string;
    SiteClassification: string | null;
  }>) {
    map[row.SiteName] = row.SiteClassification ?? null;
  }
  return map;
}

/* ============== GIS data RPCs ============== */

/** Raw points from your RPC (no classification attached). */
export async function fetchMapPoints(f: FilterState): Promise<MapPoint[]> {
  const { data, error } = await supabase.rpc("gis_av_map_points", {
    p_region: f.region ?? null,
    p_subregion: f.subregion ?? null,
    p_district: f.district ?? null,
    p_grid: f.grid ?? null,
    p_sitename: f.sitename ?? null,
    p_days: f.days ?? 30,
  });
  if (error) throw error;
  return (data ?? []) as MapPoint[];
}

/** Enriched points with site_classification (Cell_Avail.SITEID -> SSL.SiteName). */
export async function fetchMapPointsEnriched(
  f: FilterState
): Promise<MapPointEx[]> {
  const base = await fetchMapPoints(f);
  const nameMap = await fetchClassMapBySiteNames(base.map((p) => p.sitename));
  return base.map((p) => ({
    ...p,
    site_classification: p.sitename ? nameMap[p.sitename] ?? null : null,
  }));
}

export async function fetchTimeseries(
  siteId: string,
  days = 30
): Promise<AvPoint[]> {
  const { data, error } = await supabase.rpc("gis_av_timeseries", {
    p_site_id: siteId,
    p_days: days,
  });
  if (error) throw error;
  return (data ?? []) as AvPoint[];
}

export async function fetchDistrictAverages(
  f: FilterState
): Promise<DistrictAvg[]> {
  const { data, error } = await supabase.rpc("gis_av_district_avg", {
    p_region: f.region ?? null,
    p_subregion: f.subregion ?? null,
    p_district: f.district ?? null,
    p_grid: f.grid ?? null,
    p_sitename: f.sitename ?? null,
    p_days: f.days ?? 30,
  });
  if (error) throw error;
  return (data ?? []) as DistrictAvg[];
}

export async function fetchGridAverages(f: FilterState): Promise<GridAvg[]> {
  const { data, error } = await supabase.rpc("gis_av_grid_avg", {
    p_region: f.region ?? null,
    p_subregion: f.subregion ?? null,
    p_district: f.district ?? null,
    p_grid: f.grid ?? null,
    p_sitename: f.sitename ?? null,
    p_days: f.days ?? 30,
  });
  if (error) throw error;
  return (data ?? []) as GridAvg[];
}

/* ============== SSL picklists (your SQL functions) ============== */

export async function fetchSslSubregions(): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_subregions");
  if (error) throw error;
  return (data ?? []).map((r: { subregion: string }) => r.subregion);
}

export async function fetchSslGrids(
  in_subregion: string | null
): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_grids", {
    in_subregion: in_subregion ?? null,
  });
  if (error) throw error;
  return (data ?? []).map((r: { grid: string }) => r.grid);
}

export async function fetchSslDistricts(
  in_subregion: string | null,
  in_grid: string | null
): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_districts", {
    in_subregion: in_subregion ?? null,
    in_grid: in_grid ?? null,
  });
  if (error) throw error;
  return (data ?? []).map((r: { district: string }) => r.district);
}

/** SiteName search (autocomplete), scoped by SubRegion/Grid/District */
export async function searchSslSites(
  query: string | null,
  in_subregion: string | null,
  in_grid: string | null,
  in_district: string | null,
  limit = 20
): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_sitenames", {
    in_query: query ?? null,
    in_subregion: in_subregion ?? null,
    in_grid: in_grid ?? null,
    in_district: in_district ?? null,
    in_limit: limit,
  });
  if (error) throw error;
  return (data ?? []).map((r: { sitename: string }) => r.sitename);
}

/** SiteClassification picklist (from your SQL) */
export async function fetchSslSiteClasses(): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_site_classes");
  if (error) throw error;
  return (data ?? []).map((r: { site_class: string }) => r.site_class);
}

/** (Optional) Single-site classification lookup by SSL.SiteName */
export async function fetchSiteClassification(
  sitename: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("SSL")
    .select("SiteClassification")
    .eq("SiteName", sitename)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.SiteClassification as string | null) ?? null;
}

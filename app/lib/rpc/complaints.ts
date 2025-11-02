import supabase from "@/app/config/supabase-config";

/* --------- Types mirroring RPC outputs --------- */
export interface SiteAggRow {
  SiteName: string;
  Region: string | null;
  SubRegion: string | null;
  District: string | null;
  Grid: string | null;
  Latitude: number | null;
  Longitude: number | null;
  Address: string | null; // <-- NEW
  complaints_count: number;
}

export interface TsRow {
  d: string; // ISO date (yyyy-mm-dd)
  complaints_count: number;
}

export interface ServiceBadgeRow {
  SERVICETITLE: string | null;
  complaints_count: number;
}

export interface NeighborRow {
  NeighborSiteName: string;
  Latitude: number | null;
  Longitude: number | null;
  District: string | null;           // <-- NEW
  Grid: string | null;               // <-- NEW
  Address: string | null;            // <-- NEW
  distance_km: number;
}

/* --------- Small helper to surface real errors --------- */
function explainError(e: unknown): Error {
  const anyE = e as any;
  const code = anyE?.code ?? anyE?.status ?? anyE?.name ?? "UNKNOWN";
  const msg =
    anyE?.message ??
    anyE?.error_description ??
    anyE?.hint ??
    anyE?.details ??
    (typeof anyE === "string" ? anyE : "");
  return new Error(`[${code}] ${msg}`);
}

/* ===================== Picklists ===================== */

export async function fetchRegions(): Promise<string[]> {
  const { data, error } = await supabase.rpc("ssl_regions");
  if (error) throw explainError(error);
  const rows = (data ?? []) as Array<{ Region: string | null }>;
  return rows
    .map((r) => r.Region)
    .filter((v): v is string => typeof v === "string");
}

export async function fetchSubregions(
  region: string | null
): Promise<string[]> {
  const { data, error } = await supabase.rpc("ssl_subregions", {
    p_region: region,
  });
  if (error) throw explainError(error);
  const rows = (data ?? []) as Array<{ SubRegion: string | null }>;
  return rows
    .map((r) => r.SubRegion)
    .filter((v): v is string => typeof v === "string");
}

export async function fetchDistricts(
  region: string | null,
  subregion: string | null
): Promise<string[]> {
  const { data, error } = await supabase.rpc("ssl_districts", {
    p_region: region,
    p_subregion: subregion,
  });
  if (error) throw explainError(error);
  const rows = (data ?? []) as Array<{ District: string | null }>;
  return rows
    .map((r) => r.District)
    .filter((v): v is string => typeof v === "string");
}

export async function fetchGrids(
  region: string | null,
  subregion: string | null,
  district: string | null
): Promise<string[]> {
  const { data, error } = await supabase.rpc("ssl_grids", {
    p_region: region,
    p_subregion: subregion,
    p_district: district,
  });
  if (error) throw explainError(error);
  const rows = (data ?? []) as Array<{ Grid: string | null }>;
  return rows
    .map((r) => r.Grid)
    .filter((v): v is string => typeof v === "string");
}

/* ===================== Data ===================== */

export async function fetchSitesAgg(params: {
  region: string | null;
  subregion: string | null;
  district: string | null;
  grid: string | null;
  limit?: number;
}): Promise<SiteAggRow[]> {
  const { data, error } = await supabase.rpc("complaints_sites_agg", {
    p_region: params.region,
    p_subregion: params.subregion,
    p_district: params.district,
    p_grid: params.grid,
    p_limit: params.limit ?? 1000,
  });
  if (error) throw explainError(error);
  return (data ?? []) as SiteAggRow[];
}

export async function fetchTimeseries(
  siteIdBigint: number,
  dateFrom: string | null = null,
  dateTo: string | null = null
): Promise<TsRow[]> {
  const { data, error } = await supabase.rpc("complaints_timeseries", {
    p_site: siteIdBigint,
    p_date_from: dateFrom,
    p_date_to: dateTo,
  });
  if (error) throw explainError(error);
  return (data ?? []) as TsRow[];
}

export async function fetchServiceBadges(
  siteIdBigint: number,
  dateFrom: string | null = null,
  dateTo: string | null = null
): Promise<ServiceBadgeRow[]> {
  const { data, error } = await supabase.rpc("complaints_services_breakdown", {
    p_site: siteIdBigint,
    p_date_from: dateFrom,
    p_date_to: dateTo,
  });
  if (error) throw explainError(error);
  return (data ?? []) as ServiceBadgeRow[];
}

export async function fetchNeighbors(
  siteIdBigint: number,
  maxKm = 5
): Promise<NeighborRow[]> {
  const { data, error } = await supabase.rpc(
    "complaints_neighbors_within_5km",
    {
      p_site: siteIdBigint,
      p_max_km: maxKm,
    }
  );
  if (error) throw explainError(error);
  return (data ?? []) as NeighborRow[];
}

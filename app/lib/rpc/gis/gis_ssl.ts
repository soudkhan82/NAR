import supabase from "@/app/config/supabase-config";

/* ---------------- Types ---------------- */
export type MapPointEx = {
  site_id: string; // SSL."SiteName"
  sitename: string | null; // same as site_id
  subregion: string | null; // SSL."SubRegion"
  district: string | null; // SSL."District"
  grid: string | null; // SSL."Grid"
  latitude: number | null; // SSL."Latitude"
  longitude: number | null; // SSL."Longitude"
  address: string | null; // SSL."Address"
  site_classification: string | null;
};

export type FilterState = {
  region: string | null;
  subregion: string | null;
  district: string | null;
  grid: string | null;
  sitename: string | null;
};

/* ---------------- helpers ---------------- */
const logRpcError = (label: string, error: unknown) => {
  try {
    const e = error as any;
    // eslint-disable-next-line no-console
    console.error(`${label}:`, {
      message: e?.message ?? null,
      details: e?.details ?? null,
      hint: e?.hint ?? null,
      code: e?.code ?? null,
    });
  } catch {
    // eslint-disable-next-line no-console
    console.error(label, error);
  }
};

/* ------------- Map points (FAST: SSL only, with backoff) ------------- */
/**
 * Calls public.fetch_ssl_points (no availability joins).
 * Defaults SubRegion to "North-1" if not provided.
 * Retries with _limit 500 → 200 → 100 on timeout (57014).
 */
export async function fetchMapPointsEnriched(
  filters: FilterState
): Promise<MapPointEx[]> {
  const { region, subregion, district, grid, sitename } = filters;
  const effectiveSubregion = subregion ?? "North-1";

  const tryOnce = async (_limit: number) =>
    supabase.rpc("fetch_ssl_points", {
      _region: region,
      _subregion: effectiveSubregion,
      _district: district,
      _grid: grid ?? null,
      _sitename: sitename,
      _limit,
    });

  for (const lim of [1500, 200, 100]) {
    const { data, error } = await tryOnce(lim);
    if (!error) return (data ?? []) as MapPointEx[];
    logRpcError(`fetch_ssl_points error (limit=${lim})`, error);
    if ((error as any)?.code !== "57014") return [];
  }
  return [];
}

/* ------------- Picklists via SQL FUNCTIONS ------------- */
export async function fetchSslSubregions(): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_subregions", {});
  if (error) {
    logRpcError("fetch_ssl_subregions error", error);
    return [];
  }
  return (data ?? []).map((r: any) => r.subregion as string);
}

export async function fetchSslGrids(
  subregion: string | null
): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_grids", {
    in_subregion: subregion ?? null,
  });
  if (error) {
    logRpcError("fetch_ssl_grids error", error);
    return [];
  }
  return (data ?? []).map((r: any) => r.grid as string);
}

export async function fetchSslDistricts(
  subregion: string | null,
  grid: string | null
): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_districts", {
    in_subregion: subregion ?? null,
    in_grid: grid ?? null,
  });
  if (error) {
    logRpcError("fetch_ssl_districts error", error);
    return [];
  }
  return (data ?? []).map((r: any) => r.district as string);
}

export async function searchSslSites(
  q: string,
  subregion: string | null,
  grid: string | null,
  district: string | null,
  limit = 15
): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_sitenames", {
    in_query: q || null,
    in_subregion: subregion || null,
    in_grid: grid || null,
    in_district: district || null,
    in_limit: limit,
  });
  if (error) {
    logRpcError("fetch_ssl_sitenames error", error);
    return [];
  }
  return (data ?? []).map((r: any) => r.sitename as string);
}

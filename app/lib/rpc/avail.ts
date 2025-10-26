// app/lib/rpc.ts
import supabase from "@/app/config/supabase-config";

export type BundleFilters = {
  subregion?: string | null;
  grid?: string | null;
  district?: string | null;
  sitename?: string | null;
  dateFrom?: string | null; // "YYYY-MM-DD"
  dateTo?: string | null; // "YYYY-MM-DD"
};

export type NameValue = { name: string; value: number | null };

export type BundleResult = {
  cards: BundleCards;
  daily: DailyPoint[];
  weekly: WeeklyPoint[];
  by_district: NameValue[];
};

export type BundleCards = {
  site_count: number | null;
  avg_pgs: number | null;
  avg_sb: number | null;
};
export type DailyPoint = {
  date: string;
  pgs: number | null;
  sb: number | null;
};
export type WeeklyPoint = {
  week: string;
  pgs: number | null;
  sb: number | null;
};

export async function fetchCellAvailBundle(
  filters: BundleFilters
): Promise<BundleResult> {
  const { data, error } = await supabase.rpc("fetch_cell_avail_bundle", {
    in_subregion: filters.subregion ?? null,
    in_grid: filters.grid ?? null,
    in_district: filters.district ?? null,
    in_sitename: filters.sitename ?? null,
    in_date_from: filters.dateFrom ?? null,
    in_date_to: filters.dateTo ?? null,
  });
  if (error)
    throw new Error(`fetch_cell_avail_bundle failed: ${error.message}`);

  const cards = (data?.cards ?? {}) as BundleCards;
  const daily = (data?.daily ?? []) as DailyPoint[];
  const weekly = (data?.weekly ?? []) as WeeklyPoint[];
  const by_district = (data?.by_district ?? []) as NameValue[];
  const by_grid = (data?.by_grid ?? []) as NameValue[];

  return {
    cards: {
      site_count: cards.site_count ?? 0,
      avg_pgs: cards.avg_pgs ?? null,
      avg_sb: cards.avg_sb ?? null,
    },
    daily,
    weekly,
    by_district,
  };
}

/* --- filter option fetchers --- */
export async function fetchSubregions(): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_subregions");
  if (error) throw error;
  return (data ?? []).map((r: { subregion: string }) => r.subregion);
}

export async function fetchGrids(subregion?: string | null): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_grids", {
    in_subregion: subregion ?? null,
  });
  if (error) throw error;
  return (data ?? []).map((r: { grid: string }) => r.grid);
}

export async function fetchDistricts(
  subregion?: string | null,
  grid?: string | null
): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_districts", {
    in_subregion: subregion ?? null,
    in_grid: grid ?? null,
  });
  if (error) throw error;
  return (data ?? []).map((r: { district: string }) => r.district);
}

export async function fetchSiteNames(
  query?: string | null,
  subregion?: string | null,
  grid?: string | null,
  district?: string | null
): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_sitenames", {
    in_query: query ?? null,
    in_subregion: subregion ?? null,
    in_grid: grid ?? null,
    in_district: district ?? null,
    in_limit: 20,
  });
  if (error) throw error;
  return (data ?? []).map((r: { sitename: string }) => r.sitename);
}




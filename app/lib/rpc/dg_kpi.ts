import supabase from "@/app/config/supabase-config";

// --- Types ---

export type SummaryFiltered = {
  distinct_engines: number;
  total_fuel: number;
  valid_fueling_entries: number; // For accurate Average calculation
  target_achieved: number;
  base_achieved: number;
  below_base: number;
  no_fueling: number;
};

export type BreakdownFilteredRow = {
  Region: string;
  SubRegion: string;
  target_achieved: number;
  base_achieved: number;
  below_base: number;
  no_fueling: number;
  total_count: number;
};

// --- Fetching Functions ---

/**
 * Fetches the minimum and maximum month available in the dataset
 */
export async function fetchDateBounds() {
  const { data, error } = await supabase.rpc("fetch_dg_date_bounds");
  if (error) throw error;
  return data?.[0] as { min_date: string; max_date: string } | null;
}

/**
 * Fetches a list of all unique regions
 */
export async function fetchRegions(): Promise<{ region: string }[]> {
  const { data, error } = await supabase.rpc("fetch_dg_regions");
  if (error) throw error;
  return (data ?? []) as { region: string }[];
}

/**
 * Fetches unique subregions, optionally filtered by region
 */
export async function fetchSubRegions(
  region: string | null
): Promise<{ subregion: string }[]> {
  const { data, error } = await supabase.rpc("fetch_dg_subregions", {
    p_region: region,
  });
  if (error) throw error;
  return (data ?? []) as { subregion: string }[];
}

/**
 * Fetches aggregated summary data for the top KPI cards
 */
export async function fetchSummaryFiltered(params: {
  region: string | null;
  subRegion: string | null;
  startDate: string | null;
  endDate: string | null;
}): Promise<SummaryFiltered> {
  const { data, error } = await supabase.rpc("fetch_dg_kpi_summary_filtered", {
    p_region: params.region,
    p_subregion: params.subRegion,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
  });

  if (error) throw error;
  const r = data?.[0];

  return {
    distinct_engines: Number(r?.distinct_engines ?? 0),
    total_fuel: Number(r?.total_fuel ?? 0),
    valid_fueling_entries: Number(r?.valid_fueling_entries ?? 0),
    target_achieved: Number(r?.target_achieved ?? 0),
    base_achieved: Number(r?.base_achieved ?? 0),
    below_base: Number(r?.below_base ?? 0),
    no_fueling: Number(r?.no_fueling ?? 0),
  };
}

/**
 * Fetches breakdown data per sub-region for charts and tables
 */
export async function fetchBreakdownFiltered(params: {
  region: string | null;
  subRegion: string | null;
  startDate: string | null;
  endDate: string | null;
}): Promise<BreakdownFilteredRow[]> {
  const { data, error } = await supabase.rpc(
    "fetch_dg_status_breakdown_filtered",
    {
      p_region: params.region,
      p_subregion: params.subRegion,
      p_start_date: params.startDate,
      p_end_date: params.endDate,
    }
  );

  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    Region: r.region ?? "Unknown",
    SubRegion: r.subregion ?? "Unknown",
    target_achieved: Number(r.target_achieved ?? 0),
    base_achieved: Number(r.base_achieved ?? 0),
    below_base: Number(r.below_base ?? 0),
    no_fueling: Number(r.no_fueling ?? 0),
    total_count: Number(r.total_count ?? 0),
  }));
}

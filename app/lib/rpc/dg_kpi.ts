import supabase from "@/app/config/supabase-config";

/** ---------- Types ---------- */

export type RegionRollupRow = {
  region: "North" | "Central" | "South" | "NWD" | string;
  date: string; // yyyy-mm-dd
  no_fueling: number | null;
  below_base: number | null;
  base_achieved: number | null;
  target_achieved: number | null;
  target_achieved_pct: number | null;
  total_dg_count: number | null;
  fuel_filled_dg_count: number | null;
  total_fueling: number | null;
  avg_fueling_on_fuel_filled: number | null;
  target: number | null;
  base: number | null;
  final_score: string | null;
  achievement_status: string | null;
  sort_key?: number | null;
};

export type SubregionRow = {
  subregion: string;
  date: string;
  no_fueling: number | null;
  below_base: number | null;
  base_achieved: number | null;
  target_achieved: number | null;
  target_achieved_pct: number | null;
  total_dg_count: number | null;
  fuel_filled_dg_count: number | null;
  total_fueling: number | null;
  avg_fueling_on_fuel_filled: number | null;
  target: number | null;
  base: number | null;
  final_score: number | null;
  achievement_status: string | null;
};

export type SiteKpiRow = {
  dg_engine_no: string | null;
  subregion: string | null;
  region: string | null;
  total_fuel_consumed: number | null;
  regional_target_fuel: number | null;
  regional_base_fuel: number | null;
  average_dg_fuel_target: string | null;
  dg_month: string | null;
  dg_kpi_score: number | null;
};

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

/** ---------- RPC wrappers ---------- */

export async function fetchRegionNwdRollup(params: {
  date: string;
}): Promise<RegionRollupRow[]> {
  const { data, error } = await supabase.rpc("fetch_dg_kpi_region_nwd", {
    p_date: params.date,
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    region: String(r.region ?? ""),
    date: String(r.date ?? params.date),
    no_fueling: num(r.no_fueling),
    below_base: num(r.below_base),
    base_achieved: num(r.base_achieved),
    target_achieved: num(r.target_achieved),
    target_achieved_pct: num(r.target_achieved_pct),
    total_dg_count: num(r.total_dg_count),
    fuel_filled_dg_count: num(r.fuel_filled_dg_count),
    total_fueling: num(r.total_fueling),
    avg_fueling_on_fuel_filled: num(r.avg_fueling_on_fuel_filled),
    target: num(r.target),
    base: num(r.base),
    final_score: str(r.final_score),
    achievement_status: str(r.achievement_status),
    sort_key: num(r.sort_key),
  }));
}

export async function fetchDgSubregions(params: {
  region: "North" | "Central" | "South" | null;
}): Promise<{ subregion: string }[]> {
  const { data, error } = await supabase.rpc("fetch_dg_kpi_subregions", {
    p_region: params.region,
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    subregion: String(r.subregion ?? ""),
  }));
}

export async function fetchDgSubregionRows(params: {
  date: string;
  region: "North" | "Central" | "South" | null;
  subregion: string | null;
}): Promise<SubregionRow[]> {
  const { data, error } = await supabase.rpc("fetch_dg_kpi_subregion_rows", {
    p_date: params.date,
    p_region: params.region,
    p_subregion: params.subregion,
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    subregion: String(r.subregion ?? ""),
    date: String(r.date ?? params.date),
    no_fueling: num(r.no_fueling),
    below_base: num(r.below_base),
    base_achieved: num(r.base_achieved),
    target_achieved: num(r.target_achieved),
    target_achieved_pct: num(r.target_achieved_pct),
    total_dg_count: num(r.total_dg_count),
    fuel_filled_dg_count: num(r.fuel_filled_dg_count),
    total_fueling: num(r.total_fueling),
    avg_fueling_on_fuel_filled: num(r.avg_fueling_on_fuel_filled),
    target: num(r.target),
    base: num(r.base),
    final_score: num(r.final_score),
    achievement_status: str(r.achievement_status),
  }));
}

/** ---------- Site table (DG_KPI) ---------- */
export async function fetchDgKpiSites(params: {
  date: string;
  region?: string | null;
  subregion?: string | null;
}): Promise<SiteKpiRow[]> {
  let query = supabase
    .from("DG_KPI")
    .select(
      `
      DG_EngineNo,
      SubRegion,
      Region,
      Total_Fuel_Consumed,
      Regional_Target_Fuel,
      Regional_Base_Fuel,
      Average_DG_Fuel_Target,
      DG_Month,
      DG_KPI_Score
    `
    )
    .eq("DG_Month", params.date);

  if (params.subregion) {
    query = query.eq("SubRegion", params.subregion);
  } else if (params.region && params.region !== "ALL") {
    query = query.eq("Region", params.region);
  }

  const { data, error } = await query.order("DG_KPI_Score", {
    ascending: true,
    nullsFirst: false,
  });

  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    dg_engine_no: str(r.DG_EngineNo),
    subregion: str(r.SubRegion),
    region: str(r.Region),
    total_fuel_consumed: num(r.Total_Fuel_Consumed),
    regional_target_fuel: num(r.Regional_Target_Fuel),
    regional_base_fuel: num(r.Regional_Base_Fuel),
    average_dg_fuel_target: str(r.Average_DG_Fuel_Target),
    dg_month: str(r.DG_Month),
    dg_kpi_score: num(r.DG_KPI_Score),
  }));
}

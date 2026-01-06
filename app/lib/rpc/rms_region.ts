// app/lib/rpc/rms_region.ts
import { createClient } from "@supabase/supabase-js";

export type RmsRegionSummaryRow = {
  region: string | null;

  overall_sites_count: number | null;
  rms_sites_count: number | null;
  rms_disconnected_count: number | null;

  ip_connectivity_yes: number | null;
  ip_connectivity_no: number | null;

  phase_1_missing: number | null;
  phase_2_missing: number | null;

  battery_health_lt70: number | null;

  smr_shortfall_count: number | null;
  critical_shortfall_count: number | null;
  extra_smr_count: number | null;

  ac_spd_normal: number | null;
  ac_spd_abnormal: number | null;
};

export type RmsSubregionSummaryRow = {
  region: string | null;
  subregion: string | null;

  overall_sites_count: number | null;
  rms_sites_count: number | null;
  rms_disconnected_count: number | null;

  ip_connectivity_yes: number | null;
  ip_connectivity_no: number | null;

  phase_1_missing: number | null;
  phase_2_missing: number | null;

  battery_health_lt70: number | null;

  smr_shortfall_count: number | null;
  critical_shortfall_count: number | null;
  extra_smr_count: number | null;

  ac_spd_normal: number | null;
  ac_spd_abnormal: number | null;
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function fetchRmsRegionSummary(): Promise<RmsRegionSummaryRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("fetch_rms_region_summary");
  if (error) throw new Error(error.message);
  return (data ?? []) as RmsRegionSummaryRow[];
}

export async function fetchRmsSubregionSummaryByRegion(
  region: string
): Promise<RmsSubregionSummaryRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc(
    "fetch_rms_subregion_summary_by_region",
    { p_region: region }
  );
  if (error) throw new Error(error.message);
  return (data ?? []) as RmsSubregionSummaryRow[];
}

// app/rms-summary/page.ts
import { createClient } from "@supabase/supabase-js";

export type RmsSummaryRow = {
  region: string | null;
  subregion: string | null;

  overall_sites_count: number;
  rms_sites_count: number;
  rms_disconnected_count: number;

  ip_connectivity_yes: number;
  ip_connectivity_no: number;

  phase_1_missing: number;
  phase_2_missing: number;

  battery_health_lt70: number;

  smr_shortfall_count: number;
  critical_shortfall_count: number;
  extra_smr_count: number;

  ac_spd_normal: number;
  ac_spd_abnormal: number;
};

export async function fetchRmsSubregionSummary() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from("v_rms_subregion_summary")
    .select("*")
    .order("region", { ascending: true })
    .order("subregion", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []) as RmsSummaryRow[];
}

// app/lib/rpc/cp_units.ts
import supabase from "@/app/config/supabase-config";

export type CpUnitsSummaryRow = {
  region: string;
  subregion: string;
  site_count: number;
  sum_kwh: number | null;
  avg_base: number | null;
  avg_target: number | null;

  // ✅ NEW: coming from RPC
  avg_score: number | null;

  target_achieved: number;
  base_achieved: number;
  target_and_base_not_achieved: number;
  zero_or_null_kwh: number;
};

export async function fetchRegions() {
  const { data, error } = await supabase.rpc("fetch_ssl_regions");
  if (error) throw error;
  return (data ?? []) as { region: string }[];
}

export async function fetchSubregions() {
  const { data, error } = await supabase.rpc("fetch_ssl_subregions");
  if (error) throw error;
  return (data ?? []) as { subregion: string }[];
}

export async function fetchCpMonths(params: {
  region?: string | null;
  subregion?: string | null;
}) {
  const { data, error } = await supabase.rpc("fetch_cp_units_months", {
    p_region: params.region ?? null,
    p_subregion: params.subregion ?? null,
  });
  if (error) throw error;
  return (data ?? []) as { month: string }[];
}

/**
 * IMPORTANT:
 * Summary RPC signature is (p_month, p_region, p_subregion)
 * Always send p_month first.
 */
export async function fetchCpUnitsSummary(params: {
  region?: string | null;
  subregion?: string | null;
  month?: string | null;
}) {
  const { data, error } = await supabase.rpc("fetch_cp_units_summary", {
    p_month: params.month ?? null,
    p_region: params.region ?? null,
    p_subregion: params.subregion ?? null,
  });
  if (error) throw error;
  return (data ?? []) as CpUnitsSummaryRow[];
}

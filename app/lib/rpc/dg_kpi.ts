// app/lib/rpc/dg_kpi.ts
import supabase from "@/app/config/supabase-config";

/* -------------------- Types -------------------- */

export type FuelStatus =
  | "No Fueling"
  | "Target Achieved"
  | "Below Base"
  | "Between Base & Target";

export type SummaryFiltered = {
  distinct_engines: number;
  avg_fuel: number | null;
  target_achieved: number;
  below_base: number;
  no_fueling: number;
};

export type BreakdownFilteredRow = {
  region: string | null;
  subregion: string | null;
  distinct_engines: number;
  no_fueling: number;
  target_achieved: number;
  below_base: number;
};

export type FilterParams = {
  region?: string | null;
  subRegion?: string | null;
  month?: string | null;
};

/* -------------------- RPC: Dropdowns -------------------- */

export async function fetchRegions(): Promise<{ region: string }[]> {
  const { data, error } = await supabase.rpc("fetch_dg_regions");
  if (error) throw error;
  return (data ?? []) as { region: string }[];
}

export async function fetchSubRegions(
  region: string | null
): Promise<{ subregion: string }[]> {
  const { data, error } = await supabase.rpc("fetch_dg_subregions", {
    p_region: region,
  });
  if (error) throw error;
  return (data ?? []) as { subregion: string }[];
}

export async function fetchMonths(params: {
  region?: string | null;
  subRegion?: string | null;
}): Promise<{ month: string }[]> {
  const { data, error } = await supabase.rpc("fetch_dg_months", {
    p_region: params.region ?? null,
    p_subregion: params.subRegion ?? null,
  });
  if (error) throw error;
  return (data ?? []) as { month: string }[];
}

/* -------------------- RPC: Aggregates (NO 1000 LIMIT) -------------------- */

export async function fetchSummaryFiltered(params: FilterParams) {
  const { data, error } = await supabase.rpc("fetch_dg_kpi_summary_filtered", {
    p_region: params.region ?? null,
    p_subregion: params.subRegion ?? null,
    p_month: params.month ?? null,
  });

  if (error) throw error;

  const row = (data?.[0] ?? null) as any;
  return {
    distinct_engines: Number(row?.distinct_engines ?? 0),
    avg_fuel:
      row?.avg_fuel === null || row?.avg_fuel === undefined
        ? null
        : Number(row.avg_fuel),
    target_achieved: Number(row?.target_achieved ?? 0),
    below_base: Number(row?.below_base ?? 0),
    no_fueling: Number(row?.no_fueling ?? 0),
  } as SummaryFiltered;
}

export async function fetchBreakdownFiltered(params: FilterParams) {
  const { data, error } = await supabase.rpc(
    "fetch_dg_status_breakdown_filtered",
    {
      p_region: params.region ?? null,
      p_subregion: params.subRegion ?? null,
      p_month: params.month ?? null,
    }
  );

  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    region: r.region ?? null,
    subregion: r.subregion ?? null,
    distinct_engines: Number(r.distinct_engines ?? 0),
    no_fueling: Number(r.no_fueling ?? 0),
    target_achieved: Number(r.target_achieved ?? 0),
    below_base: Number(r.below_base ?? 0),
  })) as BreakdownFilteredRow[];
}

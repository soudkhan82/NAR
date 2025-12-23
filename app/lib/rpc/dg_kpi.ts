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
  subregion: string | null;
  target_achieved: number;
  below_base: number;
  no_fueling: number;
};

export type DetailRow = {
  dg_engineno: string;
  region: string | null;
  subregion: string | null;
  month: string | null;
  total_fuel: number | null;
  regional_target: number | null;
  regional_base: number | null;
  fuel_status: FuelStatus;
};

export type DetailsPagedResponse = {
  total: number;
  rows: DetailRow[];
};

export type FilterParams = {
  region?: string | null;
  subRegion?: string | null;
  month?: string | null;
};

export type DetailsPagedParams = FilterParams & {
  search?: string | null;
  status?: FuelStatus | null; // server-side status filter
  limit: number;
  offset: number;
};

/* -------------------- Helpers -------------------- */

const clean = (s: string | null | undefined) => (s ?? "").trim();

/* -------------------- Dropdowns (DIRECT: safe, small distinct sets) -------------------- */

export async function fetchRegionsDirect(): Promise<string[]> {
  const { data, error } = await supabase
    .from("DG_KPI")
    .select("Region")
    .not("Region", "is", null);

  if (error) throw error;

  const set = new Set<string>();
  for (const r of data ?? []) {
    const v = clean((r as any).Region);
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export async function fetchSubRegionsDirect(
  region: string | null
): Promise<string[]> {
  let q = supabase
    .from("DG_KPI")
    .select("SubRegion")
    .not("SubRegion", "is", null);
  if (region) q = q.eq("Region", region);

  const { data, error } = await q;
  if (error) throw error;

  const set = new Set<string>();
  for (const r of data ?? []) {
    const v = clean((r as any).SubRegion);
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export async function fetchMonthsDirect(
  params: FilterParams
): Promise<string[]> {
  let q = supabase.from("DG_KPI").select("Month").not("Month", "is", null);

  if (params.region) q = q.eq("Region", params.region);
  if (params.subRegion) q = q.eq("SubRegion", params.subRegion);

  const { data, error } = await q;
  if (error) throw error;

  const set = new Set<string>();
  for (const r of data ?? []) {
    const v = clean((r as any).Month);
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/* -------------------- Aggregations (RPC: NO 1000 CAP) -------------------- */

export async function fetchSummaryFiltered(
  params: FilterParams
): Promise<SummaryFiltered> {
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
  };
}

export async function fetchBreakdownFiltered(
  params: FilterParams
): Promise<BreakdownFilteredRow[]> {
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
    subregion: r.subregion ?? null,
    target_achieved: Number(r.target_achieved ?? 0),
    below_base: Number(r.below_base ?? 0),
    no_fueling: Number(r.no_fueling ?? 0),
  }));
}

/* -------------------- Paged table (RPC: NO 1000 CAP) -------------------- */

export async function fetchDetailsPaged(
  params: DetailsPagedParams
): Promise<DetailsPagedResponse> {
  const { data, error } = await supabase.rpc("fetch_dg_detail_rows_paged", {
    p_region: params.region ?? null,
    p_subregion: params.subRegion ?? null,
    p_month: params.month ?? null,
    p_search: params.search ?? null,
    p_status: params.status ?? null,
    p_limit: params.limit,
    p_offset: params.offset,
  });

  if (error) throw error;

  const rowsRaw = (data ?? []) as any[];
  const total = rowsRaw.length ? Number(rowsRaw[0]?.total_count ?? 0) : 0;

  const rows: DetailRow[] = rowsRaw.map((r) => ({
    dg_engineno: String(r.dg_engineno ?? ""),
    region: r.region ?? null,
    subregion: r.subregion ?? null,
    month: r.month ?? null,
    total_fuel:
      r.total_fuel === null || r.total_fuel === undefined
        ? null
        : Number(r.total_fuel),
    regional_target:
      r.regional_target === null || r.regional_target === undefined
        ? null
        : Number(r.regional_target),
    regional_base:
      r.regional_base === null || r.regional_base === undefined
        ? null
        : Number(r.regional_base),
    fuel_status: (r.fuel_status as FuelStatus) ?? "Between Base & Target",
  }));

  return { total, rows };
}

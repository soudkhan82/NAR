import supabase from "@/app/config/supabase-config";

/* ---------- Result row types from your SQL RPCs ---------- */
export type NameCount      = { name: string; cnt: number };
export type SeverityCount  = { severity: string; cnt: number };
export type AgingSlabCount = { slab: string; cnt: number };   // adjust if your SQL uses another key
export type TimePoint      = { day: string; cnt: number };
export type DistrictCount  = { district: string; cnt: number };
export type GridCount      = { grid: string; cnt: number };

export type LpaSummary = {
  names: NameCount[];
  severities: SeverityCount[];
  slabs: AgingSlabCount[];
  times: Array<{ date: string; count: number }>;
  districts: DistrictCount[];
  grids: GridCount[];
};

/** "__ALL__" → null for RPC args */
const toNull = (v?: string): string | null => (!v || v === "__ALL__" ? null : v);

/** Safe typed RPC caller (no `any`, no rpc generics) */
type RpcArgs = Record<string, string | number | boolean | null>;
async function callRpc<T>(fn: string, args: RpcArgs): Promise<T[]> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(`[${fn}] ${error.message}`);
  return (data ?? []) as T[];
}

/** Fetch full summary from all LPA RPC functions. */
export async function fetchLpaSummary(
  subRegion?: string,
  name?: string
): Promise<LpaSummary> {
  const args: RpcArgs = {
    p_subregion: toNull(subRegion),
    p_name: toNull(name),
  };

  const [
    names,
    severities,
    slabs,
    timesRaw,
    districts,
    grids,
  ] = await Promise.all([
    callRpc<NameCount>("lpa_name_counts", args),
    callRpc<SeverityCount>("lpa_severity_counts", args),
    callRpc<AgingSlabCount>("lpa_aging_slab_counts", args),
    callRpc<TimePoint>("lpa_timeseries_daily", args),
    callRpc<DistrictCount>("lpa_district_counts", args),
    callRpc<GridCount>("lpa_grid_counts", args),
  ]);

  const times = timesRaw.map((d) => ({
    date: String(d.day),
    count: Number(d.cnt),
  }));

  return { names, severities, slabs, times, districts, grids };
}

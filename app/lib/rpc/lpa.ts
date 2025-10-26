import supabase from "@/app/config/supabase-config";

/* ---------- Result row types from your SQL RPCs ---------- */
export type NameCount = { name: string | null; cnt: number };
export type SeverityCount = { severity: string | null; cnt: number };
export type AgingSlabCount = { aging_slab: string | null; cnt: number };
export type TimePoint = { day: string; cnt: number };
export type DistrictCount = { district: string | null; cnt: number };
export type GridCount = { grid: string | null; cnt: number };
export type SlabBucket = AgingSlabCount;
/** For region bar widgets */
export type RegionBucket = { region: string | null; cnt: number };

/** Page filter state (used by LpaFilterBar) */
export type FilterState = {
  region: string | null;
  subregion: string | null;
  critical: string | null;
  aging_slab: string | null;
  search: string | null;
};

export type LpaSummary = {
  names: NameCount[];
  severities: SeverityCount[];
  slabs: AgingSlabCount[]; // uses `aging_slab` key
  times: Array<{ date: string; count: number }>;
  districts: DistrictCount[];
  grids: GridCount[];
};

/** "__ALL__" → null for RPC args */
const toNull = (v?: string): string | null =>
  !v || v === "__ALL__" ? null : v;

/** Safe typed RPC caller */
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

  const [names, severities, slabsRaw, timesRaw, districts, grids] =
    await Promise.all([
      callRpc<NameCount>("lpa_name_counts", args),
      callRpc<SeverityCount>("lpa_severity_counts", args),
      // NOTE: your SQL might return { slab, cnt } or { aging_slab, cnt }.
      // We normalize to { aging_slab, cnt } here for the charts.
      callRpc<any>("lpa_aging_slab_counts", args),
      callRpc<TimePoint>("lpa_timeseries_daily", args),
      callRpc<DistrictCount>("lpa_district_counts", args),
      callRpc<GridCount>("lpa_grid_counts", args),
    ]);

  const slabs: AgingSlabCount[] = (slabsRaw ?? []).map((r: any) => ({
    aging_slab: (r.aging_slab ?? r.slab ?? null) as string | null,
    cnt: Number(r.cnt ?? 0),
  }));

  const times = (timesRaw ?? []).map((d) => ({
    date: String(d.day),
    count: Number(d.cnt),
  }));

  return { names, severities, slabs, times, districts, grids };
}

/* ---------- Filters for LpaFilterBar ---------- */

export type LpaFilterOptions = {
  regions: Array<{ v: string }>;
  subregions: Array<{ v: string }>;
  critical: Array<{ v: string }>;
  aging_slabs: Array<{ v: string }>;
};

/** Helper: get distinct non-null values for a column in LPA_consolidated */
async function distinctVals(column: string): Promise<string[]> {
  // Pull column, dedupe in JS (portable + simple)
  const { data, error } = await supabase
    .from("LPA_consolidated")
    .select(column)
    .not(column, "is", null);

  if (error) throw new Error(`[distinct ${column}] ${error.message}`);

  const vals = Array.from(
    new Set(
      (data ?? [])
        .map((r: Record<string, any>) => r?.[column])
        .filter(
          (v: unknown): v is string =>
            typeof v === "string" && v.trim().length > 0
        )
    )
  );
  vals.sort((a, b) => a.localeCompare(b));
  return vals;
}

/**
 * Returns the filter picklists:
 * - regions: distinct Region
 * - subregions: distinct SubRegion
 * - critical: distinct Critical (fallback to ["Yes","No"] if column missing)
 * - aging_slabs: taken from lpa_aging_slab_counts()
 */
export async function fetchLpaFilters(): Promise<LpaFilterOptions> {
  // Regions & Subregions from table columns
  const [regionsArr, subsArr] = await Promise.all([
    distinctVals("Region"),
    distinctVals("SubRegion"),
  ]);

  // Critical column may be boolean or text. Try to read; if error, fallback.
  let criticalArr: string[] = [];
  try {
    criticalArr = await distinctVals("Critical");
  } catch {
    criticalArr = ["Yes", "No"];
  }

  // Aging slabs list from RPC (robust regardless of SQL alias)
  const slabsRaw = await callRpc<any>("lpa_aging_slab_counts", {
    p_subregion: null,
    p_name: null,
  });
  const slabSet = new Set<string>();
  for (const r of slabsRaw ?? []) {
    const label = (r.aging_slab ?? r.slab ?? "").toString().trim();
    if (label) slabSet.add(label);
  }
  const agingSlabsArr = Array.from(slabSet).sort((a, b) => a.localeCompare(b));

  // Wrap as { v } objects to match LpaFilterBar expectations
  return {
    regions: regionsArr.map((v) => ({ v })),
    subregions: subsArr.map((v) => ({ v })),
    critical: criticalArr.map((v) => ({ v })),
    aging_slabs: agingSlabsArr.map((v) => ({ v })),
  };
}

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

/** Safe typed RPC caller (no `any`) */
type RpcArgs = Record<string, string | number | boolean | null>;
async function callRpc<T>(fn: string, args: RpcArgs): Promise<T[]> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(`[${fn}] ${error.message}`);
  if (!Array.isArray(data)) return [];
  return data as unknown as T[];
}

/** Row shapes that some SQL functions may return (kept minimal) */
type SlabRow = {
  aging_slab?: string | null;
  slab?: string | null;
  cnt?: number | null;
};
type NameRow = { name?: string | null; cnt?: number | null };
type SeverityRow = { severity?: string | null; cnt?: number | null };
type TimeRow = { day?: string | null; cnt?: number | null };
type DistrictRow = { district?: string | null; cnt?: number | null };
type GridRow = { grid?: string | null; cnt?: number | null };

/** Fetch full summary from all LPA RPC functions. */
export async function fetchLpaSummary(
  subRegion?: string,
  name?: string
): Promise<LpaSummary> {
  const args: RpcArgs = {
    p_subregion: toNull(subRegion),
    p_name: toNull(name),
  };

  const [namesRaw, severitiesRaw, slabsRaw, timesRaw, districtsRaw, gridsRaw] =
    await Promise.all([
      callRpc<NameRow>("lpa_name_counts", args),
      callRpc<SeverityRow>("lpa_severity_counts", args),
      callRpc<SlabRow>("lpa_aging_slab_counts", args),
      callRpc<TimeRow>("lpa_timeseries_daily", args),
      callRpc<DistrictRow>("lpa_district_counts", args),
      callRpc<GridRow>("lpa_grid_counts", args),
    ]);

  const names: NameCount[] = namesRaw.map((r) => ({
    name: r.name ?? null,
    cnt: Number(r.cnt ?? 0),
  }));

  const severities: SeverityCount[] = severitiesRaw.map((r) => ({
    severity: r.severity ?? null,
    cnt: Number(r.cnt ?? 0),
  }));

  const slabs: AgingSlabCount[] = slabsRaw.map((r) => ({
    aging_slab: r.aging_slab ?? r.slab ?? null,
    cnt: Number(r.cnt ?? 0),
  }));

  const times = timesRaw.map((d) => ({
    date: String(d.day ?? ""),
    count: Number(d.cnt ?? 0),
  }));

  const districts: DistrictCount[] = districtsRaw.map((r) => ({
    district: r.district ?? null,
    cnt: Number(r.cnt ?? 0),
  }));

  const grids: GridCount[] = gridsRaw.map((r) => ({
    grid: r.grid ?? null,
    cnt: Number(r.cnt ?? 0),
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
  const { data, error } = await supabase
    .from("LPA_consolidated")
    .select(column)
    .not(column, "is", null);

  if (error) throw new Error(`[distinct ${column}] ${error.message}`);

  const out = new Set<string>();
  if (Array.isArray(data)) {
    for (const rowUnknown of data as unknown[]) {
      // narrow each row to an indexable record
      const row = rowUnknown as Record<string, unknown>;
      const val = row[column];
      if (typeof val === "string") {
        const s = val.trim();
        if (s) out.add(s);
      }
    }
  }
  return Array.from(out).sort((a, b) => a.localeCompare(b));
}

/**
 * Returns the filter picklists:
 * - regions: distinct Region
 * - subregions: distinct SubRegion
 * - critical: distinct Critical (fallback to ["Yes","No"] if column missing)
 * - aging_slabs: taken from lpa_aging_slab_counts()
 */
export async function fetchLpaFilters(): Promise<LpaFilterOptions> {
  const [regionsArr, subsArr] = await Promise.all([
    distinctVals("Region"),
    distinctVals("SubRegion"),
  ]);

  let criticalArr: string[] = [];
  try {
    criticalArr = await distinctVals("Critical");
  } catch {
    criticalArr = ["Yes", "No"];
  }

  const slabsRaw = await callRpc<SlabRow>("lpa_aging_slab_counts", {
    p_subregion: null,
    p_name: null,
  });
  const slabSet = new Set<string>();
  for (const r of slabsRaw) {
    const label = r.aging_slab ?? r.slab ?? "";
    const s = String(label).trim();
    if (s) slabSet.add(s);
  }
  const agingSlabsArr = Array.from(slabSet).sort((a, b) => a.localeCompare(b));

  return {
    regions: regionsArr.map((v) => ({ v })),
    subregions: subsArr.map((v) => ({ v })),
    critical: criticalArr.map((v) => ({ v })),
    aging_slabs: agingSlabsArr.map((v) => ({ v })),
  };
}

// app/lib/rpc/avail.ts
import supabase from "@/app/config/supabase-config";

/* ── Enums + parsers ────────────────────────────────────────────────────── */
export type Region = "North" | "Central" | "South" | "Nationwide";
export type Frequency = "Daily" | "Weekly" | "Monthly";

export function parseRegion(s: string | null): Region {
  const v = (s ?? "").trim() as Region;
  return ["North", "Central", "South", "Nationwide"].includes(v)
    ? v
    : "Nationwide";
}
export function parseFrequency(s: string | null): Frequency {
  const v = (s ?? "").trim() as Frequency;
  return ["Daily", "Weekly", "Monthly"].includes(v) ? v : "Daily";
}
const toSqlRegion = (r: Region) => (r === "Nationwide" ? null : r);

/* ── Types used by page.tsx ─────────────────────────────────────────────── */
export type NameValue = { name: string; value: number };

export interface SubregionTargetsRow {
  subregion: string;
  region_key: string;
  pgs_target_pct: number;
  sb_target_pct: number;
  pgs_site_count: number;
  sb_site_count: number;
  dg_site_count: number;
  pgs_avg_overall_pct: number;
  sb_avg_overall_pct: number;
  dg_avg_overall_pct: number;
  pgs_achieved_count: number;
  pgs_below_count: number;
  sb_achieved_count: number;
  sb_below_count: number;
}

export interface HitlistRow {
  site_name: string;
  subregion: string | null;
  region_key: string | null;
  avg_overall_pct: number;
  target_pct: number;
  achieved: boolean;
}

export type BundleResult = {
  // Only what page.tsx uses:
  daily: ReadonlyArray<{ date: string; overall?: number }>;
  by_district: ReadonlyArray<NameValue>;
  by_grid: ReadonlyArray<NameValue>;
  cards?: { site_count: number; avg_pgs: number | null; avg_sb: number | null };
};

/* ── Date bounds (NEW) ──────────────────────────────────────────────────── */
export async function fetchCaDateBounds(): Promise<{
  minISO: string | null;
  maxISO: string | null;
}> {
  // Expects SQL function: fetch_ca_date_bounds() → table(min_date date, max_date date)
  const { data, error } = await supabase.rpc("fetch_ca_date_bounds");
  if (error) throw new Error(error.message);
  // data could be an array of rows or a single row depending on how Supabase returns it for RPC
  // Handle both shapes safely:
  const row =
    Array.isArray(data) && data.length > 0
      ? (data[0] as { min_date?: string | null; max_date?: string | null })
      : ((data ?? {}) as {
          min_date?: string | null;
          max_date?: string | null;
        });

  return {
    minISO: row?.min_date ?? null,
    maxISO: row?.max_date ?? null,
  };
}

/* ── RPC wrappers used by page.tsx ──────────────────────────────────────── */
export interface RollupArgs {
  region: Region;
  asOfISO: string; // YYYY-MM-DD
  frequency: Frequency;
}
export interface HitlistArgs extends RollupArgs {
  classGroup: "PGS" | "SB";
}

export async function fetchSubregionTargets(
  args: RollupArgs
): Promise<SubregionTargetsRow[]> {
  const { region, asOfISO, frequency } = args;
  const { data, error } = await supabase.rpc(
    "fetch_cell_avail_subregion_targets",
    {
      p_region: toSqlRegion(region),
      p_asof: asOfISO,
      p_freq: frequency,
    }
  );
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []) as SubregionTargetsRow[];
}

export async function fetchTargetHitlist(
  args: HitlistArgs
): Promise<HitlistRow[]> {
  const { region, asOfISO, frequency, classGroup } = args;
  const { data, error } = await supabase.rpc(
    "fetch_cell_avail_target_hitlist",
    {
      p_region: toSqlRegion(region),
      p_asof: asOfISO,
      p_freq: frequency,
      p_class: classGroup,
    }
  );
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []) as HitlistRow[];
}

/** Bundle JSON for overall line + district/grid bars (+ optional cards) */
export interface BundleFilters {
  // page passes region + date range; others default to null
  region?: Region;
  subregion?: string | null;
  grid?: string | null;
  district?: string | null;
  sitename?: string | null;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
}

export async function fetchCellAvailBundle(
  filters: BundleFilters
): Promise<BundleResult> {
  const { data, error } = await supabase.rpc("fetch_cell_avail_bundle", {
    // NOTE: if your SQL function also expects region, ensure it is added there too.
    in_region: filters.region ? toSqlRegion(filters.region) : null,
    in_subregion: filters.subregion ?? null,
    in_grid: filters.grid ?? null,
    in_district: filters.district ?? null,
    in_sitename: filters.sitename ?? null,
    in_date_from: filters.dateFrom,
    in_date_to: filters.dateTo,
  });
  if (error) throw new Error(error.message);

  const obj = (data ?? {}) as Partial<BundleResult> & {
    daily?: Array<{ date?: string; overall?: number }>;
  };

  return {
    daily: Array.isArray(obj.daily)
      ? obj.daily
          .filter((d) => typeof d?.date === "string")
          .map((d) => ({ date: d!.date!, overall: d?.overall }))
      : [],
    by_district: Array.isArray(obj.by_district) ? obj.by_district : [],
    by_grid: Array.isArray(obj.by_grid) ? obj.by_grid : [],
    cards: obj.cards ?? { site_count: 0, avg_pgs: null, avg_sb: null },
  };
}

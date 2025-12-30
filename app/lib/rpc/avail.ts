// app/lib/rpc/avail.ts
import supabase from "@/app/config/supabase-config";

/* ---------------- Types ---------------- */
export type Region = "ALL" | "North" | "Central" | "South";
export type Frequency = "Daily" | "Weekly" | "Monthly";

export type SubregionTargetsRow = {
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
};

export type HitlistRow = {
  site_name: string;
  subregion: string | null;
  region_key: string | null;
  avg_overall_pct: number | null;
  target_pct: number | null;
  achieved: boolean | null;
};

export type CaDateBounds = { minISO: string | null; maxISO: string | null };

export type BundleDailyRow = { date: string; overall: number | null };

export type BundleAggRow = {
  name: string | null;
  overall: number | null;
  v2g: number | null;
  v3g: number | null;
  v4g: number | null;
};

export type BundleCards = {
  site_count: number | null;
  avg_pgs: number | null;
  avg_sb: number | null;
};

export type CellAvailBundle = {
  daily: BundleDailyRow[];
  by_grid: BundleAggRow[];
  by_district: BundleAggRow[];
  cards: BundleCards;
};

/* ---------------- Parsers ---------------- */
export function parseRegion(v: string | null): Region {
  if (!v) return "ALL";
  const x = v.trim().toLowerCase();
  if (x === "north") return "North";
  if (x === "central") return "Central";
  if (x === "south") return "South";
  return "ALL";
}

export function parseFrequency(v: string | null): Frequency {
  if (!v) return "Daily";
  const x = v.trim().toLowerCase();
  if (x === "weekly") return "Weekly";
  if (x === "monthly") return "Monthly";
  return "Daily";
}

/* ---------------- RPC wrappers ---------------- */
function mapRegionToParam(region: Region): string | null {
  return region === "ALL" ? null : region;
}

export async function fetchCaDateBounds(): Promise<CaDateBounds> {
  const { data, error } = await supabase.rpc("fetch_ca_date_bounds");
  if (error) throw new Error(error.message);

  const row = Array.isArray(data)
    ? (data[0] as { min_date?: string; max_date?: string } | undefined)
    : undefined;

  return {
    minISO: row?.min_date ?? null,
    maxISO: row?.max_date ?? null,
  };
}

export async function fetchSubregionTargets(args: {
  region: Region;
  asOfISO: string; // YYYY-MM-DD
  frequency: Frequency;
}): Promise<SubregionTargetsRow[]> {
  const { data, error } = await supabase.rpc(
    "fetch_cell_avail_subregion_targets",
    {
      p_region: mapRegionToParam(args.region),
      p_asof: args.asOfISO,
      p_freq: args.frequency,
    }
  );

  if (error) throw new Error(error.message);
  return (data ?? []) as SubregionTargetsRow[];
}

export async function fetchTargetHitlist(args: {
  region: Region;
  asOfISO: string;
  frequency: Frequency;
  classGroup: "PGS" | "SB";
}): Promise<HitlistRow[]> {
  const { data, error } = await supabase.rpc(
    "fetch_cell_avail_target_hitlist",
    {
      p_region: mapRegionToParam(args.region),
      p_asof: args.asOfISO,
      p_freq: args.frequency,
      p_class: args.classGroup,
    }
  );

  if (error) throw new Error(error.message);
  return (data ?? []) as HitlistRow[];
}

export async function fetchCellAvailBundle(args: {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
  region: Region;
  subregion: string | null;
  grid: string | null;
  district: string | null;
  sitename: string | null;
}): Promise<CellAvailBundle> {
  const { data, error } = await supabase.rpc("fetch_cell_avail_bundle", {
    in_date_from: args.dateFrom,
    in_date_to: args.dateTo,
    in_region: mapRegionToParam(args.region),
    in_subregion: args.subregion,
    in_grid: args.grid,
    in_district: args.district,
    in_sitename: args.sitename,
  });

  if (error) throw new Error(error.message);

  const obj = (data ?? {}) as Partial<CellAvailBundle>;
  return {
    daily: Array.isArray(obj.daily) ? obj.daily : [],
    by_grid: Array.isArray(obj.by_grid) ? obj.by_grid : [],
    by_district: Array.isArray(obj.by_district) ? obj.by_district : [],
    cards: (obj.cards ?? {
      site_count: null,
      avg_pgs: null,
      avg_sb: null,
    }) as BundleCards,
  };
}

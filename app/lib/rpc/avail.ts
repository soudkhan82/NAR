// app/lib/rpc/avail.ts
import supabase from "@/app/config/supabase-config";

/* ---------- Types ---------- */
export type BundleFilters = {
  subregion?: string | null;
  grid?: string | null;
  district?: string | null;
  sitename?: string | null;
  dateFrom?: string | null; // YYYY-MM-DD
  dateTo?: string | null; // YYYY-MM-DD
};

export type NameValue = { name: string; value: number | null };
export type BandItem = { name: string; count: number };

export type BundleCards = {
  site_count: number | null;
  avg_pgs: number | null;
  avg_sb: number | null;
};

export type DailyPoint = {
  date: string;
  pgs: number | null;
  sb: number | null;
};
export type WeeklyPoint = {
  week: string;
  pgs: number | null;
  sb: number | null;
};

export type BundleResult = {
  cards: BundleCards;
  daily: DailyPoint[];
  weekly: WeeklyPoint[];
  by_district: NameValue[];
  by_grid: NameValue[];
  bands_pgs: BandItem[];
  bands_sb: BandItem[];
};

/* ---------- Narrowing helpers (no any) ---------- */
type UnknownRec = Record<string, unknown>;

const isObj = (v: unknown): v is UnknownRec =>
  !!v && typeof v === "object" && !Array.isArray(v);

const toNumOrNull = (x: unknown): number | null => {
  if (x == null) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

function parseArray<T>(v: unknown, guard: (o: unknown) => o is T): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const item of v) if (guard(item)) out.push(item);
  return out;
}

/* ---- per-shape guards ---- */
const isBundleCards = (o: unknown): o is BundleCards =>
  isObj(o) && "site_count" in o && "avg_pgs" in o && "avg_sb" in o;

const isDailyPoint = (o: unknown): o is DailyPoint =>
  isObj(o) && typeof o.date === "string" && "pgs" in o && "sb" in o;

const isWeeklyPoint = (o: unknown): o is WeeklyPoint =>
  isObj(o) && typeof o.week === "string" && "pgs" in o && "sb" in o;

const isNameValue = (o: unknown): o is NameValue =>
  isObj(o) && typeof o.name === "string" && "value" in o;

const isBandItem = (o: unknown): o is BandItem =>
  isObj(o) &&
  typeof o.name === "string" &&
  typeof (o as UnknownRec).count !== "undefined";

/* ---------- Main bundle ---------- */
export async function fetchCellAvailBundle(
  filters: BundleFilters
): Promise<BundleResult> {
  const { data, error } = await supabase.rpc("fetch_cell_avail_bundle", {
    in_subregion: filters.subregion ?? null,
    in_grid: filters.grid ?? null,
    in_district: filters.district ?? null,
    in_sitename: filters.sitename ?? null,
    in_date_from: filters.dateFrom ?? null,
    in_date_to: filters.dateTo ?? null,
  });

  if (error)
    throw new Error(`fetch_cell_avail_bundle failed: ${error.message}`);
  if (!isObj(data)) throw new Error("Unexpected RPC shape (not an object)");

  // Cards
  const rawCards: BundleCards = isBundleCards(data.cards)
    ? {
        site_count: Number((data.cards as UnknownRec).site_count ?? 0),
        avg_pgs: toNumOrNull((data.cards as UnknownRec).avg_pgs),
        avg_sb: toNumOrNull((data.cards as UnknownRec).avg_sb),
      }
    : { site_count: 0, avg_pgs: null, avg_sb: null };

  // Series
  const daily = parseArray<DailyPoint>(data.daily, isDailyPoint).map((r) => ({
    date: r.date,
    pgs: toNumOrNull((r as UnknownRec).pgs),
    sb: toNumOrNull((r as UnknownRec).sb),
  }));

  const weekly = parseArray<WeeklyPoint>(data.weekly, isWeeklyPoint).map(
    (r) => ({
      week: r.week,
      pgs: toNumOrNull((r as UnknownRec).pgs),
      sb: toNumOrNull((r as UnknownRec).sb),
    })
  );

  // Aggregates
  const by_district = parseArray<NameValue>(data.by_district, isNameValue).map(
    (r) => ({
      name: r.name,
      value: toNumOrNull(r.value),
    })
  );

  const by_grid = parseArray<NameValue>(data.by_grid, isNameValue).map((r) => ({
    name: r.name,
    value: toNumOrNull(r.value),
  }));

  // Bands
  const bands_pgs = parseArray<BandItem>(data.bands_pgs, isBandItem).map(
    (r) => ({
      name: r.name,
      count: Number((r as UnknownRec).count ?? 0),
    })
  );

  const bands_sb = parseArray<BandItem>(data.bands_sb, isBandItem).map((r) => ({
    name: r.name,
    count: Number((r as UnknownRec).count ?? 0),
  }));

  return {
    cards: rawCards,
    daily,
    weekly,
    by_district,
    by_grid,
    bands_pgs,
    bands_sb,
  };
}

/* ---------- Picklists ---------- */
export async function fetchSubregions(): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_subregions");
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : [];
  return rows
    .map((r) =>
      isObj(r) && typeof r.subregion === "string" ? r.subregion : null
    )
    .filter((s): s is string => s !== null);
}

export async function fetchGrids(subregion?: string | null): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_grids", {
    in_subregion: subregion ?? null,
  });
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : [];
  return rows
    .map((r) => (isObj(r) && typeof r.grid === "string" ? r.grid : null))
    .filter((s): s is string => s !== null);
}

export async function fetchDistricts(
  subregion?: string | null,
  grid?: string | null
): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_districts", {
    in_subregion: subregion ?? null,
    in_grid: grid ?? null,
  });
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : [];
  return rows
    .map((r) =>
      isObj(r) && typeof r.district === "string" ? r.district : null
    )
    .filter((s): s is string => s !== null);
}

export async function fetchSiteNames(
  query?: string | null,
  subregion?: string | null,
  grid?: string | null,
  district?: string | null
): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_sitenames", {
    in_query: query ?? null,
    in_subregion: subregion ?? null,
    in_grid: grid ?? null,
    in_district: district ?? null,
    in_limit: 20,
  });
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : [];
  return rows
    .map((r) =>
      isObj(r) && typeof r.sitename === "string" ? r.sitename : null
    )
    .filter((s): s is string => s !== null);
}

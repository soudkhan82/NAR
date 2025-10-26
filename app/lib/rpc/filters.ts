import supabase from "@/app/config/supabase-config";

/** Common helpers */
export const ALL = "__ALL__";
export const toNullable = (v?: string | null): string | null =>
  v && v !== ALL ? v : null;

/** Generic, typed flattener for rows that return a single text column */
function toFlat<K extends string>(
  rows: Array<Record<K, string | null>> | null | undefined,
  key: K
): string[] {
  return (rows ?? [])
    .map((r) => r[key])
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

/** Safe typed RPC caller (no `any`, no rpc generics) */
type RpcArgs = Record<string, string | number | boolean | null | undefined>;
async function callRpc<T extends object>(
  fn: string,
  args?: RpcArgs
): Promise<T[]> {
  const { data, error } = await supabase.rpc(fn, args ?? {});
  if (error) throw new Error(`[${fn}] ${error.message}`);
  return (data ?? []) as T[];
}

/** Row shapes returned by your SQL functions */
type SubregionRow = { subregion: string | null };
type GridRow = { grid: string | null };
type DistrictRow = { district: string | null };

/** SubRegions (global distinct) */
export async function fetchSSLSubregions(): Promise<string[]> {
  const rows = await callRpc<SubregionRow>("fetch_ssl_subregions");
  return toFlat(rows, "subregion");
}

/** Grids (optionally scoped by SubRegion) */
export async function fetchSSLGrids(
  subregion?: string | null
): Promise<string[]> {
  const rows = await callRpc<GridRow>("fetch_ssl_grids", {
    in_subregion: toNullable(subregion),
  });
  return toFlat(rows, "grid");
}

/** Districts (optionally scoped by SubRegion and/or Grid) */
export async function fetchSSLDistricts(
  subregion?: string | null,
  grid?: string | null
): Promise<string[]> {
  const rows = await callRpc<DistrictRow>("fetch_ssl_districts", {
    in_subregion: toNullable(subregion),
    in_grid: toNullable(grid),
  });
  return toFlat(rows, "district");
}

/** Short aliases (use these in components if you prefer) */
export const fetchSubregions = fetchSSLSubregions;
export const fetchGrids = fetchSSLGrids;
export const fetchDistricts = fetchSSLDistricts;

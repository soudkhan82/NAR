// app/lib/rpc/utilization.ts
import supabase from "@/app/config/supabase-config";

/* ===== Types ===== */
export type AreaLevel = "DISTRICT" | "GRID";

export interface AreaRow {
  area: string | null;
  hu_cells: number;
  hu_sites: number;
  lu_cells: number;
  lu_sites: number;
}

export interface TsRow {
  d: string; // YYYY-MM-DD
  avgdl_tp: number | null;
  prb_dl: number | null;
  avgrrc: number | null;
}

/** Raw wire shape from PostgREST (numeric -> string) */
type TsRowWire = {
  d: string;
  avgdl_tp: string | number | null;
  prb_dl: string | number | null;
  avgrrc: string | number | null;
};

/* ===== Helpers ===== */
function isErrorObject(x: unknown): x is { Error: unknown } {
  return (
    !!x && typeof x === "object" && "Error" in (x as Record<string, unknown>)
  );
}
function asArray<T>(data: unknown): T[] {
  if (isErrorObject(data)) {
    const msg =
      typeof (data as any).Error === "string"
        ? (data as any).Error
        : "RPC error payload.";
    throw new Error(msg);
  }
  return Array.isArray(data) ? (data as T[]) : [];
}
const toNum = (v: string | number | null): number | null =>
  v === null ? null : Number(v);

/* ===== Picklist ===== */
export async function fetchSubregions(): Promise<string[]> {
  const { data, error } = await supabase
    .rpc("fetch_ssl_subregions")
    .returns<{ subregion: string }[]>();
  if (error) throw new Error(error.message);
  return asArray<{ subregion: string }>(data).map((r) => r.subregion);
}

/* ===== Area KPIs (District/Grid) ===== */
export async function fetchAreaCounts(
  level: AreaLevel,
  opts?: {
    subregion?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }
): Promise<AreaRow[]> {
  const { data, error } = await supabase
    .rpc("util_counts_by_area", {
      p_level: level,
      p_subregion: opts?.subregion ?? null,
      p_date_from: opts?.dateFrom ?? null,
      p_date_to: opts?.dateTo ?? null,
    })
    .returns<AreaRow[]>();
  if (error) throw new Error(error.message);
  return asArray<AreaRow>(data).filter((r) => r.area);
}

/* ===== HU Time-series (Avg DL_TP / PRB_DL / AvgRRC) =====
   Coerces PostgREST numeric strings -> numbers so charts render.
*/
export async function fetchHuTimeseries(opts?: {
  subregion?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}): Promise<TsRow[]> {
  const { data, error } = await supabase
    .rpc("util_hu_timeseries", {
      p_subregion: opts?.subregion ?? null,
      p_date_from: opts?.dateFrom ?? null,
      p_date_to: opts?.dateTo ?? null,
    })
    .returns<TsRowWire[]>();
  if (error) throw new Error(error.message);

  const rows = asArray<TsRowWire>(data);
  return rows.map((r) => ({
    d: r.d,
    avgdl_tp: toNum(r.avgdl_tp),
    prb_dl: toNum(r.prb_dl),
    avgrrc: toNum(r.avgrrc),
  }));
}

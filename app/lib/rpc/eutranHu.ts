import supabase from "@/app/config/supabase-config";

/* Filters */
export type FilterState = { subRegion?: string | null };

/* Types from SQL */
export type SummaryRow = {
  avg_avgdl_tp: number | null;
  avg_prb_dl: number | null;
  avg_avgrrc: number | null;
  total_cells: number;
};

/* Daily series point (date-form) */
export type DayPoint = {
  d: string; // 'YYYY-MM-DD'
  avgdl_tp: number | null;
  prb_dl: number | null;
  avgrrc: number | null;
};

export type GridDaily = { d: string; grid: string; cells: number };
export type DistrictDaily = { d: string; district: string; cells: number };

async function rpc<T>(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as T;
}

export async function fetchSubRegions(): Promise<string[]> {
  const rows = await rpc<{ sub_region: string | null }[]>(
    "fetch_subregions",
    {}
  );
  return Array.from(
    new Set(rows.map((r) => r.sub_region).filter((v): v is string => !!v))
  ).sort();
}

export async function fetchSummaryWindow(
  f: FilterState,
  days = 7
): Promise<SummaryRow> {
  const rows = await rpc<SummaryRow[]>("fetch_eutran_summary_window", {
    in_subregion: f.subRegion ?? null,
    in_days: days,
  });
  return (
    rows[0] ?? {
      avg_avgdl_tp: null,
      avg_prb_dl: null,
      avg_avgrrc: null,
      total_cells: 0,
    }
  );
}

/* DAILY time series */
export async function fetchTimeseriesDailyWindow(
  f: FilterState,
  days = 7
): Promise<DayPoint[]> {
  // expects an SQL function like: fetch_eutran_timeseries_daily_window(in_subregion, in_days)
  return rpc<DayPoint[]>("fetch_eutran_timeseries_daily_window", {
    in_subregion: f.subRegion ?? null,
    in_days: days,
  });
}

/* Top-5 grids by latest day, per-day distinct cells (already filtered in SQL) */
export async function fetchTop5GridDailyWindow(
  f: FilterState,
  days = 7
): Promise<GridDaily[]> {
  return rpc<GridDaily[]>("fetch_top5_grid_daily_window", {
    in_subregion: f.subRegion ?? null,
    in_days: days,
  });
}

/* Top-5 districts by latest day, per-day distinct cells (already filtered in SQL) */
export async function fetchTop5DistrictDailyWindow(
  f: FilterState,
  days = 7
): Promise<DistrictDaily[]> {
  return rpc<DistrictDaily[]>("fetch_top5_district_daily_window", {
    in_subregion: f.subRegion ?? null,
    in_days: days,
  });
}

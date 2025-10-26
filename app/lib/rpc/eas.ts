// app/lib/rpc/eas.ts
import supabase from "@/app/config/supabase-config";

export type StatusSummaryRow = {
  total_sites: number; // = ok + nok
  ok_sites: number;
  nok_sites: number;
};

export type NokTimeseriesRow = {
  report_date: string;
  nok_sites: number;
};

export type DistrictTotalRow = {
  district: string | null;
  total_nok: number;
};

export type GridTotalRow = {
  grid: string | null;
  total_nok: number;
};

export async function fetchSubregions(): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_subregions");
  if (error) throw error;
  const rows = (data ?? []) as { subregion: string | null }[];
  return rows.map((r) => r.subregion).filter((v): v is string => !!v);
}

export async function fetchSummaryOkNok(
  from: string,
  to: string,
  subregion?: string | null
) {
  const { data, error } = await supabase.rpc("fetch_eas_summary_ok_nok", {
    in_date_from: from,
    in_date_to: to,
    in_subregion: subregion ?? null,
  });
  if (error) throw error;
  return (
    (data?.[0] as StatusSummaryRow) ?? {
      total_sites: 0,
      ok_sites: 0,
      nok_sites: 0,
    }
  );
}

export async function fetchTimeseriesNok(
  from: string,
  to: string,
  subregion?: string | null
) {
  const { data, error } = await supabase.rpc("fetch_eas_ts_nok", {
    in_date_from: from,
    in_date_to: to,
    in_subregion: subregion ?? null,
  });
  if (error) throw error;
  return (data ?? []) as NokTimeseriesRow[];
}

export async function fetchNokByDistrictTotal(
  from: string,
  to: string,
  subregion?: string | null
) {
  const { data, error } = await supabase.rpc(
    "fetch_eas_nok_by_district_total",
    {
      in_date_from: from,
      in_date_to: to,
      in_subregion: subregion ?? null,
    }
  );
  if (error) throw error;
  return (data ?? []) as DistrictTotalRow[];
}

export async function fetchNokByGridTotal(
  from: string,
  to: string,
  subregion?: string | null
) {
  const { data, error } = await supabase.rpc("fetch_eas_nok_by_grid_total", {
    in_date_from: from,
    in_date_to: to,
    in_subregion: subregion ?? null,
  });
  if (error) throw error;
  return (data ?? []) as GridTotalRow[];
}
// add near your other imports/exports
export type WeeklyNokRow = { week_start: string; nok_sites: number };

export async function fetchWeeklyNok(
  from: string,
  to: string,
  subregion?: string | null
): Promise<WeeklyNokRow[]> {
  const { data, error } = await supabase.rpc("fetch_eas_weekly_nok", {
    in_date_from: from,
    in_date_to: to,
    in_subregion: subregion ?? null,
  });
  if (error) throw error;
  return (data ?? []) as WeeklyNokRow[];
}

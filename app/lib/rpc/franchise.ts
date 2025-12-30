// app/lib/rpc/franchise.ts
import supabase from "@/app/config/supabase-config";

export type FranchiseEnrichedRow = {
  id: number;
  remarks: string | null;
  franchise_id: string | null;
  franchise_name: string | null;
  SiteName: string | null;

  Region: string | null;
  SubRegion: string | null;
  Grid: string | null;
  District: string | null;
  Address: string | null;
  Latitude: number | null;
  Longitude: number | null;
};

export async function fetchFranchiseEnriched(): Promise<FranchiseEnrichedRow[]> {
  const { data, error } = await supabase.rpc("fetch_franchise_enriched");
  if (error) throw new Error(error.message);
  return (data ?? []) as FranchiseEnrichedRow[];
}

/**
 * Timeseries point coming from Cell_Availability.
 * Keep keys aligned with SQL output to avoid TS property errors.
 */
export type FranchiseTimeseriesPoint = {
  Report_Date: string; // YYYY-MM-DD
  Overall: number | null;
  "2G": number | null;
  "3G": number | null;
  "4G": number | null;
};

export async function fetchFranchiseTimeseries60d(
  siteName: string
): Promise<FranchiseTimeseriesPoint[]> {
  const { data, error } = await supabase.rpc("fetch_franchise_timeseries_60d", {
    p_sitename: siteName,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as FranchiseTimeseriesPoint[];
}

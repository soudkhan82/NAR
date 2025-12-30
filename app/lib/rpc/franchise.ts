// app/lib/rpc/franchise/franchise.ts
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

export async function fetchFranchiseEnriched() {
  const { data, error } = await supabase.rpc("fetch_franchise_enriched");
  if (error) throw new Error(error.message);
  return (data ?? []) as FranchiseEnrichedRow[];
}

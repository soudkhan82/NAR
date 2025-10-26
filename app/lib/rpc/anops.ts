// app/lib/rpc/anops.ts
// ⬇️ remove: import supabase from "@/app/config/supabase-config";

import type { SupabaseClient } from "@supabase/supabase-js";

// cache between calls
let _sb: SupabaseClient | null = null;

/** Browser-only dynamic import. Safe during prerender because it doesn't run at module load. */
async function getSb(): Promise<SupabaseClient> {
  if (_sb) return _sb;
  if (typeof window === "undefined") {
    // Never run on the server during prerender; page.tsx is client-only and calls happen in effects.
    throw new Error(
      "ANOps RPC called on the server. These RPCs are browser-only."
    );
  }
  const mod = await import("@/app/config/supabase-config");
  _sb = mod.default;
  return _sb;
}

export type ProjectName = string;
export type SiteClass = "PGS" | "SB";

export interface FilterOptionsRow {
  SubRegion: string | null;
  District: string | null;
  Grid: string | null;
}
export interface SiteRow {
  SiteName: string;
  SITE_ID: string;
  SubRegion: string | null;
  District: string | null;
  Grid: string | null;
}
export interface TimeseriesRow {
  dt: string;
  v2g: number | null;
  v3g: number | null;
  v4g: number | null;
}
export interface SiteDetailRow {
  SiteName: string;
  ProjectName: string | null;
  Status: string | null;
  Attempt_date: string | null;
  v2g: number | null;
  v3g: number | null;
  v4g: number | null;
}
export interface AttemptStatusRow {
  dt: string;
  attempted: number;
  resolved: number;
}

export async function fetchProjectNames(): Promise<ProjectName[]> {
  const supabase = await getSb();
  const { data, error } = await supabase.rpc("anops_project_names");
  if (error) throw error;
  return (data ?? []).map((r: { project_name: string }) => r.project_name);
}

export async function fetchFilterOptions(
  projects: string[] | null,
  siteClass: SiteClass | null = null
): Promise<{ subregions: string[]; districts: string[]; grids: string[] }> {
  const supabase = await getSb();
  const { data, error } = await supabase.rpc("anops_filter_options", {
    p_projects: projects && projects.length ? projects : null,
    p_site_class: siteClass ?? null,
  });
  if (error) throw error;
  const subs = new Set<string>();
  const dists = new Set<string>();
  const grids = new Set<string>();
  (data as FilterOptionsRow[]).forEach((r) => {
    if (r.SubRegion) subs.add(r.SubRegion);
    if (r.District) dists.add(r.District);
    if (r.Grid) grids.add(r.Grid);
  });
  return {
    subregions: Array.from(subs).sort(),
    districts: Array.from(dists).sort(),
    grids: Array.from(grids).sort(),
  };
}

export async function fetchSites(args: {
  projects: string[] | null;
  siteClass?: SiteClass | null;
  subregion?: string | null;
  district?: string | null;
  grid?: string | null;
  search?: string | null;
}): Promise<SiteRow[]> {
  if (!args.projects || args.projects.length === 0) return [];
  const supabase = await getSb();
  const { data, error } = await supabase.rpc("anops_sites", {
    p_projects: args.projects,
    p_site_class: args.siteClass ?? null,
    p_subregion: args.subregion ?? null,
    p_district: args.district ?? null,
    p_grid: args.grid ?? null,
    p_search: args.search ?? null,
  });
  if (error) throw error;
  return (data ?? []) as SiteRow[];
}

export async function fetchSitesDetail(args: {
  projects: string[] | null;
  siteClass?: SiteClass | null;
  subregion?: string | null;
  district?: string | null;
  grid?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  search?: string | null;
}): Promise<SiteDetailRow[]> {
  if (!args.projects || args.projects.length === 0) return [];
  const supabase = await getSb();
  const { data, error } = await supabase.rpc("anops_sites_detail", {
    p_projects: args.projects,
    p_site_class: args.siteClass ?? null,
    p_subregion: args.subregion ?? null,
    p_district: args.district ?? null,
    p_grid: args.grid ?? null,
    p_date_from: args.dateFrom ?? null,
    p_date_to: args.dateTo ?? null,
    p_search: args.search ?? null,
  });
  if (error) throw error;
  return (data ?? []) as SiteDetailRow[];
}

export async function fetchAttemptStatus(args: {
  projects: string[] | null;
  siteClass?: SiteClass | null;
  subregion?: string | null;
  district?: string | null;
  grid?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}): Promise<AttemptStatusRow[]> {
  if (!args.projects || args.projects.length === 0) return [];
  const supabase = await getSb();
  const { data, error } = await supabase.rpc("anops_attempt_status_by_date", {
    p_projects: args.projects,
    p_site_class: args.siteClass ?? null,
    p_subregion: args.subregion ?? null,
    p_district: args.district ?? null,
    p_grid: args.grid ?? null,
    p_date_from: args.dateFrom ?? null,
    p_date_to: args.dateTo ?? null,
  });
  if (error) throw error;
  return (data ?? []) as AttemptStatusRow[];
}

export async function fetchTimeseries(args: {
  dateFrom?: string | null;
  dateTo?: string | null;
  projects: string[] | null;
  site?: string | null;
  siteClass?: SiteClass | null;
  subregion?: string | null;
  district?: string | null;
  grid?: string | null;
}): Promise<TimeseriesRow[]> {
  if (!args.projects || args.projects.length === 0) return [];
  const supabase = await getSb();
  const { data, error } = await supabase.rpc("anops_availability_timeseries", {
    p_date_from: args.dateFrom ?? null,
    p_date_to: args.dateTo ?? null,
    p_projects: args.projects,
    p_site: args.site ?? null,
    p_site_class: args.siteClass ?? null,
    p_subregion: args.subregion ?? null,
    p_district: args.district ?? null,
    p_grid: args.grid ?? null,
  });
  if (error) throw error;
  return (data ?? []) as TimeseriesRow[];
}

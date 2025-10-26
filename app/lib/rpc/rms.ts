import { createClient } from "@supabase/supabase-js";

export type RmsOverviewRow = { total_count: number; site_count: number };

export type RmsVendorRow = { vendor: string | null; site_count: number };
export type RmsStatusRow = { status: string | null; site_count: number };
export type RmsReasonRow = { reason: string | null; site_count: number };
export type RmsGridRow = { grid: string | null; site_count: number };
export type RmsTopSubregionRow = {
  subregion: string | null;
  site_count: number;
};
export type RmsTopDistrictRow = { district: string | null; site_count: number };

export type RmsTableRow = {
  report_date: string;
  site_id: string | null;
  site_name: string | null;
  subregion: string | null;
  grid: string | null;
  district: string | null;
  rms_vendor: string | null;
  rms_status_connected_disconnected: string | null;
  rms_abnormality: string | null;
  abnormal_reason: string | null;
  currentrms_type: string | null;
  final_status: string | null;
};

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/* ---------- helpers ---------- */
const iso = (d: Date) => d.toISOString().slice(0, 10);
export function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);
  return { from: iso(from), to: iso(to) };
}

type RpcArgs = Record<string, string | number | boolean | null | undefined>;
async function callRpc<T extends object>(
  fn: string,
  args?: RpcArgs
): Promise<T[]> {
  const { data, error } = await sb().rpc(fn, args ?? {});
  if (error) throw new Error(`[${fn}] ${error.message}`);
  return (data ?? []) as T[];
}

function toFlat<K extends string>(
  rows: Array<Record<K, string | null>> | null | undefined,
  key: K
): string[] {
  return (rows ?? [])
    .map((r) => r[key])
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

/* ---------- SSL Picklists (typed) ---------- */
type SubregionRow = { subregion: string | null };
type GridRow = { grid: string | null };
type DistrictRow = { district: string | null };
type SiteClassRow = { site_class: string | null };
type SiteNameRow = { sitename: string | null };

export async function fetchSubregions(): Promise<string[]> {
  const rows = await callRpc<SubregionRow>("fetch_ssl_subregions");
  return toFlat(rows, "subregion");
}

export async function fetchGrids(subregion?: string | null): Promise<string[]> {
  const rows = await callRpc<GridRow>("fetch_ssl_grids", {
    in_subregion: subregion ?? null,
  });
  return toFlat(rows, "grid");
}

export async function fetchDistricts(
  subregion?: string | null,
  grid?: string | null
): Promise<string[]> {
  const rows = await callRpc<DistrictRow>("fetch_ssl_districts", {
    in_subregion: subregion ?? null,
    in_grid: grid ?? null,
  });
  return toFlat(rows, "district");
}

export async function fetchSiteClasses(): Promise<string[]> {
  const rows = await callRpc<SiteClassRow>("fetch_ssl_site_classes");
  return toFlat(rows, "site_class");
}

/** SSL SiteName autocomplete (used by Site Name dropdown) */
export async function fetchSiteNames(
  params: {
    query?: string | null;
    subregion?: string | null;
    grid?: string | null;
    district?: string | null;
    limit?: number;
  } = {}
): Promise<string[]> {
  const {
    query = null,
    subregion = null,
    grid = null,
    district = null,
    limit = 20,
  } = params;

  const rows = await callRpc<SiteNameRow>("fetch_ssl_sitenames", {
    in_query: query ?? null,
    in_subregion: subregion ?? null,
    in_grid: grid ?? null,
    in_district: district ?? null,
    in_limit: limit,
  });
  return toFlat(rows, "sitename");
}

/* ---------- Filters shared ---------- */
type CommonFilters = {
  date_from: string;
  date_to: string;
  subregion?: string | null;
  grid?: string | null;
  district?: string | null;
  site_class?: string | null;
  vendor?: string | null;
  status?: string | null;
};

/* ---------- Data RPCs ---------- */
export async function fetchOverview(f: CommonFilters): Promise<RmsOverviewRow> {
  const rows = await callRpc<RmsOverviewRow>("fetch_rms_overview", {
    in_date_from: f.date_from,
    in_date_to: f.date_to,
    in_subregion: f.subregion ?? null,
    in_grid: f.grid ?? null,
    in_district: f.district ?? null,
    in_class: f.site_class ?? null,
    in_vendor: f.vendor ?? null,
    in_status: f.status ?? null,
  });
  return rows?.[0] ?? { total_count: 0, site_count: 0 };
}

export async function fetchByVendor(f: CommonFilters): Promise<RmsVendorRow[]> {
  return callRpc<RmsVendorRow>("fetch_rms_by_vendor", {
    in_date_from: f.date_from,
    in_date_to: f.date_to,
    in_subregion: f.subregion ?? null,
    in_grid: f.grid ?? null,
    in_district: f.district ?? null,
    in_class: f.site_class ?? null,
    in_vendor: f.vendor ?? null,
    in_status: f.status ?? null,
  });
}

export async function fetchByStatus(f: CommonFilters): Promise<RmsStatusRow[]> {
  return callRpc<RmsStatusRow>("fetch_rms_by_status", {
    in_date_from: f.date_from,
    in_date_to: f.date_to,
    in_subregion: f.subregion ?? null,
    in_grid: f.grid ?? null,
    in_district: f.district ?? null,
    in_class: f.site_class ?? null,
    in_vendor: f.vendor ?? null,
    in_status: f.status ?? null,
  });
}

export async function fetchByReason(f: CommonFilters): Promise<RmsReasonRow[]> {
  return callRpc<RmsReasonRow>("fetch_rms_by_reason", {
    in_date_from: f.date_from,
    in_date_to: f.date_to,
    in_subregion: f.subregion ?? null,
    in_grid: f.grid ?? null,
    in_district: f.district ?? null,
    in_class: f.site_class ?? null,
    in_vendor: f.vendor ?? null,
    in_status: f.status ?? null,
  });
}

export async function fetchTopSubregions(
  f: CommonFilters & { limit?: number }
): Promise<RmsTopSubregionRow[]> {
  return callRpc<RmsTopSubregionRow>("fetch_rms_top_subregions", {
    in_date_from: f.date_from,
    in_date_to: f.date_to,
    in_subregion: f.subregion ?? null,
    in_grid: f.grid ?? null,
    in_district: f.district ?? null,
    in_class: f.site_class ?? null,
    in_vendor: f.vendor ?? null,
    in_status: f.status ?? null,
    in_limit: f.limit ?? 5,
  });
}

export async function fetchTopDistricts(
  f: CommonFilters & { limit?: number }
): Promise<RmsTopDistrictRow[]> {
  return callRpc<RmsTopDistrictRow>("fetch_rms_top_districts", {
    in_date_from: f.date_from,
    in_date_to: f.date_to,
    in_subregion: f.subregion ?? null,
    in_grid: f.grid ?? null,
    in_district: f.district ?? null,
    in_class: f.site_class ?? null,
    in_vendor: f.vendor ?? null,
    in_status: f.status ?? null,
    in_limit: f.limit ?? 10,
  });
}

export async function fetchRows(
  f: CommonFilters & { limit?: number; offset?: number; search?: string | null }
): Promise<RmsTableRow[]> {
  return callRpc<RmsTableRow>("fetch_rms_rows", {
    in_date_from: f.date_from,
    in_date_to: f.date_to,
    in_subregion: f.subregion ?? null,
    in_grid: f.grid ?? null,
    in_district: f.district ?? null,
    in_class: f.site_class ?? null,
    in_vendor: f.vendor ?? null,
    in_status: f.status ?? null,
    in_limit: f.limit ?? 50,
    in_offset: f.offset ?? 0,
    in_search: f.search ?? null,
  });
}

export async function fetchRmsBounds(): Promise<{
  min_date: string | null;
  max_date: string | null;
}> {
  try {
    const rows = await callRpc<{
      min_date: string | null;
      max_date: string | null;
    }>("fetch_rms_bounds");
    return rows?.[0] ?? { min_date: null, max_date: null };
  } catch {
    return { min_date: null, max_date: null };
  }
}

export async function fetchByGrid(f: {
  date_from: string;
  date_to: string;
  subregion?: string | null;
  grid?: string | null;
  district?: string | null;
  site_class?: string | null;
  vendor?: string | null;
  status?: string | null;
  limit?: number;
}): Promise<RmsGridRow[]> {
  return callRpc<RmsGridRow>("fetch_rms_by_grid", {
    in_date_from: f.date_from,
    in_date_to: f.date_to,
    in_subregion: f.subregion ?? null,
    in_grid: f.grid ?? null,
    in_district: f.district ?? null,
    in_class: f.site_class ?? null,
    in_vendor: f.vendor ?? null,
    in_status: f.status ?? null,
    in_limit: f.limit ?? 20,
  });
}

import supabase from "@/app/config/supabase-config";

/* ---------- Existing daily RPC types (unchanged) ---------- */
export type TrafficDailyRow = {
  date: string;
  voice_2g: number | null;
  voice_3g: number | null;
  volte_voice: number | null;
  voice_erl: number | null;
  data_2g_gb: number | null;
  data_3g_gb: number | null;
  data_4g_gb: number | null;
  total_gb: number | null;
};
export type TrafficDailyParams = {
  date_from?: string | null;
  date_to?: string | null;
  subregion?: string | null;
};
export async function fetchTrafficDaily(
  params?: TrafficDailyParams
): Promise<TrafficDailyRow[]> {
  const { data, error } = await supabase.rpc("rpc_traffic_daily", {
    in_date_from: params?.date_from ?? null,
    in_date_to: params?.date_to ?? null,
    in_subregion: params?.subregion ?? null,
  });
  if (error) throw error;
  const arr: unknown[] = Array.isArray(data) ? data : [];
  return arr.map((x) => {
    const r = x as Partial<TrafficDailyRow>;
    return {
      date: String(r.date ?? "").slice(0, 10),
      voice_2g: r.voice_2g ?? 0,
      voice_3g: r.voice_3g ?? 0,
      volte_voice: r.volte_voice ?? 0,
      voice_erl: r.voice_erl ?? 0,
      data_2g_gb: r.data_2g_gb ?? 0,
      data_3g_gb: r.data_3g_gb ?? 0,
      data_4g_gb: r.data_4g_gb ?? 0,
      total_gb: r.total_gb ?? 0,
    };
  });
}

/* ---------- Subregions RPC ---------- */
export type SubregionRow = { subregion: string | null };
export async function fetchSubregions(): Promise<string[]> {
  const { data, error } = await supabase.rpc("fetch_ssl_subregions");
  if (error) throw error;
  const arr: unknown[] = Array.isArray(data) ? data : [];
  const seen = new Map<string, string>();
  for (const x of arr) {
    const r = x as Partial<SubregionRow>;
    const val = String(r.subregion ?? "").trim();
    if (!val) continue;
    const k = val.toLowerCase();
    if (!seen.has(k)) seen.set(k, val);
  }
  return Array.from(seen.values());
}

/* ---------- NEW: Latest-day totals by Grid & District ---------- */
export type LatestAggRow = {
  key: string; // grid or district
  latest_date: string;
  total_gb: number;
  voice_erl: number;
};

type RpcLatestGridRow = {
  grid: string | null;
  latest_date: string | null;
  total_gb: number | null;
  voice_erl: number | null;
};
type RpcLatestDistrictRow = {
  district: string | null;
  latest_date: string | null;
  total_gb: number | null;
  voice_erl: number | null;
};

function toLatestAggFromGrid(x: unknown): LatestAggRow | null {
  const r = x as Partial<RpcLatestGridRow> | null;
  if (!r) return null;
  return {
    key: String(r.grid ?? "UNKNOWN"),
    latest_date: String(r.latest_date ?? "").slice(0, 10),
    total_gb: Number(r.total_gb ?? 0),
    voice_erl: Number(r.voice_erl ?? 0),
  };
}
function toLatestAggFromDistrict(x: unknown): LatestAggRow | null {
  const r = x as Partial<RpcLatestDistrictRow> | null;
  if (!r) return null;
  return {
    key: String(r.district ?? "UNKNOWN"),
    latest_date: String(r.latest_date ?? "").slice(0, 10),
    total_gb: Number(r.total_gb ?? 0),
    voice_erl: Number(r.voice_erl ?? 0),
  };
}

export async function fetchLatestByGrid(
  subregion: string | null
): Promise<LatestAggRow[]> {
  const { data, error } = await supabase.rpc("rpc_traffic_latest_by_grid", {
    in_subregion: subregion,
  });
  if (error) throw error;
  const arr: unknown[] = Array.isArray(data) ? data : [];
  const out: LatestAggRow[] = [];
  for (const x of arr) {
    const row = toLatestAggFromGrid(x);
    if (row) out.push(row);
  }
  return out;
}

export async function fetchLatestByDistrict(
  subregion: string | null
): Promise<LatestAggRow[]> {
  const { data, error } = await supabase.rpc("rpc_traffic_latest_by_district", {
    in_subregion: subregion,
  });
  if (error) throw error;
  const arr: unknown[] = Array.isArray(data) ? data : [];
  const out: LatestAggRow[] = [];
  for (const x of arr) {
    const row = toLatestAggFromDistrict(x);
    if (row) out.push(row);
  }
  return out;
}

/* ---------- Simple sort helper ---------- */
export type SortKey = "total_gb" | "voice_erl";
export type SortDir = "asc" | "desc";

export function sortLatest(
  rows: LatestAggRow[],
  key: SortKey,
  dir: SortDir
): LatestAggRow[] {
  const s = [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    return av === bv ? a.key.localeCompare(b.key) : av < bv ? -1 : 1;
  });
  return dir === "desc" ? s.reverse() : s;
}

/* ---------- NEW: 30-day variation by Grid ---------- */

type RpcGridVarRow = {
  grid: string | null;
  curr_30_total_gb: number | null;
  prev_30_total_gb: number | null;
  curr_30_voice_erl: number | null;
  prev_30_voice_erl: number | null;
};

export type GridVariationRow = {
  grid: string;
  data_curr: number;
  data_prev: number;
  data_delta: number;
  data_delta_pct: number | null;
  voice_curr: number;
  voice_prev: number;
  voice_delta: number;
  voice_delta_pct: number | null;
};

export async function fetchGridVariation(
  subregion: string | null
): Promise<GridVariationRow[]> {
  const { data, error } = await supabase.rpc("rpc_traffic_grid_variation", {
    in_subregion: subregion,
  });
  if (error) throw error;

  const arr: unknown[] = Array.isArray(data) ? data : [];
  const out: GridVariationRow[] = [];

  for (const x of arr) {
    const r = x as Partial<RpcGridVarRow>;
    const grid = String(r.grid ?? "UNKNOWN");
    const data_curr = Number(r.curr_30_total_gb ?? 0);
    const data_prev = Number(r.prev_30_total_gb ?? 0);
    const voice_curr = Number(r.curr_30_voice_erl ?? 0);
    const voice_prev = Number(r.prev_30_voice_erl ?? 0);

    const data_delta = data_curr - data_prev;
    const voice_delta = voice_curr - voice_prev;

    const data_delta_pct =
      data_prev !== 0 ? (data_delta / data_prev) * 100 : null;
    const voice_delta_pct =
      voice_prev !== 0 ? (voice_delta / voice_prev) * 100 : null;

    out.push({
      grid,
      data_curr,
      data_prev,
      data_delta,
      data_delta_pct,
      voice_curr,
      voice_prev,
      voice_delta,
      voice_delta_pct,
    });
  }

  // optional: sort by absolute data change desc, then grid asc
  out.sort(
    (a, b) =>
      Math.abs(b.data_delta) - Math.abs(a.data_delta) ||
      a.grid.localeCompare(b.grid)
  );
  return out;
}

/* ---------- NEW: Sites for selected Grid (latest day) ---------- */

type RpcSiteInGridRow = {
  site_name: string | null;
  site_class: string | null;
  latest_date: string | null;
  total_gb: number | null;
  voice_erl: number | null;
};

export type SiteInGridRow = {
  site_name: string;
  site_class: string;
  latest_date: string;
  total_gb: number;
  voice_erl: number;
};

export async function fetchSitesByGridLatest(
  grid: string,
  subregion: string | null
): Promise<SiteInGridRow[]> {
  const { data, error } = await supabase.rpc("rpc_sites_by_grid_latest", {
    in_grid: grid,
    in_subregion: subregion,
  });
  if (error) throw error;

  const arr: unknown[] = Array.isArray(data) ? data : [];
  const out: SiteInGridRow[] = [];

  for (const x of arr) {
    const r = x as Partial<RpcSiteInGridRow>;
    out.push({
      site_name: String(r.site_name ?? "UNKNOWN"),
      site_class: String(r.site_class ?? "-"),
      latest_date: String(r.latest_date ?? "").slice(0, 10),
      total_gb: Number(r.total_gb ?? 0),
      voice_erl: Number(r.voice_erl ?? 0),
    });
  }

  // sort by data desc, then voice desc, then site_name asc
  out.sort(
    (a, b) =>
      b.total_gb - a.total_gb ||
      b.voice_erl - a.voice_erl ||
      a.site_name.localeCompare(b.site_name)
  );
  return out;
}






/* ================== Point-change types (Grid & Sites) ================== */

export type GridPointChangeRow = {
  grid: string;
  latest_date: string;  // ISO
  prior_date: string | null; // ISO or null
  data_old: number | null;
  data_new: number | null;
  data_delta: number | null;
  data_delta_pct: number | null;
  voice_old: number | null;
  voice_new: number | null;
  voice_delta: number | null;
  voice_delta_pct: number | null;
};

type RpcGridPointChange = {
  grid: string | null;
  latest_date: string | null;
  prior_date: string | null;
  data_old: number | null;
  data_new: number | null;
  data_delta: number | null;
  data_delta_pct: number | null;
  voice_old: number | null;
  voice_new: number | null;
  voice_delta: number | null;
  voice_delta_pct: number | null;
};

export async function fetchGridPointChange(
  subregion: string | null
): Promise<GridPointChangeRow[]> {
  const { data, error } = await supabase.rpc("rpc_traffic_grid_point_change", {
    in_subregion: subregion,
  });
  if (error) throw error;

  const arr: unknown[] = Array.isArray(data) ? data : [];
  const out: GridPointChangeRow[] = [];

  for (const x of arr) {
    const r = x as Partial<RpcGridPointChange>;
    out.push({
      grid: String(r.grid ?? "UNKNOWN"),
      latest_date: String(r.latest_date ?? "").slice(0, 10),
      prior_date: r.prior_date ? String(r.prior_date).slice(0, 10) : null,
      data_old: r.data_old ?? null,
      data_new: r.data_new ?? null,
      data_delta: r.data_delta ?? null,
      data_delta_pct: r.data_delta_pct ?? null,
      voice_old: r.voice_old ?? null,
      voice_new: r.voice_new ?? null,
      voice_delta: r.voice_delta ?? null,
      voice_delta_pct: r.voice_delta_pct ?? null,
    });
  }

  // Sort by absolute data_delta desc, then grid asc
  out.sort(
    (a, b) =>
      (Math.abs(b.data_delta ?? 0) - Math.abs(a.data_delta ?? 0)) ||
      a.grid.localeCompare(b.grid)
  );
  return out;
}

/* ----------------------------- Sites in Grid ----------------------------- */

export type SitePointChangeRow = {
  site_name: string;
  site_class: string;
  latest_date: string;      // ISO
  prior_date: string | null; // ISO or null
  data_old: number | null;
  data_new: number | null;
  data_delta: number | null;
  data_delta_pct: number | null;
  voice_old: number | null;
  voice_new: number | null;
  voice_delta: number | null;
  voice_delta_pct: number | null;
};

type RpcSitePointChange = {
  site_name: string | null;
  site_class: string | null;
  latest_date: string | null;
  prior_date: string | null;
  data_old: number | null;
  data_new: number | null;
  data_delta: number | null;
  data_delta_pct: number | null;
  voice_old: number | null;
  voice_new: number | null;
  voice_delta: number | null;
  voice_delta_pct: number | null;
};

export async function fetchSitesPointChange(
  grid: string,
  subregion: string | null
): Promise<SitePointChangeRow[]> {
  const { data, error } = await supabase.rpc("rpc_traffic_sites_point_change", {
    in_grid: grid,
    in_subregion: subregion,
  });
  if (error) throw error;

  const arr: unknown[] = Array.isArray(data) ? data : [];
  const out: SitePointChangeRow[] = [];

  for (const x of arr) {
    const r = x as Partial<RpcSitePointChange>;
    out.push({
      site_name: String(r.site_name ?? "UNKNOWN"),
      site_class: String(r.site_class ?? "-"),
      latest_date: String(r.latest_date ?? "").slice(0, 10),
      prior_date: r.prior_date ? String(r.prior_date).slice(0, 10) : null,
      data_old: r.data_old ?? null,
      data_new: r.data_new ?? null,
      data_delta: r.data_delta ?? null,
      data_delta_pct: r.data_delta_pct ?? null,
      voice_old: r.voice_old ?? null,
      voice_new: r.voice_new ?? null,
      voice_delta: r.voice_delta ?? null,
      voice_delta_pct: r.voice_delta_pct ?? null,
    });
  }

  // Sort: biggest data change first, then voice, then name
  out.sort(
    (a, b) =>
      (Math.abs(b.data_delta ?? 0) - Math.abs(a.data_delta ?? 0)) ||
      (Math.abs(b.voice_delta ?? 0) - Math.abs(a.voice_delta ?? 0)) ||
      a.site_name.localeCompare(b.site_name)
  );
  return out;
}
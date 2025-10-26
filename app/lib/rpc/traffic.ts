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
export async function fetchTrafficDaily(params?: TrafficDailyParams): Promise<TrafficDailyRow[]> {
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
  key: string;        // grid or district
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

export async function fetchLatestByGrid(subregion: string | null): Promise<LatestAggRow[]> {
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

export async function fetchLatestByDistrict(subregion: string | null): Promise<LatestAggRow[]> {
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

export function sortLatest(rows: LatestAggRow[], key: SortKey, dir: SortDir): LatestAggRow[] {
  const s = [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    return av === bv ? a.key.localeCompare(b.key) : (av < bv ? -1 : 1);
  });
  return dir === "desc" ? s.reverse() : s;
}

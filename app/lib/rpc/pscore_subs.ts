import supabase from "@/app/config/supabase-config";

/* ---------------- Types ---------------- */
export interface PsCoreRow {
  ReportDate: string | null;
  "2G_Attach": number | null;
  "3G_Attach": number | null;
  "3G_Cloud_Attach": number | null;
  "4G_Attach": number | null;
  "4G_Cloud_Attach": number | null;
  "2G_Active": number | null;
  "3G_Active": number | null;
  "3G_Active_Cloud": number | null;
  "4G_Active": number | null;
  "4G_Active_Cloud": number | null;
  Total_Attach_Users: number | null;
  Total_Active_Users: number | null;
}

export interface DailyPoint {
  d: string;
  attach_total: number | null;
  active_total: number | null;
  attach_2g: number | null;
  attach_3g_total: number | null;
  attach_4g_total: number | null;
  active_2g: number | null;
  active_3g_total: number | null;
  active_4g_total: number | null;
}

export interface LatestKpis {
  date: string;
  total_attach: number;
  total_active: number;
  attach_4g_total: number;
  active_4g_total: number;
  dod_attach?: number | null;
  dod_active?: number | null;
  wow_attach?: number | null;
  wow_active?: number | null;
}

/* ---------------- Helpers ---------------- */
const toNum = (n: number | null | undefined) => (typeof n === "number" ? n : 0);

/* ---------------- Fetch paginated full table ---------------- */
export async function fetchDailySeries(): Promise<DailyPoint[]> {
  const pageSize = 2000;
  let from = 0;
  const all: PsCoreRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("PS_Core_Subscribers")
      .select("*")
      .order("ReportDate", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    all.push(...(data as PsCoreRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all
    .filter((r) => r.ReportDate)
    .map((r) => ({
      d: r.ReportDate!,
      attach_total: r.Total_Attach_Users,
      active_total: r.Total_Active_Users,
      attach_2g: r["2G_Attach"],
      attach_3g_total: toNum(r["3G_Attach"]) + toNum(r["3G_Cloud_Attach"]),
      attach_4g_total: toNum(r["4G_Attach"]) + toNum(r["4G_Cloud_Attach"]),
      active_2g: r["2G_Active"],
      active_3g_total: toNum(r["3G_Active"]) + toNum(r["3G_Active_Cloud"]),
      active_4g_total: toNum(r["4G_Active"]) + toNum(r["4G_Active_Cloud"]),
    }));
}

/* ---------------- Fetch Latest KPIs ---------------- */
export async function fetchLatestKpis(): Promise<LatestKpis | null> {
  const { data, error } = await supabase
    .from("PS_Core_Subscribers")
    .select("*")
    .order("ReportDate", { ascending: false })
    .limit(8);

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;

  const rows = data as PsCoreRow[];
  const latest = rows[0];
  const prev = rows[1];
  const weekAgo = rows[7];

  const date = latest.ReportDate!;
  const total_attach = toNum(latest.Total_Attach_Users);
  const total_active = toNum(latest.Total_Active_Users);
  const attach_4g_total =
    toNum(latest["4G_Attach"]) + toNum(latest["4G_Cloud_Attach"]);
  const active_4g_total =
    toNum(latest["4G_Active"]) + toNum(latest["4G_Active_Cloud"]);

  const dod_attach = prev
    ? total_attach - toNum(prev.Total_Attach_Users)
    : null;
  const dod_active = prev
    ? total_active - toNum(prev.Total_Active_Users)
    : null;
  const wow_attach = weekAgo
    ? total_attach - toNum(weekAgo.Total_Attach_Users)
    : null;
  const wow_active = weekAgo
    ? total_active - toNum(weekAgo.Total_Active_Users)
    : null;

  return {
    date,
    total_attach,
    total_active,
    attach_4g_total,
    active_4g_total,
    dod_attach,
    dod_active,
    wow_attach,
    wow_active,
  };
}

// app/lib/rpc/avail_KPI.ts
import supabase from "@/app/config/supabase-config";

/* =========================
   Types
========================= */

export type Group = "PGS" | "SB";
export type Grain = "Daily" | "Weekly" | "Monthly";
export type Region = "ALL" | "North" | "Central" | "South";

export type SummaryRow = {
  label: string;
  parent_region: string;
  base: number | null; // percent (0..100)
  target: number | null; // percent (0..100)
  target_and_base_not_achieved: number | null;
  base_achieved: number | null;
  target_achieved: number | null;
  blank_status_rows: number | null;
  total_sites: number | null;
  achievement: number | null; // percent (0..100)
  score: number | null; // percent (0..100)
};

export type MaxDateRow = { max_date: string };

/* =========================
   Parsers
========================= */

export function parseGrain(v: string | null): Grain {
  if (v === "Weekly") return "Weekly";
  if (v === "Monthly") return "Monthly";
  return "Daily";
}

export function parseRegion(v: string | null): Region {
  if (v === "North" || v === "Central" || v === "South") return v;
  return "ALL";
}

/* =========================
   Utils
========================= */

function isISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function firstDayOfMonthFromYYYYMM(yyyymm: string): string {
  if (!/^\d{4}-\d{2}$/.test(yyyymm)) return "";
  return `${yyyymm}-01`;
}

export function yyyymmFromISO(iso: string): string {
  if (!isISODate(iso)) return "";
  return iso.slice(0, 7);
}

/* =========================
   RPC Calls
========================= */

/** MUST exist in DB: fetch_availability_kpi_max_date(p_group,p_region) */
export async function fetchAvailabilityKpiMaxDate(args: {
  group: Group | null; // null => both groups
  region: Exclude<Region, "ALL"> | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc(
    "fetch_availability_kpi_max_date",
    {
      p_group: args.group,
      p_region: args.region,
    }
  );

  if (error) throw error;

  const row = (data?.[0] ?? null) as MaxDateRow | null;
  return row?.max_date ?? "";
}

/**
 * ✅ SINGLE RPC FOR BOTH PGS & SB
 * MUST exist in DB:
 *   fetch_availability_kpi_summary(p_group, p_date, p_region)
 */
export async function fetchAvailabilityKpiSummary(args: {
  group: Group; // PGS | SB
  dateISO: string | null; // YYYY-MM-DD
  region: Region; // ALL => null
}): Promise<SummaryRow[]> {
  const p_date = args.dateISO && isISODate(args.dateISO) ? args.dateISO : null;
  const p_region = args.region === "ALL" ? null : args.region;

  const { data, error } = await supabase.rpc("fetch_availability_kpi_summary", {
    p_group: args.group,
    p_date,
    p_region,
  });

  if (error) throw error;

  return (data ?? []) as SummaryRow[];
}

/* =========================
   Merge helpers (ALL cards)
========================= */

const w = (v: number | null | undefined, t: number) => (v == null ? 0 : v * t);

export function mergeAllRow(
  pgsAll: SummaryRow | null,
  sbAll: SummaryRow | null
): SummaryRow {
  const pTotal = pgsAll?.total_sites ?? 0;
  const sTotal = sbAll?.total_sites ?? 0;
  const total = pTotal + sTotal;

  return {
    label: "All",
    parent_region: "All",
    total_sites: total,

    target_achieved:
      (pgsAll?.target_achieved ?? 0) + (sbAll?.target_achieved ?? 0),
    base_achieved: (pgsAll?.base_achieved ?? 0) + (sbAll?.base_achieved ?? 0),
    target_and_base_not_achieved:
      (pgsAll?.target_and_base_not_achieved ?? 0) +
      (sbAll?.target_and_base_not_achieved ?? 0),
    blank_status_rows:
      (pgsAll?.blank_status_rows ?? 0) + (sbAll?.blank_status_rows ?? 0),

    achievement:
      total > 0
        ? (w(pgsAll?.achievement, pTotal) + w(sbAll?.achievement, sTotal)) /
          total
        : null,
    score:
      total > 0
        ? (w(pgsAll?.score, pTotal) + w(sbAll?.score, sTotal)) / total
        : null,

    base:
      total > 0
        ? (w(pgsAll?.base, pTotal) + w(sbAll?.base, sTotal)) / total
        : null,
    target:
      total > 0
        ? (w(pgsAll?.target, pTotal) + w(sbAll?.target, sTotal)) / total
        : null,
  };
}

export function mergeRowByKey(
  pgsRows: SummaryRow[],
  sbRows: SummaryRow[],
  label: string,
  parent_region: string
): SummaryRow | null {
  const p =
    pgsRows.find(
      (r) => r.label === label && r.parent_region === parent_region
    ) ?? null;
  const s =
    sbRows.find(
      (r) => r.label === label && r.parent_region === parent_region
    ) ?? null;

  if (!p && !s) return null;

  const pTotal = p?.total_sites ?? 0;
  const sTotal = s?.total_sites ?? 0;
  const total = pTotal + sTotal;

  return {
    label,
    parent_region,
    total_sites: total,

    target_achieved: (p?.target_achieved ?? 0) + (s?.target_achieved ?? 0),
    base_achieved: (p?.base_achieved ?? 0) + (s?.base_achieved ?? 0),
    target_and_base_not_achieved:
      (p?.target_and_base_not_achieved ?? 0) +
      (s?.target_and_base_not_achieved ?? 0),
    blank_status_rows:
      (p?.blank_status_rows ?? 0) + (s?.blank_status_rows ?? 0),

    achievement:
      total > 0
        ? (w(p?.achievement, pTotal) + w(s?.achievement, sTotal)) / total
        : null,
    score:
      total > 0 ? (w(p?.score, pTotal) + w(s?.score, sTotal)) / total : null,

    base: total > 0 ? (w(p?.base, pTotal) + w(s?.base, sTotal)) / total : null,
    target:
      total > 0 ? (w(p?.target, pTotal) + w(s?.target, sTotal)) / total : null,
  };
}

/* =========================
   Months helper
========================= */

export function buildRecentMonths(maxISO: string, count = 18): string[] {
  if (!isISODate(maxISO)) return [];
  const y = Number(maxISO.slice(0, 4));
  const m = Number(maxISO.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return [];

  const out: string[] = [];
  let yy = y;
  let mm = m;

  for (let i = 0; i < count; i++) {
    out.push(`${yy}-${String(mm).padStart(2, "0")}`);
    mm -= 1;
    if (mm === 0) {
      mm = 12;
      yy -= 1;
    }
  }
  return out;
}

/* =========================
   ✅ Site-level RPC
========================= */

export type SiteRow = {
  sitename: number | null;
  category: string | null;
  achievement: number | null; // percent (0..100)
  target_status: string | null;
  score: number | null; // percent (0..100)
};

export async function fetchAvailabilityKpiSites(args: {
  group: Group; // PGS|SB
  dateISO: string; // required YYYY-MM-DD
  region: Exclude<Region, "ALL"> | null;
  subRegion: string | null;
  search: string | null;
  limit?: number;
  offset?: number;
}): Promise<SiteRow[]> {
  const p_limit = args.limit ?? 200;
  const p_offset = args.offset ?? 0;

  const { data, error } = await supabase.rpc("fetch_availability_kpi_sites", {
    p_group: args.group,
    p_date: args.dateISO,
    p_region: args.region,
    p_sub_region: args.subRegion,
    p_search: args.search ?? null,
    p_limit,
    p_offset,
  });

  if (error) throw error;

  return (data ?? []) as SiteRow[];
}

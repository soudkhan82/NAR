import supabase from "@/app/config/supabase-config";

/** Every point has ISO date plus numeric metrics (flat shape) */
export interface IspSeriesPoint {
  date: string;
  [metric: string]: number | string; // metrics are numbers; `date` is the only string
}

export type IspTimeseries = {
  series: IspSeriesPoint[];
  numericKeys: string[]; // auto-detected numeric columns (excludes id, created_at, report_date)
};

export type IspNumericSummary = {
  numericKeys: string[];
  sums: Record<string, number>;
  avgs: Record<string, number>;
  counts: Record<string, number>;
  rowCount: number;
};

type FetchCommon = {
  table?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
};

const EXCLUDE_BASE = new Set(["id", "created_at", "report_date"]);

/* ---------- small helpers ---------- */
const toNum = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const isoDate = (d: unknown): string | null => {
  if (!d) return null;
  const t = new Date(String(d));
  return Number.isFinite(+t) ? t.toISOString().slice(0, 10) : null;
};

/* ---------- Timeseries ---------- */
export async function fetchIspTimeseries(
  params?: FetchCommon & { pick?: string[] }
): Promise<IspTimeseries> {
  const table = params?.table ?? "ISP_summary";
  const { dateFrom, dateTo, pick } = params ?? {};

  let q = supabase
    .from(table)
    .select("*")
    .order("report_date", { ascending: true });
  if (dateFrom) q = q.gte("report_date", dateFrom);
  if (dateTo) q = q.lte("report_date", dateTo);

  const { data: rows, error } = await q;
  if (error) throw error;

  const numericSet = new Set<string>();
  const series: IspSeriesPoint[] = [];

  type Row = Record<string, unknown> & { report_date?: string | Date };
  for (const row of (rows ?? []) as Row[]) {
    const d = isoDate(row.report_date);
    if (!d) continue;

    const point: IspSeriesPoint = { date: d };

    for (const [k, v] of Object.entries(row)) {
      if (EXCLUDE_BASE.has(k)) continue;
      if (pick && !pick.includes(k)) continue;

      const n = toNum(v);
      if (n !== null) {
        point[k] = n;
        numericSet.add(k);
      }
    }
    series.push(point);
  }

  const numericKeys = [...numericSet].sort();

  // Fill missing metrics with 0 for consistency
  for (const p of series) {
    for (const k of numericKeys) {
      if (!(k in p)) {
        p[k] = 0;
      }
    }
  }

  return { series, numericKeys };
}

/* ---------- Numeric summary (Sum/Avg over date range) ---------- */
export async function fetchIspNumericSummary(
  params?: FetchCommon & { exclude?: string[] }
): Promise<IspNumericSummary> {
  const table = params?.table ?? "ISP_summary";
  const { dateFrom, dateTo } = params ?? {};
  const exclude = new Set([...EXCLUDE_BASE, ...(params?.exclude ?? [])]);

  let q = supabase.from(table).select("*");
  if (dateFrom) q = q.gte("report_date", dateFrom);
  if (dateTo) q = q.lte("report_date", dateTo);

  const { data: rows, error } = await q;
  if (error) throw error;

  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  const numericSet = new Set<string>();

  for (const row of (rows ?? []) as Record<string, unknown>[]) {
    for (const [k, v] of Object.entries(row)) {
      if (exclude.has(k)) continue;
      const n = toNum(v);
      if (n !== null) {
        numericSet.add(k);
        sums[k] = (sums[k] ?? 0) + n;
        counts[k] = (counts[k] ?? 0) + 1;
      }
    }
  }

  const numericKeys = [...numericSet].sort();
  const avgs: Record<string, number> = {};
  for (const k of numericKeys) {
    const c = counts[k] ?? 0;
    avgs[k] = c ? (sums[k] ?? 0) / c : 0;
  }

  return {
    numericKeys,
    sums,
    avgs,
    counts,
    rowCount: rows?.length ?? 0,
  };
}

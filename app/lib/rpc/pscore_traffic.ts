import supabase from "@/app/config/supabase-config";

/* ---------- Types ---------- */
export interface PsCoreTrafficRow {
  ReportDate: string | null;
  KHI_UGW_2_Throughput: number | null;
  ISB_UGW_2_Throughput: number | null;
  LHR_UGW_2_Throughput: number | null;
  LHR_UGW_3_Throughput: number | null;
  ISB_UGW_Throughput: number | null;
  LHR_UGW_4_Throughput: number | null;
  KHI_UGW_Throughput: number | null;
  LHR_UGW_Throughput: number | null;
  LHR_VDGW01_Throughput: number | null;
  LHR_VDGW02_Throughput: number | null;
  ISB_VDGW02_Throughput: number | null;
  KHI_VDGW01_Throughput: number | null;
  ISB_VDGW01_Throughput: number | null;
  KHI_VDGW02_Throughput: number | null;
  ISB_UPF01_Throughput: number | null;
  LHR_UPF01_Throughput: number | null;
  Total_Throughput_Gbps: number | null;
  KHI_UGW_2_Volume: number | null;
  ISB_UGW_2_Volume: number | null;
  LHR_UGW_2_Volume: number | null;
  LHR_UGW_3_Volume: number | null;
  ISB_UGW_Volume: number | null;
  LHR_UGW_4_Volume: number | null;
  KHI_UGW_Volume: number | null;
  LHR_UGW_Volume: number | null;
  LHR_VDGW01_Volume: number | null;
  LHR_VDGW02_Volume: number | null;
  ISB_VDGW02_Volume: number | null;
  KHI_VDGW01_Volume: number | null;
  ISB_VDGW01_Volume: number | null;
  KHI_VDGW02_Volume: number | null;
  ISB_UPF01_Volume: number | null;
  LHR_UPF01_Volume: number | null;
  Total_Traffic_TB: number | null;
}

export interface TrafficPoint {
  d: string;
  [key: string]: number | string | null;
}

/* ---------- Helper ---------- */
const toNum = (n: number | null | undefined) => (typeof n === "number" ? n : 0);

/* ---------- Fetch All (Paginated) ---------- */
export async function fetchTrafficSeries(): Promise<TrafficPoint[]> {
  const pageSize = 2000;
  let from = 0;
  const all: PsCoreTrafficRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("PS_Core_Traffic")
      .select("*")
      .order("ReportDate", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    all.push(...(data as PsCoreTrafficRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all
    .filter((r) => r.ReportDate)
    .map((r) => ({
      d: r.ReportDate!,
      ...r,
    }));
}

// app/Rms/rmsDetails.tsx
import Link from "next/link";
import supabase from "@/app/config/supabase-config";
import RmsDetailsClient from "./RmsDetailsClient";

export type SiteRow = {
  sitename: string | null;
  region: string | null;
  subregion: string | null;
  grid: string | null;
  district: string | null;
  siteclassification: string | null;
};

export type GridAggRow = {
  grid: string; // normalized (never null) for UI
  site_count: number;
};

function safeKey(v: string | null | undefined) {
  const t = (v ?? "").trim();
  return t.length ? t : "(Blank)";
}

export default async function RmsDetailsView({
  subregion,
  indicator,
  label,
}: {
  subregion: string;
  indicator: string;
  label: string;
}) {
  const { data, error } = await supabase.rpc("fetch_rms_sites_by_indicator", {
    p_subregion: subregion,
    p_indicator: indicator,
  });

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
          <div className="text-lg font-semibold">RMS Details</div>
          <p className="mt-2 text-sm text-slate-300">Error: {error.message}</p>
          <Link className="inline-block mt-4 underline" href="/Rms">
            ← Back to Summary
          </Link>
        </div>
      </div>
    );
  }

  const allRows = (data ?? []) as SiteRow[];

  // Grid breakdown (computed once on server)
  const gridMap = new Map<string, number>();
  for (const r of allRows) {
    const g = safeKey(r.grid);
    gridMap.set(g, (gridMap.get(g) ?? 0) + 1);
  }

  const gridAgg: GridAggRow[] = Array.from(gridMap.entries())
    .map(([grid, site_count]) => ({ grid, site_count }))
    .sort(
      (a, b) => b.site_count - a.site_count || a.grid.localeCompare(b.grid)
    );

  // Default grid requirement:
  // "By default the SiteList should display all results of Grid in top row"
  // -> choose the first gridAgg row (largest count) if exists.
  const defaultGrid = gridAgg.length > 0 ? gridAgg[0].grid : "All";

  return (
    <RmsDetailsClient
      subregion={subregion}
      indicator={indicator}
      label={label}
      allRows={allRows}
      gridAgg={gridAgg}
      defaultGrid={defaultGrid}
    />
  );
}

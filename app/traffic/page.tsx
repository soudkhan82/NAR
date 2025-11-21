// app/traffic/TrafficClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

import {
  fetchTrafficDaily,
  fetchSubregions,
  type TrafficDailyRow,
  fetchLatestByGrid,
  fetchLatestByDistrict,
  type LatestAggRow,
  sortLatest,
  type SortKey,
  type SortDir,
  // point-change RPCs (return rows with number|null + dates)
  fetchGridPointChange,
  fetchSitesPointChange,
} from "@/app/lib/rpc/traffic";

/* ------------------------ Link to SiteQuery ----------------------- */
const openSite = (siteName: string) => {
  const id = encodeURIComponent(siteName || "UNKNOWN");
  window.open(`/sitequery/${id}`, "_blank", "noopener,noreferrer");
};

/* ------------------------ Number formatting ----------------------- */
const nf2 = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const yTickFmt = (v: number) => nf2.format(Number(v));
const tipFmt = (v: unknown) => nf2.format(Number(v));
const tipLabelFmt = (label: string) => label;

/* ------------------- Gradient cell background -------------------- */
function cellGradientStyle(
  valueAbs: number,
  maxAbs: number,
  color: "data" | "voice"
): React.CSSProperties {
  const pct =
    maxAbs > 0 ? Math.max(0, Math.min(100, (valueAbs / maxAbs) * 100)) : 0;
  const col =
    color === "data" ? "rgba(37, 99, 235, 0.18)" : "rgba(22, 163, 74, 0.18)";
  return {
    background: `linear-gradient(90deg, ${col} ${pct}%, transparent ${pct}%)`,
  };
}
const deltaIcon = (v: number) =>
  v > 0 ? (
    <span className="text-green-600">▲</span>
  ) : v < 0 ? (
    <span className="text-red-600">▼</span>
  ) : (
    <span className="text-gray-400">•</span>
  );

/* -------- Local display types (non-null numbers to avoid TS errors) ------- */
type GridChangeRow = {
  grid: string;
  data_old: number;
  data_new: number;
  data_delta: number;
  data_delta_pct: number | null;
  voice_old: number;
  voice_new: number;
  voice_delta: number;
  voice_delta_pct: number | null;
};
type SiteChangeRow = {
  site_name: string;
  site_class: string;
  data_old: number;
  data_new: number;
  data_delta: number;
  data_delta_pct: number | null;
  voice_old: number;
  voice_new: number;
  voice_delta: number;
  voice_delta_pct: number | null;
};

/* ------------------------------- UI ------------------------------- */
export default function TrafficClient() {
  const [subs, setSubs] = useState<string[]>([]);
  const [selectedSub, setSelectedSub] = useState<string>("__ALL__");

  const [daily, setDaily] = useState<TrafficDailyRow[]>([]);
  const [gridLatest, setGridLatest] = useState<LatestAggRow[]>([]);
  const [districtLatest, setDistrictLatest] = useState<LatestAggRow[]>([]);

  // point-change state (normalized to non-nullable numbers)
  const [gridChange, setGridChange] = useState<GridChangeRow[]>([]);
  const [siteChange, setSiteChange] = useState<SiteChangeRow[]>([]);
  const [selectedGrid, setSelectedGrid] = useState<string | null>(null);

  //Sorting
  const [siteSortKey, setSiteSortKey] = useState<
    "data_delta_pct" | "voice_delta_pct"
  >("data_delta_pct");
  const [siteSortDir, setSiteSortDir] = useState<"asc" | "desc">("desc");

  // dates (single header above Grid table)
  const [latestDate, setLatestDate] = useState<string | null>(null);
  const [oldDate, setOldDate] = useState<string | null>(null);

  const [gridSortKey, setGridSortKey] = useState<SortKey>("total_gb");
  const [gridSortDir, setGridSortDir] = useState<SortDir>("desc");
  const [distSortKey, setDistSortKey] = useState<SortKey>("total_gb");
  const [distSortDir, setDistSortDir] = useState<SortDir>("desc");

  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  // Load SubRegion options
  useEffect(() => {
    (async () => {
      try {
        const list = await fetchSubregions();
        setSubs(list);
      } catch (e) {
        setErr((e as Error)?.message ?? "Failed to load subregions");
      }
    })();
  }, []);

  // Fetch on SubRegion change
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const sub = selectedSub === "__ALL__" ? null : selectedSub;

        const [dArr, gArr, diArr, gChangeRaw] = await Promise.all([
          fetchTrafficDaily({ date_from: null, date_to: null, subregion: sub }),
          fetchLatestByGrid(sub),
          fetchLatestByDistrict(sub),
          fetchGridPointChange(sub), // returns nullable numbers + dates
        ]);

        setDaily(dArr);
        setGridLatest(gArr);
        setDistrictLatest(diArr);

        // Capture dates for header (from the first row)
        setLatestDate(gChangeRaw[0]?.latest_date ?? null);
        setOldDate(gChangeRaw[0]?.prior_date ?? null);

        // Normalize to non-null numbers
        const gNorm: GridChangeRow[] = gChangeRaw.map((r) => ({
          grid: r.grid,
          data_old: Number(r.data_old ?? 0),
          data_new: Number(r.data_new ?? 0),
          data_delta: Number(
            r.data_delta ?? (r.data_new ?? 0) - (r.data_old ?? 0)
          ),
          data_delta_pct:
            r.data_delta_pct ??
            (r.data_old
              ? ((Number(r.data_new ?? 0) - Number(r.data_old ?? 0)) /
                  Number(r.data_old)) *
                100
              : null),
          voice_old: Number(r.voice_old ?? 0),
          voice_new: Number(r.voice_new ?? 0),
          voice_delta: Number(
            r.voice_delta ?? (r.voice_new ?? 0) - (r.voice_old ?? 0)
          ),
          voice_delta_pct:
            r.voice_delta_pct ??
            (r.voice_old
              ? ((Number(r.voice_new ?? 0) - Number(r.voice_old ?? 0)) /
                  Number(r.voice_old)) *
                100
              : null),
        }));
        setGridChange(gNorm);

        // reset site state
        setSelectedGrid(null);
        setSiteChange([]);
      } catch (e) {
        setErr((e as Error)?.message ?? "Failed to load data");
        setDaily([]);
        setGridLatest([]);
        setDistrictLatest([]);
        setGridChange([]);
        setSelectedGrid(null);
        setSiteChange([]);
        setLatestDate(null);
        setOldDate(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedSub]);

  // When a grid is selected, fetch site point-change and normalize
  useEffect(() => {
    (async () => {
      if (!selectedGrid) return;
      try {
        const sub = selectedSub === "__ALL__" ? null : selectedSub;
        const rows = await fetchSitesPointChange(selectedGrid, sub); // nullable numbers + dates

        const sNorm: SiteChangeRow[] = rows.map((r) => ({
          site_name: r.site_name,
          site_class: r.site_class,
          data_old: Number(r.data_old ?? 0),
          data_new: Number(r.data_new ?? 0),
          data_delta: Number(
            r.data_delta ?? (r.data_new ?? 0) - (r.data_old ?? 0)
          ),
          data_delta_pct:
            r.data_delta_pct ??
            (r.data_old
              ? ((Number(r.data_new ?? 0) - Number(r.data_old ?? 0)) /
                  Number(r.data_old)) *
                100
              : null),
          voice_old: Number(r.voice_old ?? 0),
          voice_new: Number(r.voice_new ?? 0),
          voice_delta: Number(
            r.voice_delta ?? (r.voice_new ?? 0) - (r.voice_old ?? 0)
          ),
          voice_delta_pct:
            r.voice_delta_pct ??
            (r.voice_old
              ? ((Number(r.voice_new ?? 0) - Number(r.voice_old ?? 0)) /
                  Number(r.voice_old)) *
                100
              : null),
        }));
        setSiteChange(sNorm);
      } catch (e) {
        setErr((e as Error)?.message ?? "Failed to load sites");
        setSiteChange([]);
      }
    })();
  }, [selectedGrid, selectedSub]);

  /* ------------------------- Derived state ------------------------- */
  const avgDataGB = useMemo(() => {
    const n = daily.length || 1;
    const sum = daily.reduce((s, r) => s + Number(r.total_gb ?? 0), 0);
    return sum / n;
  }, [daily]);

  const avgVoiceErl = useMemo(() => {
    const n = daily.length || 1;
    const sum = daily.reduce((s, r) => s + Number(r.voice_erl ?? 0), 0);
    return sum / n;
  }, [daily]);

  const gridRows = useMemo(
    () => sortLatest(gridLatest, gridSortKey, gridSortDir),
    [gridLatest, gridSortKey, gridSortDir]
  );
  const districtRows = useMemo(
    () => sortLatest(districtLatest, distSortKey, distSortDir),
    [districtLatest, distSortKey, distSortDir]
  );

  const series = useMemo(
    () =>
      daily.map((r) => ({
        date: (r.date ?? "").slice(0, 10),
        total_gb: Number(r.total_gb ?? 0),
        voice_erl: Number(r.voice_erl ?? 0),
      })),
    [daily]
  );

  const sortedSiteChange = useMemo(() => {
    const rows = [...siteChange];
    const val = (x: number | null) => (x == null ? -Infinity : x);
    rows.sort((a, b) => {
      const av = val(a[siteSortKey]);
      const bv = val(b[siteSortKey]);
      return siteSortDir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [siteChange, siteSortKey, siteSortDir]);
  // maxima for heatbar backgrounds
  const gridMax = useMemo(
    () => ({
      total_gb: Math.max(0, ...gridRows.map((r) => r.total_gb)),
      voice_erl: Math.max(0, ...gridRows.map((r) => r.voice_erl)),
    }),
    [gridRows]
  );
  const distMax = useMemo(
    () => ({
      total_gb: Math.max(0, ...districtRows.map((r) => r.total_gb)),
      voice_erl: Math.max(0, ...districtRows.map((r) => r.voice_erl)),
    }),
    [districtRows]
  );
  const varMax = useMemo(
    () => ({
      data: Math.max(0, ...gridChange.map((r) => Math.abs(r.data_delta))),
      voice: Math.max(0, ...gridChange.map((r) => Math.abs(r.voice_delta))),
    }),
    [gridChange]
  );

  /* ------------------------------- Render ------------------------------- */
  return (
    <div className="p-4 space-y-4">
      {/* Header + SubRegion select */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">
          Network Traffic — Latest Totals, Point Change (30d) & Daily Series
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm text-gray-600">SubRegion</label>
          <select
            className="border rounded p-2 bg-white"
            value={selectedSub}
            onChange={(e) => setSelectedSub(e.target.value)}
          >
            <option value="__ALL__">All</option>
            {subs.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {err && <div className="text-sm text-red-600">Error: {err}</div>}

      {/* KPI cards */}
      {!loading && !err && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl p-4 shadow-sm border bg-white/60">
            <div className="text-xs text-gray-500 mb-1">Days</div>
            <div className="text-2xl font-semibold">{daily.length}</div>
          </div>
          <div className="rounded-2xl p-4 shadow-sm border bg-white/60">
            <div className="text-xs text-gray-500 mb-1">Net Average Data</div>
            <div className="text-2xl font-semibold">
              {nf2.format(avgDataGB)} GB/day
            </div>
          </div>
          <div className="rounded-2xl p-4 shadow-sm border bg-white/60">
            <div className="text-xs text-gray-500 mb-1">Net Average Voice</div>
            <div className="text-2xl font-semibold">
              {nf2.format(avgVoiceErl)} Erl/day
            </div>
          </div>
        </div>
      )}

      {/* Point-change by Grid + Sites in selected Grid */}
      {/* Point-change by Grid + Sites in selected Grid */}
      {!loading && !err && (
        <div className="grid grid-cols-1 gap-4">
          {/* Grid Point-Change */}
          <div className="rounded-2xl border bg-white/60">
            <div className="px-4 py-3 border-b">
              <div className="font-medium">
                Latest vs 30 Days Earlier — by Grid
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Latest: <span className="font-medium">{latestDate ?? "-"}</span>
                <span className="mx-2">•</span>
                Old: <span className="font-medium">{oldDate ?? "-"}</span>
              </div>
            </div>

            {/* ~12 rows viewport */}
            <div className="max-h-[580px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white/90 backdrop-blur z-10">
                  <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-gray-600">
                    <th style={{ width: 36 }}>#</th>
                    <th>Grid</th>
                    <th className="text-right">Data Old</th>
                    <th className="text-right">Data New</th>
                    <th className="text-right">Δ Data</th>
                    <th className="text-right">% Data</th>
                    <th className="text-right">Voice Old</th>
                    <th className="text-right">Voice New</th>
                    <th className="text-right">Δ Voice</th>
                    <th className="text-right">% Voice</th>
                  </tr>
                </thead>
                <tbody>
                  {gridChange.map((r, idx) => (
                    <tr
                      key={`${r.grid || "UNKNOWN"}-${idx}`}
                      className={`border-t cursor-pointer ${
                        selectedGrid === r.grid ? "bg-blue-50" : ""
                      }`}
                      onClick={() => setSelectedGrid(r.grid)}
                      title="Click to see sites"
                    >
                      <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-2">{r.grid}</td>

                      <td className="px-3 py-2 text-right">
                        {nf2.format(r.data_old)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {nf2.format(r.data_new)}
                      </td>
                      <td
                        className="px-3 py-2 text-right rounded-sm"
                        style={cellGradientStyle(
                          Math.abs(r.data_delta),
                          Math.max(1, varMax.data),
                          "data"
                        )}
                      >
                        {r.data_delta > 0 ? (
                          <span className="text-green-600">▲</span>
                        ) : r.data_delta < 0 ? (
                          <span className="text-red-600">▼</span>
                        ) : (
                          <span className="text-gray-400">•</span>
                        )}
                        &nbsp;{nf2.format(r.data_delta)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.data_delta_pct == null
                          ? "-"
                          : `${nf2.format(r.data_delta_pct)}%`}
                      </td>

                      <td className="px-3 py-2 text-right">
                        {nf2.format(r.voice_old)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {nf2.format(r.voice_new)}
                      </td>
                      <td
                        className="px-3 py-2 text-right rounded-sm"
                        style={cellGradientStyle(
                          Math.abs(r.voice_delta),
                          Math.max(1, varMax.voice),
                          "voice"
                        )}
                      >
                        {r.voice_delta > 0 ? (
                          <span className="text-green-600">▲</span>
                        ) : r.voice_delta < 0 ? (
                          <span className="text-red-600">▼</span>
                        ) : (
                          <span className="text-gray-400">•</span>
                        )}
                        &nbsp;{nf2.format(r.voice_delta)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.voice_delta_pct == null
                          ? "-"
                          : `${nf2.format(r.voice_delta_pct)}%`}
                      </td>
                    </tr>
                  ))}
                  {gridChange.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-6 text-center text-gray-500"
                      >
                        No data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sites for selected Grid (Point-Change) */}
          <div className="rounded-2xl border bg-white/60">
            <div className="px-4 py-3 border-b flex items-center gap-3">
              <span className="font-medium">
                Sites — {selectedGrid ? selectedGrid : "Select a Grid"}
              </span>
              <div className="ml-auto flex items-center gap-2 text-sm">
                <label>Sort:</label>
                <select
                  className="border rounded p-1 bg-white"
                  value={siteSortKey}
                  onChange={(e) =>
                    setSiteSortKey(
                      e.target.value as "data_delta_pct" | "voice_delta_pct"
                    )
                  }
                  title="Sort sites by percentage change"
                >
                  <option value="data_delta_pct">% Data</option>
                  <option value="voice_delta_pct">% Voice</option>
                </select>
                <button
                  className="border rounded px-2 py-1"
                  onClick={() =>
                    setSiteSortDir((d) => (d === "desc" ? "asc" : "desc"))
                  }
                  title="Toggle ASC/DESC"
                >
                  {siteSortDir.toUpperCase()}
                </button>
              </div>
            </div>

            {/* ~12 rows viewport */}
            <div className="max-h-[580px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white/90 backdrop-blur z-10">
                  <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-gray-600">
                    <th style={{ width: 36 }}>#</th>
                    <th>Site</th>
                    <th>Class</th>
                    <th className="text-right">Data Old</th>
                    <th className="text-right">Data New</th>
                    <th className="text-right">Δ Data</th>
                    <th className="text-right">% Data</th>
                    <th className="text-right">Voice Old</th>
                    <th className="text-right">Voice New</th>
                    <th className="text-right">Δ Voice</th>
                    <th className="text-right">% Voice</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedGrid &&
                    sortedSiteChange.map((r, idx) => (
                      <tr
                        key={`${r.site_name || "UNKNOWN"}-${idx}`}
                        className="border-t cursor-pointer hover:bg-blue-50"
                        onClick={() => openSite(r.site_name)}
                        title="Open Site Analytics in a new tab"
                      >
                        <td className="px-3 py-2 text-gray-500">{idx + 1}</td>

                        {/* Make the Site column an explicit link too (accessibility + affordance) */}
                        <td className="px-3 py-2">
                          <a
                            href={`/sitequery/${encodeURIComponent(
                              r.site_name || "UNKNOWN"
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()} // prevent double open
                            className="text-blue-600 hover:underline"
                            title="Open Site Analytics in a new tab"
                          >
                            {r.site_name}
                          </a>
                        </td>

                        <td className="px-3 py-2">{r.site_class}</td>

                        <td className="px-3 py-2 text-right">
                          {nf2.format(r.data_old)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {nf2.format(r.data_new)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.data_delta > 0 ? (
                            <span className="text-green-600">▲</span>
                          ) : r.data_delta < 0 ? (
                            <span className="text-red-600">▼</span>
                          ) : (
                            <span className="text-gray-400">•</span>
                          )}
                          &nbsp;{nf2.format(r.data_delta)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.data_delta_pct == null
                            ? "-"
                            : `${nf2.format(r.data_delta_pct)}%`}
                        </td>

                        <td className="px-3 py-2 text-right">
                          {nf2.format(r.voice_old)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {nf2.format(r.voice_new)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.voice_delta > 0 ? (
                            <span className="text-green-600">▲</span>
                          ) : r.voice_delta < 0 ? (
                            <span className="text-red-600">▼</span>
                          ) : (
                            <span className="text-gray-400">•</span>
                          )}
                          &nbsp;{nf2.format(r.voice_delta)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.voice_delta_pct == null
                            ? "-"
                            : `${nf2.format(r.voice_delta_pct)}%`}
                        </td>
                      </tr>
                    ))}
                  {!selectedGrid && (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-6 text-center text-gray-500"
                      >
                        Click a grid on the left to load sites
                      </td>
                    </tr>
                  )}
                  {selectedGrid && siteChange.length === 0 && (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-6 text-center text-gray-500"
                      >
                        No sites found for this grid
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Latest by District / Grid (unchanged core) */}
      {!loading && !err && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* District table */}
          <div className="rounded-2xl border bg-white/60">
            <div className="px-4 py-3 border-b flex items-center gap-3">
              <span className="font-medium">Latest Totals — by District</span>
              <div className="ml-auto flex items-center gap-2 text-sm">
                <label>Sort:</label>
                <select
                  className="border rounded p-1"
                  value={distSortKey}
                  onChange={(e) => setDistSortKey(e.target.value as SortKey)}
                >
                  <option value="total_gb">Total GB</option>
                  <option value="voice_erl">Voice Erl</option>
                </select>
                <button
                  className="border rounded px-2 py-1"
                  onClick={() =>
                    setDistSortDir((d) => (d === "desc" ? "asc" : "desc"))
                  }
                  title="Toggle ASC/DESC"
                >
                  {distSortDir.toUpperCase()}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 bg-white/90 backdrop-blur z-10">
                  <tr className="[&>th]:px-4 [&>th]:py-2 text-left text-gray-600">
                    <th style={{ width: 48 }}>#</th>
                    <th>District</th>
                    <th>Date</th>
                    <th className="text-right">Total GB</th>
                    <th className="text-right">Voice Erl</th>
                  </tr>
                </thead>
                <tbody>
                  {districtRows.map((r, idx) => (
                    <tr key={`${r.key}-${r.latest_date}`} className="border-t">
                      <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-2">{r.key}</td>
                      <td className="px-4 py-2">{r.latest_date}</td>
                      <td
                        className="px-4 py-2 text-right"
                        style={cellGradientStyle(
                          Math.abs(r.total_gb),
                          Math.max(
                            1,
                            ...districtRows.map((x) => Math.abs(x.total_gb))
                          ),
                          "data"
                        )}
                      >
                        {nf2.format(r.total_gb)}
                      </td>
                      <td
                        className="px-4 py-2 text-right"
                        style={cellGradientStyle(
                          Math.abs(r.voice_erl),
                          Math.max(
                            1,
                            ...districtRows.map((x) => Math.abs(x.voice_erl))
                          ),
                          "voice"
                        )}
                      >
                        {nf2.format(r.voice_erl)}
                      </td>
                    </tr>
                  ))}
                  {districtRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-gray-500"
                      >
                        No data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grid totals table */}
          <div className="rounded-2xl border bg-white/60">
            <div className="px-4 py-3 border-b flex items-center gap-3">
              <span className="font-medium">Latest Totals — by Grid</span>
              <div className="ml-auto flex items-center gap-2 text-sm">
                <label>Sort:</label>
                <select
                  className="border rounded p-1"
                  value={gridSortKey}
                  onChange={(e) => setGridSortKey(e.target.value as SortKey)}
                >
                  <option value="total_gb">Total GB</option>
                  <option value="voice_erl">Voice Erl</option>
                </select>
                <button
                  className="border rounded px-2 py-1"
                  onClick={() =>
                    setGridSortDir((d) => (d === "desc" ? "asc" : "desc"))
                  }
                  title="Toggle ASC/DESC"
                >
                  {gridSortDir.toUpperCase()}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 bg-white/90 backdrop-blur z-10">
                  <tr className="[&>th]:px-4 [&>th]:py-2 text-left text-gray-600">
                    <th style={{ width: 48 }}>#</th>
                    <th>Grid</th>
                    <th>Date</th>
                    <th className="text-right">Total GB</th>
                    <th className="text-right">Voice Erl</th>
                  </tr>
                </thead>
                <tbody>
                  {gridRows.map((r, idx) => (
                    <tr key={`${r.key}-${r.latest_date}`} className="border-t">
                      <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-2">{r.key}</td>
                      <td className="px-4 py-2">{r.latest_date}</td>
                      <td
                        className="px-4 py-2 text-right"
                        style={cellGradientStyle(
                          Math.abs(r.total_gb),
                          Math.max(
                            1,
                            ...gridRows.map((x) => Math.abs(x.total_gb))
                          ),
                          "data"
                        )}
                      >
                        {nf2.format(r.total_gb)}
                      </td>
                      <td
                        className="px-4 py-2 text-right"
                        style={cellGradientStyle(
                          Math.abs(r.voice_erl),
                          Math.max(
                            1,
                            ...gridRows.map((x) => Math.abs(x.voice_erl))
                          ),
                          "voice"
                        )}
                      >
                        {nf2.format(r.voice_erl)}
                      </td>
                    </tr>
                  ))}
                  {gridRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-gray-500"
                      >
                        No data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Area charts */}
      {!loading && !err && series.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: "total_gb", label: "Total Data (GB)", color: "#2563eb" },
            { key: "voice_erl", label: "Total Voice (Erl)", color: "#16a34a" },
          ].map(({ key, label, color }) => {
            const gradId = `fill-${key}`;
            return (
              <div key={key} className="rounded-2xl border bg-white/60 p-4">
                <div className="text-sm text-gray-600 mb-2">
                  {label}{" "}
                  {selectedSub !== "__ALL__"
                    ? `— ${selectedSub}`
                    : "— All SubRegions"}
                </div>
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <AreaChart
                      data={series}
                      margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                      <XAxis
                        dataKey="date"
                        type="category"
                        allowDuplicatedCategory={false}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={yTickFmt} />
                      <Tooltip
                        formatter={(v) => tipFmt(v)}
                        labelFormatter={tipLabelFmt}
                      />
                      <Legend />
                      <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="0%"
                            stopColor={color}
                            stopOpacity={0.55}
                          />
                          <stop
                            offset="100%"
                            stopColor={color}
                            stopOpacity={0.05}
                          />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey={key as "total_gb" | "voice_erl"}
                        name={label}
                        stroke={color}
                        fill={`url(#${gradId})`}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

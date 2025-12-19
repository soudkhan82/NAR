// app/Rms/RmsDetailsClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { GridAggRow, SiteRow } from "./RmsDetails";

function siteQueryHref(siteName: string) {
  return `/sitequery/${encodeURIComponent(siteName)}`;
}

// RMS Query page path: app/Rms/[id]/page.tsx => /Rms/<id>
function rmsQueryHref(siteName: string) {
  return `/Rms/${encodeURIComponent(siteName)}`;
}

function CellLink({
  href,
  children,
  title,
}: {
  href: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block px-3 py-2 w-full h-full hover:opacity-90"
      title={title ?? "Open in new tab"}
    >
      {children}
    </Link>
  );
}

function PillLink({
  href,
  children,
  title,
}: {
  href: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15"
      title={title ?? "Open in new tab"}
    >
      {children}
    </Link>
  );
}

function safeKey(v: string | null | undefined) {
  const t = (v ?? "").trim();
  return t.length ? t : "(Blank)";
}

export default function RmsDetailsClient(props: {
  subregion: string;
  indicator: string;
  label: string;
  allRows: SiteRow[];
  gridAgg: GridAggRow[];
  defaultGrid: string; // top grid row
}) {
  const { subregion, label, allRows, gridAgg, defaultGrid } = props;

  // default selected grid = top grid row (as per requirement)
  const [selectedGrid, setSelectedGrid] = useState<string>(
    gridAgg.length > 0 ? defaultGrid : "All"
  );

  // instant search
  const [q, setQ] = useState<string>("");

  const filteredRows = useMemo(() => {
    // 1) Grid filter
    const byGrid =
      selectedGrid === "All"
        ? allRows
        : allRows.filter((r) => safeKey(r.grid) === selectedGrid);

    // 2) SiteName filter (instant)
    const qq = q.trim().toLowerCase();
    if (!qq) return byGrid;

    return byGrid.filter((r) => (r.sitename ?? "").toLowerCase().includes(qq));
  }, [allRows, selectedGrid, q]);

  // If user wants "All" row still visible, we keep it. But default is top grid row.
  const totalSites = allRows.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-white">{label}</h1>
              <p className="text-sm text-slate-300">
                SubRegion:{" "}
                <span className="font-medium text-slate-100">{subregion}</span>
                {" • "}
                Grid:{" "}
                <span className="font-medium text-slate-100">
                  {selectedGrid}
                </span>
                {" • "}
                Showing:{" "}
                <span className="font-medium text-slate-100">
                  {filteredRows.length}
                </span>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Grid click updates Site List instantly. SiteName filter searches
                on every keypress.
              </p>
            </div>

            <Link
              href="/Rms"
              className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
            >
              ← Back
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Grid Breakdown */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <div className="text-white font-semibold">Grid Breakdown</div>
              <div className="text-xs text-slate-300">
                Default selection is the top grid row.
              </div>
            </div>

            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-sm text-slate-100">
                <thead className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur">
                  <tr>
                    <th className="px-4 py-2 text-left">Grid</th>
                    <th className="px-4 py-2 text-right">Sites</th>
                  </tr>
                </thead>
                <tbody>
                  {/* All row (optional) */}
                  <tr
                    className={`border-t border-white/10 hover:bg-white/10 transition cursor-pointer ${
                      selectedGrid === "All" ? "bg-white/10" : ""
                    }`}
                    onClick={() => setSelectedGrid("All")}
                    title="Show all grids"
                  >
                    <td className="px-4 py-2 font-medium">All</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {totalSites}
                    </td>
                  </tr>

                  {gridAgg.map((g) => {
                    const active = selectedGrid === g.grid;
                    return (
                      <tr
                        key={g.grid}
                        className={`border-t border-white/10 hover:bg-white/10 transition cursor-pointer ${
                          active ? "bg-white/10" : ""
                        }`}
                        onClick={() => setSelectedGrid(g.grid)}
                        title={`Filter sites for Grid: ${g.grid}`}
                      >
                        <td className="px-4 py-2">{g.grid}</td>
                        <td className="px-4 py-2 text-right font-medium">
                          {g.site_count}
                        </td>
                      </tr>
                    );
                  })}

                  {gridAgg.length === 0 && (
                    <tr>
                      <td
                        className="px-4 py-6 text-center text-slate-300"
                        colSpan={2}
                      >
                        No grid data found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 text-xs text-slate-300 border-t border-white/10">
              Grids:{" "}
              <span className="text-slate-100 font-medium">
                {gridAgg.length}
              </span>
            </div>
          </div>

          {/* Site List */}
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-white font-semibold">Site List</div>
                <div className="text-xs text-slate-300">
                  Showing:{" "}
                  <span className="text-slate-100 font-medium">
                    {filteredRows.length}
                  </span>{" "}
                  site(s)
                </div>
              </div>

              {/* Instant SiteName filter */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-[420px]">
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Filter by SiteName..."
                    className="w-full rounded-md border border-white/10 bg-slate-950/40 px-3 py-2 pr-20 text-sm text-slate-100 placeholder:text-slate-400 outline-none"
                  />
                  {q.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => setQ("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/15"
                      title="Clear search"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="max-h-[720px] overflow-auto">
              <table className="min-w-[1050px] w-full text-sm text-slate-100">
                <thead className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur">
                  <tr>
                    <th className="px-3 py-3 text-left">RMS Query</th>
                    <th className="px-3 py-3 text-left">SiteName</th>
                    <th className="px-3 py-3 text-left">Region</th>
                    <th className="px-3 py-3 text-left">SubRegion</th>
                    <th className="px-3 py-3 text-left">Grid</th>
                    <th className="px-3 py-3 text-left">District</th>
                    <th className="px-3 py-3 text-left">Class</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.map((r, i) => {
                    const site = (r.sitename ?? "").trim();
                    const siteHref = site ? siteQueryHref(site) : null;
                    const rmsHref = site ? rmsQueryHref(site) : null;

                    return (
                      <tr
                        key={`${r.sitename ?? "NA"}-${i}`}
                        className={`border-t border-white/10 ${
                          i % 2 === 0 ? "bg-white/0" : "bg-white/5"
                        } hover:bg-white/10 transition`}
                      >
                        <td className="px-3 py-2">
                          {rmsHref ? (
                            <PillLink
                              href={rmsHref}
                              title="Open RMS indicators in new tab"
                            >
                              RMS Query
                            </PillLink>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="p-0 font-medium">
                          {siteHref ? (
                            <CellLink
                              href={siteHref}
                              title="Open SiteQuery in new tab"
                            >
                              {site}
                            </CellLink>
                          ) : (
                            <div className="px-3 py-2">-</div>
                          )}
                        </td>

                        <td className="px-3 py-2">{r.region ?? "-"}</td>
                        <td className="px-3 py-2">{r.subregion ?? "-"}</td>
                        <td className="px-3 py-2">{safeKey(r.grid)}</td>
                        <td className="px-3 py-2">{r.district ?? "-"}</td>
                        <td className="px-3 py-2">
                          {r.siteclassification ?? "-"}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredRows.length === 0 && (
                    <tr>
                      <td
                        className="px-3 py-6 text-center text-slate-300"
                        colSpan={7}
                      >
                        No sites found for this grid/search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 text-xs text-slate-300 border-t border-white/10">
              <span className="text-slate-200">RMS Query</span> opens{" "}
              <span className="text-slate-200">/Rms/[id]</span> in new tab •
              SiteName opens{" "}
              <span className="text-slate-200">/sitequery/[id]</span> in new tab
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

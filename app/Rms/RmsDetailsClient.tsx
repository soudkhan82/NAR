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
      className="block px-3 py-2 w-full h-full hover:bg-black/5"
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
      className="inline-flex items-center justify-center rounded-md border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
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

function chipClass(active: boolean, scheme: "indigo" | "emerald") {
  const base = "cursor-pointer transition select-none border-t border-black/5";

  // IMPORTANT: give every row the SAME left border width
  // so alignment never changes.
  const leftBorder = "border-l-4";

  // default left border transparent, active colored
  const leftColor = active
    ? scheme === "indigo"
      ? "border-l-indigo-500"
      : "border-l-emerald-500"
    : "border-l-transparent";

  const activeBg = scheme === "indigo" ? "bg-indigo-50" : "bg-emerald-50";

  return [
    base,
    leftBorder,
    leftColor,
    active ? activeBg : "bg-white",
    "hover:bg-black/3",
  ].join(" ");
}

export default function RmsDetailsClient(props: {
  subregion: string;
  indicator: string;
  label: string;
  allRows: SiteRow[];
  gridAgg: GridAggRow[];
  defaultGrid: string;
}) {
  const { subregion, label, allRows, gridAgg, defaultGrid } = props;

  const [selectedGrid, setSelectedGrid] = useState<string>(
    gridAgg.length > 0 ? defaultGrid : "All"
  );

  const [q, setQ] = useState<string>("");

  const filteredRows = useMemo(() => {
    const byGrid =
      selectedGrid === "All"
        ? allRows
        : allRows.filter((r) => safeKey(r.grid) === selectedGrid);

    const qq = q.trim().toLowerCase();
    if (!qq) return byGrid;

    return byGrid.filter((r) => (r.sitename ?? "").toLowerCase().includes(qq));
  }, [allRows, selectedGrid, q]);

  const totalSites = allRows.length;

  return (
    <div className="min-h-screen bg-white">
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="rounded-2xl border border-black/10 bg-white shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{label}</h1>
              <p className="text-sm text-slate-600">
                SubRegion:{" "}
                <span className="font-semibold text-slate-900">
                  {subregion}
                </span>
                {" • "}
                Grid:{" "}
                <span className="font-semibold text-slate-900">
                  {selectedGrid}
                </span>
                {" • "}
                Showing:{" "}
                <span className="font-semibold text-slate-900">
                  {filteredRows.length}
                </span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Click a grid to filter Site List instantly. SiteName search is
                live on every key press.
              </p>
            </div>

            <Link
              href="/Rms"
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
            >
              ← Back
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ================= Grid Breakdown (Indigo scheme) ================= */}
          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-indigo-200/70">
              <div className="text-slate-900 font-semibold">Grid Breakdown</div>
              <div className="text-xs text-slate-600">
                Default selection is the top grid row.
              </div>
            </div>

            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-sm text-slate-800">
                <thead className="sticky top-0 z-10 bg-indigo-50/90 backdrop-blur border-b border-indigo-200/70">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-slate-900">
                      Grid
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-slate-900">
                      Sites
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {/* All row */}
                  <tr
                    className={chipClass(selectedGrid === "All", "indigo")}
                    onClick={() => setSelectedGrid("All")}
                    title="Show all grids"
                  >
                    <td className="px-4 py-2 font-semibold text-slate-900">
                      All
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-900">
                      {totalSites}
                    </td>
                  </tr>

                  {gridAgg.map((g) => {
                    const active = selectedGrid === g.grid;
                    return (
                      <tr
                        key={g.grid}
                        className={chipClass(active, "indigo")}
                        onClick={() => setSelectedGrid(g.grid)}
                        title={`Filter sites for Grid: ${g.grid}`}
                      >
                        <td className="px-4 py-2">{g.grid}</td>
                        <td className="px-4 py-2 text-right font-semibold text-slate-900">
                          {g.site_count}
                        </td>
                      </tr>
                    );
                  })}

                  {gridAgg.length === 0 && (
                    <tr>
                      <td
                        className="px-4 py-6 text-center text-slate-500"
                        colSpan={2}
                      >
                        No grid data found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 text-xs text-slate-600 border-t border-indigo-200/70">
              Grids:{" "}
              <span className="text-slate-900 font-semibold">
                {gridAgg.length}
              </span>
            </div>
          </div>

          {/* ================= Site List (Emerald scheme) ================= */}
          <div className="lg:col-span-2 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-emerald-200/70 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-slate-900 font-semibold">Site List</div>
                <div className="text-xs text-slate-600">
                  Showing:{" "}
                  <span className="text-slate-900 font-semibold">
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
                    className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 pr-20 text-sm text-slate-900 placeholder:text-slate-400 outline-none shadow-sm focus:ring-2 focus:ring-emerald-200"
                  />
                  {q.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => setQ("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs font-semibold text-slate-900 shadow-sm hover:bg-emerald-50"
                      title="Clear search"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ✅ max ~10 rows view + vertical scroll */}
            <div className="max-h-[460px] overflow-auto">
              <table className="min-w-[1050px] w-full text-sm text-slate-800">
                <thead className="sticky top-0 z-10 bg-emerald-50/90 backdrop-blur border-b border-emerald-200/70">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold text-slate-900">
                      RMS Query
                    </th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-900">
                      SiteName
                    </th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-900">
                      Region
                    </th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-900">
                      SubRegion
                    </th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-900">
                      Grid
                    </th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-900">
                      District
                    </th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-900">
                      Class
                    </th>
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
                        className={`border-t border-black/5 ${
                          i % 2 === 0 ? "bg-white" : "bg-emerald-50/40"
                        } hover:bg-emerald-50 transition`}
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

                        <td className="p-0 font-semibold text-slate-900">
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
                        className="px-3 py-6 text-center text-slate-500"
                        colSpan={7}
                      >
                        No sites found for this grid/search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 text-xs text-slate-600 border-t border-emerald-200/70">
              <span className="text-slate-900 font-semibold">RMS Query</span>{" "}
              opens <span className="text-slate-900">/Rms/[id]</span> in new tab
              • SiteName opens{" "}
              <span className="text-slate-900">/sitequery/[id]</span> in new tab
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

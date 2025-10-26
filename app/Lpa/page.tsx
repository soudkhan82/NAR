// app/lpa/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";

/* ---------------- helpers ---------------- */
const numFmt = (n: number | null | undefined) =>
  typeof n === "number"
    ? n.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : "—";

const toStringArray = (rows: Array<{ v: string }> | undefined): string[] =>
  Array.isArray(rows)
    ? rows.map((x) => x.v).filter((s) => typeof s === "string")
    : [];

/* --------------- lazy-load RPC (client only) --------------- */
type LpaModule = typeof import("@/app/lib/rpc/lpa");
async function importLpa(): Promise<LpaModule> {
  const mod = await import("@/app/lib/rpc/lpa");
  return mod;
}

export default function LpaPage() {
  const [subRegion, setSubRegion] = useState<string>("__ALL__");
  const [nameFilter, setNameFilter] = useState<string>("__ALL__");
  const [nameSearch, setNameSearch] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [subRegions, setSubRegions] = useState<string[]>(["__ALL__"]);
  const [namesList, setNamesList] = useState<string[]>(["__ALL__"]);

  const [nameCounts, setNameCounts] = useState<
    Array<{ name: string | null; cnt: number }>
  >([]);
  const [severityCounts, setSeverityCounts] = useState<
    Array<{ severity: string | null; cnt: number }>
  >([]);
  const [agingCounts, setAgingCounts] = useState<
    Array<{ aging_slab: string | null; cnt: number }>
  >([]);
  const [tsDaily, setTsDaily] = useState<
    Array<{ date: string; count: number }>
  >([]);
  const [districtCounts, setDistrictCounts] = useState<
    Array<{ district: string | null; cnt: number }>
  >([]);
  const [gridCounts, setGridCounts] = useState<
    Array<{ grid: string | null; cnt: number }>
  >([]);

  // cache the module (no re-imports)
  const lpaRef = useRef<LpaModule | null>(null);
  const getLpa = async () => (lpaRef.current ??= await importLpa());

  /* -------- initial filters (subregions) -------- */
  const loadFiltersOnce = async () => {
    const lpa = await getLpa();
    const opts = await lpa.fetchLpaFilters();
    const sr = ["__ALL__", ...toStringArray(opts.subregions)];
    setSubRegions(sr);
  };

  /* -------- main summary loader -------- */
  const loadSummary = async () => {
    const lpa = await getLpa();
    const data = await lpa.fetchLpaSummary(
      subRegion === "__ALL__" ? undefined : subRegion,
      nameFilter === "__ALL__" ? undefined : nameFilter
    );

    setNameCounts(data.names);
    setSeverityCounts(data.severities);
    setAgingCounts(data.slabs);
    setTsDaily(data.times);
    setDistrictCounts(data.districts);
    setGridCounts(data.grids);

    // refresh Name picklist based on current dataset
    const uniqueNames = Array.from(
      new Set(
        data.names
          .map((r) => r.name ?? "")
          .filter(
            (s): s is string => typeof s === "string" && s.trim().length > 0
          )
      )
    ).sort((a, b) => a.localeCompare(b));
    setNamesList(["__ALL__", ...uniqueNames]);
  };

  /* -------- bootstrap -------- */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        await loadFiltersOnce();
        await loadSummary();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e ?? "Failed to load"));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------- refetch on filter change -------- */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        await loadSummary();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e ?? "Failed to load"));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subRegion, nameFilter]);

  /* -------- derived UI bits -------- */
  const filteredNames = useMemo(
    () =>
      namesList.filter((n) =>
        n === "__ALL__"
          ? true
          : n.toLowerCase().includes(nameSearch.toLowerCase())
      ),
    [namesList, nameSearch]
  );

  const totalRecords = useMemo(
    () => nameCounts.reduce((s, r) => s + Number(r.cnt ?? 0), 0),
    [nameCounts]
  );

  /* ---------------- render ---------------- */
  return (
    <div className="p-6 space-y-6">
      {/* Header / Filters */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">LPA Summary Dashboard</h1>
          <p className="text-sm text-gray-500">
            Data source: <code>LPA_consolidated</code>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* SubRegion */}
          <div className="flex gap-2 items-center">
            <label className="text-sm font-medium">SubRegion</label>
            <select
              className="border rounded px-3 py-2 text-sm"
              value={subRegion}
              onChange={(e) => setSubRegion(e.target.value)}
              disabled={loading}
            >
              {subRegions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "__ALL__" ? "All" : opt}
                </option>
              ))}
            </select>
          </div>

          {/* Name (search + dropdown) */}
          <div className="flex flex-col">
            <label className="text-sm font-medium">Name</label>
            <input
              type="text"
              placeholder="Search name..."
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-52"
            />
            <select
              className="border rounded px-3 py-2 text-sm mt-1 w-52"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              disabled={loading}
            >
              {filteredNames.map((n) => (
                <option key={n} value={n}>
                  {n === "__ALL__" ? "All" : n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Error */}
      {err && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-700">
          {err}
        </div>
      )}

      {/* Total Records */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            Total Records
          </div>
          <div className="mt-2 text-3xl font-semibold">
            {numFmt(totalRecords)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {subRegion === "__ALL__"
              ? "All SubRegions"
              : `SubRegion: ${subRegion}`}{" "}
            | {nameFilter === "__ALL__" ? "All Names" : `Name: ${nameFilter}`}
          </div>
        </div>
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Time Series */}
        <div className="rounded-2xl border p-4 shadow-sm">
          <h3 className="font-medium mb-3">Events over Time (by day)</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={tsDaily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Severity */}
        <div className="rounded-2xl border p-4 shadow-sm">
          <h3 className="font-medium mb-3">By Severity</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={severityCounts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="severity"
                  tick={{ fontSize: 12 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="cnt" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Aging Slab */}
        <div className="rounded-2xl border p-4 shadow-sm">
          <h3 className="font-medium mb-3">By Aging Slab</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={agingCounts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="aging_slab"
                  tick={{ fontSize: 12 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="cnt" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Tables */}
      <section className="rounded-2xl p-0">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Name Table */}
          <div className="rounded-2xl border p-4 shadow-sm">
            <h3 className="font-medium mb-3">Name — Record Count (DESC)</h3>
            <div className="max-h-[420px] overflow-y-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">#</th>
                    <th className="text-left px-3 py-2 font-medium">Name</th>
                    <th className="text-right px-3 py-2 font-medium">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {[...nameCounts]
                    .sort((a, b) => Number(b.cnt ?? 0) - Number(a.cnt ?? 0))
                    .map((r, idx) => (
                      <tr
                        key={`${r.name ?? "null"}-${idx}`}
                        className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"}
                      >
                        <td className="px-3 py-2">{idx + 1}</td>
                        <td className="px-3 py-2">{r.name ?? "—"}</td>
                        <td className="px-3 py-2 text-right">
                          {numFmt(r.cnt)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* District Table */}
          <div className="rounded-2xl border p-4 shadow-sm">
            <h3 className="font-medium mb-3">District — Record Count (DESC)</h3>
            <div className="max-h-[420px] overflow-y-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">#</th>
                    <th className="text-left px-3 py-2 font-medium">
                      District
                    </th>
                    <th className="text-right px-3 py-2 font-medium">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {[...districtCounts]
                    .sort((a, b) => Number(b.cnt ?? 0) - Number(a.cnt ?? 0))
                    .map((r, idx) => (
                      <tr
                        key={`${r.district ?? "null"}-${idx}`}
                        className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"}
                      >
                        <td className="px-3 py-2">{idx + 1}</td>
                        <td className="px-3 py-2">{r.district ?? "—"}</td>
                        <td className="px-3 py-2 text-right">
                          {numFmt(r.cnt)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grid Table */}
          <div className="rounded-2xl border p-4 shadow-sm">
            <h3 className="font-medium mb-3">Grid — Record Count (DESC)</h3>
            <div className="max-h-[420px] overflow-y-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">#</th>
                    <th className="text-left px-3 py-2 font-medium">Grid</th>
                    <th className="text-right px-3 py-2 font-medium">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {[...gridCounts]
                    .sort((a, b) => Number(b.cnt ?? 0) - Number(a.cnt ?? 0))
                    .map((r, idx) => (
                      <tr
                        key={`${r.grid ?? "null"}-${idx}`}
                        className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"}
                      >
                        <td className="px-3 py-2">{idx + 1}</td>
                        <td className="px-3 py-2">{r.grid ?? "—"}</td>
                        <td className="px-3 py-2 text-right">
                          {numFmt(r.cnt)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {loading && <div className="text-sm text-gray-500">Loading data…</div>}
    </div>
  );
}

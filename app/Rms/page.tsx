// app/rms/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import {
  // shared
  defaultDateRange,
  fetchRmsBounds,
  // SSL picklists
  fetchSubregions,
  fetchGrids,
  fetchDistricts,
  fetchSiteClasses,
  fetchSiteNames,
  // data
  fetchOverview,
  fetchByVendor,
  fetchByStatus,
  fetchByReason,
  fetchTopSubregions,
  fetchTopDistricts,
  fetchByGrid,
  fetchRows,
  // types
  type RmsOverviewRow,
  type RmsVendorRow,
  type RmsStatusRow,
  type RmsReasonRow,
  type RmsTopSubregionRow,
  type RmsTopDistrictRow,
  type RmsGridRow,
  type RmsTableRow,
} from "@/app/lib/rpc/rms";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

/* ========= Single-hue gradient shading ========= */
const H = 226; // indigo-ish hue
const S = 80; // saturation
const L_LOW = 85;
const L_HIGH = 30;

function shadeByValue(
  val: number,
  vmin: number,
  vmax: number,
  {
    h = H,
    s = S,
    lLow = L_LOW,
    lHigh = L_HIGH,
  }: { h?: number; s?: number; lLow?: number; lHigh?: number } = {}
): string {
  if (!isFinite(val) || !isFinite(vmin) || !isFinite(vmax) || vmax <= vmin) {
    return `hsl(${h} ${s}% ${Math.round((lLow + lHigh) / 2)}%)`;
  }
  const t = (val - vmin) / (vmax - vmin);
  const l = lLow + (lHigh - lLow) * t;
  return `hsl(${h} ${s}% ${Math.round(l)}%)`;
}

type Filters = {
  date_from: string;
  date_to: string;
  subregion: string | null;
  grid: string | null;
  district: string | null;
  site_class: string | null;
  vendor: string | null; // kept for API compatibility (unused picker)
  status: string | null; // kept for API compatibility (unused picker)
  search: string;
};

export default function RMSPage() {
  const d = defaultDateRange();

  // bounds
  const [bounds, setBounds] = useState<{
    min_date: string | null;
    max_date: string | null;
  }>({
    min_date: null,
    max_date: null,
  });

  // filters
  const [filters, setFilters] = useState<Filters>({
    date_from: d.from,
    date_to: d.to,
    subregion: null,
    grid: null,
    district: null,
    site_class: null,
    vendor: null, // stays null
    status: null, // stays null
    search: "",
  });

  // picklists
  const [subregions, setSubregions] = useState<string[]>([]);
  const [grids, setGrids] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [siteClasses, setSiteClasses] = useState<string[]>([]);
  const [siteNames, setSiteNames] = useState<string[]>([]);

  // data
  const [kpi, setKpi] = useState<RmsOverviewRow>({
    total_count: 0,
    site_count: 0,
  });
  const [vendorData, setVendorData] = useState<RmsVendorRow[]>([]);
  const [statusData, setStatusData] = useState<RmsStatusRow[]>([]);
  const [reasonData, setReasonData] = useState<RmsReasonRow[]>([]);
  const [topSubs, setTopSubs] = useState<RmsTopSubregionRow[]>([]);
  const [topDists, setTopDists] = useState<RmsTopDistrictRow[]>([]);
  const [gridData, setGridData] = useState<RmsGridRow[]>([]);
  const [rows, setRows] = useState<RmsTableRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  // shading ranges
  const vendorMinMax = useMemo(() => {
    const vals = vendorData.map((d) => d.site_count);
    return { min: Math.min(...vals, 0), max: Math.max(...vals, 1) };
  }, [vendorData]);

  const subMinMax = useMemo(() => {
    const vals = topSubs.map((d) => d.site_count);
    return { min: Math.min(...vals, 0), max: Math.max(...vals, 1) };
  }, [topSubs]);

  const distMinMax = useMemo(() => {
    const vals = topDists.map((d) => d.site_count);
    return { min: Math.min(...vals, 0), max: Math.max(...vals, 1) };
  }, [topDists]);

  const gridMinMax = useMemo(() => {
    const vals = gridData.map((d) => d.site_count);
    return { min: Math.min(...vals, 0), max: Math.max(...vals, 1) };
  }, [gridData]);

  // bootstrap
  useEffect(() => {
    (async () => {
      const [b, subs, classes] = await Promise.all([
        fetchRmsBounds(),
        fetchSubregions(),
        fetchSiteClasses(),
      ]);
      setBounds(b);
      setSubregions(subs);
      setSiteClasses(classes);

      const names = await fetchSiteNames({ limit: 20 });
      setSiteNames(names);
    })().catch(console.error);
  }, []);

  // SubRegion -> refresh grids, clear grid/district, refresh site names
  useEffect(() => {
    (async () => {
      const gs = await fetchGrids(filters.subregion);
      setGrids(gs);
      setFilters((f) => ({ ...f, grid: null, district: null }));
      setDistricts([]);

      const names = await fetchSiteNames({
        query: filters.search || null,
        subregion: filters.subregion,
        grid: null,
        district: null,
        limit: 20,
      });
      setSiteNames(names);
    })().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.subregion]);

  // Grid -> refresh districts, clear district, refresh site names
  useEffect(() => {
    (async () => {
      const ds = await fetchDistricts(filters.subregion, filters.grid);
      setDistricts(ds);
      setFilters((f) => ({ ...f, district: null }));

      const names = await fetchSiteNames({
        query: filters.search || null,
        subregion: filters.subregion,
        grid: filters.grid,
        district: null,
        limit: 20,
      });
      setSiteNames(names);
    })().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.grid]);

  // District -> refresh site names scope
  useEffect(() => {
    (async () => {
      const names = await fetchSiteNames({
        query: filters.search || null,
        subregion: filters.subregion,
        grid: filters.grid,
        district: filters.district,
        limit: 20,
      });
      setSiteNames(names);
    })().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.district]);

  // load data on filter/paging changes
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [k, v, s, r, reasons, subs, dists, gridsSeries] =
          await Promise.all([
            fetchOverview(filters),
            fetchByVendor(filters),
            fetchByStatus(filters),
            fetchRows({ ...filters, limit: 50, offset }),
            fetchByReason(filters),
            fetchTopSubregions({ ...filters, limit: 5 }),
            fetchTopDistricts({ ...filters, limit: 10 }),
            fetchByGrid({ ...filters, limit: 20 }),
          ]);
        setKpi(k);
        setVendorData(v);
        setStatusData(s);
        setRows(r);
        setReasonData(reasons);
        setTopSubs(subs);
        setTopDists(dists);
        setGridData((gridsSeries ?? []).slice(0, 20));
      } finally {
        setLoading(false);
      }
    })().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.date_from,
    filters.date_to,
    filters.subregion,
    filters.grid,
    filters.district,
    filters.site_class,
    filters.vendor, // remains null unless you add a picker later
    filters.status, // remains null unless you add a picker later
    offset,
  ]);

  const applySearch = () => {
    setOffset(0);
    setLoading(true);
    fetchRows({ ...filters, limit: 50, offset: 0 })
      .then(setRows)
      .finally(() => setLoading(false));
  };

  const clearAll = () => {
    const d2 = defaultDateRange();
    setFilters({
      date_from: d2.from,
      date_to: d2.to,
      subregion: null,
      grid: null,
      district: null,
      site_class: null,
      vendor: null,
      status: null,
      search: "",
    });
    setOffset(0);
    fetchSiteNames({ limit: 20 }).then(setSiteNames).catch(console.error);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold">RMS Dashboard</h1>
        {/* Tiny caption: Total Records */}
        <div className="text-xs text-gray-500">
          Total records: <span className="font-medium">{kpi.total_count}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        {/* Dates */}
        <div className="flex flex-col">
          <label className="text-sm mb-1">From</label>
          <Input
            type="date"
            min={bounds.min_date ?? undefined}
            max={bounds.max_date ?? undefined}
            value={filters.date_from}
            onChange={(e) => {
              setFilters({ ...filters, date_from: e.target.value });
              setOffset(0);
            }}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm mb-1">To</label>
          <Input
            type="date"
            min={bounds.min_date ?? undefined}
            max={bounds.max_date ?? undefined}
            value={filters.date_to}
            onChange={(e) => {
              setFilters({ ...filters, date_to: e.target.value });
              setOffset(0);
            }}
          />
        </div>

        {/* SSL cascade */}
        <div className="flex flex-col">
          <label className="text-sm mb-1">SubRegion</label>
          <select
            className="border rounded px-2 py-2"
            value={filters.subregion ?? ""}
            onChange={(e) => {
              setFilters({ ...filters, subregion: e.target.value || null });
              setOffset(0);
            }}
          >
            <option value="">All</option>
            {subregions.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm mb-1">Grid</label>
          <select
            className="border rounded px-2 py-2"
            value={filters.grid ?? ""}
            onChange={(e) => {
              setFilters({ ...filters, grid: e.target.value || null });
              setOffset(0);
            }}
          >
            <option value="">All</option>
            {grids.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm mb-1">District</label>
          <select
            className="border rounded px-2 py-2"
            value={filters.district ?? ""}
            onChange={(e) => {
              setFilters({ ...filters, district: e.target.value || null });
              setOffset(0);
            }}
          >
            <option value="">All</option>
            {districts.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>

        {/* Site Classification */}
        <div className="flex flex-col">
          <label className="text-sm mb-1">Site Classification</label>
          <select
            className="border rounded px-2 py-2"
            value={filters.site_class ?? ""}
            onChange={(e) => {
              setFilters({ ...filters, site_class: e.target.value || null });
              setOffset(0);
            }}
          >
            <option value="">All</option>
            {siteClasses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Site Name (autocomplete-backed) */}
        <div className="md:col-span-2 flex flex-col">
          <label className="text-sm mb-1">Site Name</label>
          <select
            className="border rounded px-2 py-2"
            value={filters.search || ""}
            onChange={(e) => {
              setFilters({ ...filters, search: e.target.value });
              setOffset(0);
            }}
          >
            <option value="">All</option>
            {siteNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Type to refresh site names…"
              value={filters.search}
              onChange={async (e) => {
                const val = e.target.value;
                setFilters({ ...filters, search: val });
                const names = await fetchSiteNames({
                  query: val || null,
                  subregion: filters.subregion,
                  grid: filters.grid,
                  district: filters.district,
                  limit: 20,
                });
                setSiteNames(names);
              }}
            />
            <Button onClick={applySearch} disabled={loading}>
              Search
            </Button>
            <Button variant="secondary" onClick={clearAll}>
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* KPI: Distinct Sites */}
      <div className="grid grid-cols-1">
        <div className="rounded-2xl p-4 bg-indigo-50 border">
          <div className="text-sm text-indigo-700">Distinct Sites</div>
          <div className="text-3xl font-bold">{kpi.site_count}</div>
        </div>
      </div>

      {/* Row 1: Vendor bar + Reason table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border p-3">
          <div className="font-medium mb-2">Distinct Sites by Vendor</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendorData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="vendor" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="site_count">
                  {vendorData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={shadeByValue(
                        d.site_count,
                        vendorMinMax.min,
                        vendorMinMax.max
                      )}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border p-3">
          <div className="font-medium mb-2">Distinct Sites by Reason</div>
          <div className="max-h-64 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left border-b">
                  <th className="p-2">Reason</th>
                  <th className="p-2">Distinct Sites</th>
                </tr>
              </thead>
              <tbody>
                {reasonData.map((row, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{row.reason ?? "Unknown"}</td>
                    <td className="p-2">{row.site_count}</td>
                  </tr>
                ))}
                {reasonData.length === 0 && !loading && (
                  <tr>
                    <td colSpan={2} className="p-3 text-center text-gray-500">
                      No data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 2: Top-5 SubRegions + Top-10 Districts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border p-3">
          <div className="font-medium mb-2">
            Top 5 SubRegions (Distinct Sites)
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSubs}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subregion" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="site_count">
                  {topSubs.map((d, i) => (
                    <Cell
                      key={i}
                      fill={shadeByValue(
                        d.site_count,
                        subMinMax.min,
                        subMinMax.max
                      )}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border p-3">
          <div className="font-medium mb-2">
            Top 10 Districts (Distinct Sites)
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topDists}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="district" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="site_count">
                  {topDists.map((d, i) => (
                    <Cell
                      key={i}
                      fill={shadeByValue(
                        d.site_count,
                        distMinMax.min,
                        distMinMax.max
                      )}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Distinct Sites by Grid (Top 20) */}
      <div className="rounded-2xl border p-3">
        <div className="font-medium mb-2">Top 20 Grids (Distinct Sites)</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={gridData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="grid" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="site_count">
                {gridData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={shadeByValue(
                      d.site_count,
                      gridMinMax.min,
                      gridMinMax.max
                    )}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Records Table */}
      <div className="rounded-2xl border">
        <div className="p-3 font-medium">Records</div>
        <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left border-b">
                <th className="p-2">Date</th>
                <th className="p-2">Site ID</th>
                <th className="p-2">Site Name</th>
                <th className="p-2">SubRegion</th>
                <th className="p-2">Grid</th>
                <th className="p-2">District</th>
                <th className="p-2">Vendor</th>
                <th className="p-2">Final Status</th>
                <th className="p-2">Conn</th>
                <th className="p-2">Abnormality</th>
                <th className="p-2">Reason</th>
                <th className="p-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="p-2">{r.report_date}</td>
                  <td className="p-2">{r.site_id}</td>
                  <td className="p-2">{r.site_name}</td>
                  <td className="p-2">{r.subregion}</td>
                  <td className="p-2">{r.grid}</td>
                  <td className="p-2">{r.district}</td>
                  <td className="p-2">{r.rms_vendor}</td>
                  <td className="p-2">{r.final_status}</td>
                  <td className="p-2">{r.rms_status_connected_disconnected}</td>
                  <td className="p-2">{r.rms_abnormality}</td>
                  <td className="p-2">{r.abnormal_reason}</td>
                  <td className="p-2">{r.currentrms_type}</td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td className="p-3 text-center text-gray-500" colSpan={12}>
                    No records
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 flex items-center gap-2 justify-end">
          <Button
            variant="secondary"
            onClick={() => setOffset(Math.max(0, offset - 50))}
            disabled={offset === 0 || loading}
          >
            Previous
          </Button>
          <Button onClick={() => setOffset(offset + 50)} disabled={loading}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

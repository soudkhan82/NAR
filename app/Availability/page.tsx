// app/availability/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchCellAvailBundle,
  fetchSubregions,
  fetchGrids,
  fetchDistricts,
  fetchSiteNames,
  type BundleFilters,
  type BundleResult,
  type NameValue,
  type BandItem,
  type DailyPoint,
} from "@/app/lib/rpc/avail";

/* ========================= tiny utilities ========================= */
const DEFAULT_BANDS: ReadonlyArray<BandItem> = Object.freeze([
  { name: "> 95", count: 0 },
  { name: "90–95", count: 0 },
  { name: "< 90", count: 0 },
]);

const isAll = (v?: string | null) => !!v && v.trim().toLowerCase() === "all";
const blankToNull = (s?: string | null) => (s && s.trim() !== "" ? s : null);
const toFixedOrDash = (v: number | null | undefined) =>
  v == null || Number.isNaN(v) ? "—" : Number(v).toFixed(2);

type HBarRow = { name: string; value: number };
function sanitizeNameValue(
  rows: ReadonlyArray<NameValue>
): ReadonlyArray<HBarRow> {
  return (rows ?? [])
    .filter((r) => r.value != null)
    .map((r) => ({
      name: r.name,
      value: Number(r.value),
    }));
}

/* ============================= page ============================= */
export default function AvailabilityPage() {
  // default dates
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const last30Str = () => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  };

  const DEFAULT_SUBREGION = "North-1";
  const ALL_LABEL = "All";

  // filters
  const [subregion, setSubregion] = useState<string>(DEFAULT_SUBREGION);
  const [grid, setGrid] = useState<string>("");
  const [district, setDistrict] = useState<string>("");
  const [sitename, setSitename] = useState<string>("");

  const [dateFrom, setDateFrom] = useState<string>(last30Str());
  const [dateTo, setDateTo] = useState<string>(todayStr());

  // cascade clears
  useEffect(() => {
    setGrid("");
    setDistrict("");
    setSitename("");
  }, [subregion]);
  useEffect(() => {
    setDistrict("");
    setSitename("");
  }, [grid]);
  useEffect(() => {
    setSitename("");
  }, [district]);

  // bundle fetch
  const [bundle, setBundle] = useState<BundleResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  const filters: BundleFilters = useMemo(
    () => ({
      subregion: isAll(subregion) ? null : blankToNull(subregion),
      grid: blankToNull(grid),
      district: blankToNull(district),
      sitename: blankToNull(sitename),
      dateFrom,
      dateTo,
    }),
    [subregion, grid, district, sitename, dateFrom, dateTo]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await fetchCellAvailBundle(filters);
        if (alive) setBundle(data);
      } catch (e) {
        if (alive) {
          setErr(e instanceof Error ? e.message : "Failed to load data");
          setBundle(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [filters]);

  // picklists
  const loadSubregions = useCallback(async (): Promise<string[]> => {
    const rows = await fetchSubregions();
    return Array.from(new Set([ALL_LABEL, ...rows.filter(Boolean)]));
  }, []);
  const loadGrids = useCallback(async (): Promise<string[]> => {
    return await fetchGrids(isAll(subregion) ? null : subregion);
  }, [subregion]);
  const loadDistricts = useCallback(async (): Promise<string[]> => {
    return await fetchDistricts(
      isAll(subregion) ? null : subregion,
      blankToNull(grid)
    );
  }, [subregion, grid]);
  const loadSiteNames = useCallback(
    async (term: string): Promise<string[]> =>
      await fetchSiteNames(
        term,
        isAll(subregion) ? null : subregion,
        blankToNull(grid),
        blankToNull(district)
      ),
    [subregion, grid, district]
  );

  // derived
  const daily: ReadonlyArray<DailyPoint> = bundle?.daily ?? [];
  const bandsPGS: ReadonlyArray<BandItem> = bundle?.bands_pgs ?? DEFAULT_BANDS;
  const bandsSB: ReadonlyArray<BandItem> = bundle?.bands_sb ?? DEFAULT_BANDS;
  const byGrid: ReadonlyArray<HBarRow> = sanitizeNameValue(
    bundle?.by_grid ?? []
  );
  const byDistrict: ReadonlyArray<HBarRow> = sanitizeNameValue(
    bundle?.by_district ?? []
  );
  const yTicks = useMemo(
    () => Array.from({ length: 51 }, (_, i) => 50 + i),
    []
  );

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b sticky top-0 z-10 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg md:text-xl font-semibold">
              Availability Dashboard
            </h1>
            <div className="hidden md:block text-xs text-slate-500">
              {dateFrom} → {dateTo} {loading && " • refreshing…"}
            </div>
          </div>

          {/* Filters */}
          <div className="mt-3 rounded-xl border bg-white">
            <div className="grid md:grid-cols-6 gap-2 p-3">
              <SelectBox
                label="SubRegion"
                value={subregion}
                onChange={setSubregion}
                fetchItems={loadSubregions}
              />
              <SelectBox
                label="Grid"
                value={grid}
                onChange={setGrid}
                fetchItems={loadGrids}
              />
              <SelectBox
                label="District"
                value={district}
                onChange={setDistrict}
                fetchItems={loadDistricts}
              />
              <Typeahead
                label="SiteName"
                value={sitename}
                onChange={setSitename}
                fetchItems={loadSiteNames}
                placeholder="Search site…"
              />
              <DateInput label="From" value={dateFrom} onChange={setDateFrom} />
              <DateInput label="To" value={dateTo} onChange={setDateTo} />
            </div>
            <div className="flex items-center gap-2 px-3 pb-3">
              <button
                onClick={() => {
                  setSubregion(DEFAULT_SUBREGION);
                  setGrid("");
                  setDistrict("");
                  setSitename("");
                  setDateFrom(last30Str());
                  setDateTo(todayStr());
                }}
                className="px-3 py-2 text-sm rounded-lg border hover:bg-slate-50"
                type="button"
              >
                Reset to defaults
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {err && <Banner type="error" message={err} />}

        {/* KPI cards */}
        <CardsLite
          siteCount={bundle?.cards.site_count ?? 0}
          avgPGS={bundle?.cards.avg_pgs ?? null}
          avgSB={bundle?.cards.avg_sb ?? null}
        />

        {/* Daily PGS/SB */}
        <Section
          title="Daily Availability"
          subtitle="Y-axis 50–100 (1-unit ticks)"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <LineChartSingle
              title="Daily — PGS"
              data={daily}
              xKey="date"
              yKey="pgs"
              color="#2563eb"
              yTicks={yTicks}
            />
            <LineChartSingle
              title="Daily — SB"
              data={daily}
              xKey="date"
              yKey="sb"
              color="#10b981"
              yTicks={yTicks}
            />
          </div>
          {daily.length === 0 && (
            <EmptyState message="No daily data for the selected filters/dates." />
          )}
        </Section>

        {/* Bands */}
        <Section
          title="Availability Bands"
          subtitle="Distinct sites by average availability slab"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <BandBarCounts
              title="PGS — Sites per Band"
              data={bandsPGS}
              color="#2563eb"
            />
            <BandBarCounts
              title="SB — Sites per Band"
              data={bandsSB}
              color="#10b981"
            />
          </div>
        </Section>

        {/* Geo averages */}
        <Section
          title="Geographic Averages"
          subtitle="Average overall availability by Grid and District"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <HorizontalBarChart
              title="Avg Overall by Grid"
              data={byGrid}
              color="#0ea5e9"
            />
            <HorizontalBarChart
              title="Avg Overall by District"
              data={byDistrict}
              color="#8b5cf6"
            />
          </div>
          {byGrid.length === 0 && byDistrict.length === 0 && (
            <EmptyState message="No Grid/District aggregates for the selected filters/dates." />
          )}
        </Section>
      </main>
    </div>
  );
}

/* ============================ small UI ============================ */

function SelectBox(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  fetchItems: () => Promise<string[]>;
  placeholder?: string;
}) {
  const { label, value, onChange, fetchItems, placeholder = "All" } = props;
  const [opts, setOpts] = useState<ReadonlyArray<string>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const list = await fetchItems();
        if (alive) setOpts(Array.isArray(list) ? list : []);
      } catch (e) {
        if (alive) {
          setErr(e instanceof Error ? e.message : "Failed to load options");
          setOpts([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchItems]);

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="opacity-75">{label}</span>
      <select
        className="px-2 py-2 rounded-lg border"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {opts.length === 0 && (
          <option value="">{loading ? "Loading…" : placeholder}</option>
        )}
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {err && <span className="text-[11px] text-rose-600">{err}</span>}
    </label>
  );
}

function Typeahead(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  fetchItems: (q: string) => Promise<string[]>;
  placeholder?: string;
}) {
  const { label, value, onChange, fetchItems, placeholder = "Search…" } = props;
  const [q, setQ] = useState<string>("");
  const [opts, setOpts] = useState<ReadonlyArray<string>>([]);
  const [open, setOpen] = useState<boolean>(false);

  const search = useCallback(
    async (term: string) => {
      try {
        const res = await fetchItems(term);
        setOpts(res ?? []);
      } catch {
        setOpts([]);
      }
    },
    [fetchItems]
  );

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => void search(q), 150);
    return () => window.clearTimeout(id);
  }, [q, open, search]);

  return (
    <label className="flex flex-col gap-1 text-sm relative">
      <span className="opacity-75">{label}</span>
      <input
        className="px-2 py-2 rounded-lg border"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onInput={(e) => setQ((e.target as HTMLInputElement).value)}
      />
      {open && opts.length > 0 && (
        <div className="absolute z-20 top-[68px] left-0 right-0 border rounded-lg max-h-48 overflow-auto bg-white shadow">
          {opts.map((o) => (
            <div
              key={o}
              className="px-2 py-1 text-sm hover:bg-slate-50 cursor-pointer"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => {
                onChange(o);
                setOpen(false);
              }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </label>
  );
}

function DateInput(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { label, value, onChange } = props;
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="opacity-75">{label} (YYYY-MM-DD)</span>
      <input
        type="date"
        className="px-2 py-2 rounded-lg border"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Banner(props: { type?: "info" | "error"; message: string }) {
  const { type = "info", message } = props;
  const cls =
    type === "error"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : "bg-blue-50 text-blue-700 border-blue-200";
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>
      {message}
    </div>
  );
}

function Section(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { title, subtitle, children } = props;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base md:text-lg font-semibold">{title}</h2>
        {subtitle && (
          <p className="text-xs md:text-sm text-slate-600 mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function CardsLite(props: {
  siteCount: number;
  avgPGS: number | null;
  avgSB: number | null;
}) {
  const { siteCount, avgPGS, avgSB } = props;
  const Card = ({ label, value }: { label: string; value: number | null }) => (
    <div className="p-4 rounded-xl border bg-white">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="text-2xl font-semibold">{toFixedOrDash(value)}</div>
    </div>
  );
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="p-4 rounded-xl border bg-white">
        <div className="text-xs text-slate-600">Sites</div>
        <div className="text-2xl font-semibold">{siteCount}</div>
      </div>
      <Card label="Avg PGS" value={avgPGS} />
      <Card label="Avg SB" value={avgSB} />
    </div>
  );
}

/* ============================ charts ============================ */

function LineChartSingle(props: {
  title: string;
  data: ReadonlyArray<DailyPoint>;
  xKey: keyof DailyPoint; // "date"
  yKey: "pgs" | "sb";
  color?: string;
  yTicks: ReadonlyArray<number>;
}) {
  const { title, data, xKey, yKey, color = "#2563eb", yTicks } = props;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {
    LineChart: RCLineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
  } = require("recharts");
  return (
    <div className="p-4 rounded-xl border bg-white">
      <div className="text-sm font-medium mb-2">{title}</div>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <RCLineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey as string} tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 12 }}
              domain={[50, 100]}
              ticks={yTicks as number[]}
            />
            <Tooltip />
            <Line type="monotone" dataKey={yKey} dot={false} stroke={color} />
          </RCLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function BandBarCounts(props: {
  title: string;
  data: ReadonlyArray<BandItem>;
  color: string;
}) {
  const { title, data, color } = props;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {
    BarChart: RCBarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
  } = require("recharts");
  const safe = Array.isArray(data) ? data : DEFAULT_BANDS;
  return (
    <div className="p-4 rounded-xl border bg-white">
      <div className="text-sm font-medium mb-2">{title}</div>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <RCBarChart data={safe}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill={color} />
          </RCBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function HorizontalBarChart(props: {
  title: string;
  data: ReadonlyArray<HBarRow>;
  color?: string;
  visibleCount?: number;
  barHeight?: number;
}) {
  const {
    title,
    data,
    color = "#6b7280",
    visibleCount = 15,
    barHeight = 22,
  } = props;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {
    BarChart: RCBarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
  } = require("recharts");
  const rows = Array.isArray(data) ? data : [];
  const totalHeight = Math.max(140, rows.length * barHeight + 80);
  const viewportHeight = Math.max(220, visibleCount * barHeight + 80);

  return (
    <div className="p-4 rounded-xl border bg-white">
      <div className="text-sm font-medium mb-2">{title}</div>
      <div
        style={{
          maxHeight: viewportHeight,
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        <div style={{ width: "100%", height: totalHeight, minHeight: 220 }}>
          <ResponsiveContainer>
            <RCBarChart
              data={rows}
              layout="vertical"
              margin={{ left: 12, right: 12, top: 8, bottom: 8 }}
              barCategoryGap={6}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 12 }} domain={[0, 100]} />
              <YAxis
                type="category"
                dataKey="name"
                width={160}
                tick={{ fontSize: 12 }}
                interval={0}
              />
              <Tooltip />
              <Bar dataKey="value" fill={color} />
            </RCBarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function EmptyState(props: { message: string }) {
  return (
    <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-600">
      {props.message}
    </div>
  );
}

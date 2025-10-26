// app/availability/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchCellAvailBundle,
  fetchSubregions,
  fetchGrids,
  fetchDistricts,
  fetchSiteNames,
  type BundleFilters,
  type BundleResult,
} from "@/app/lib/rpc/avail";
import { Cards } from "@/app/components/Cards";
import AreaChart from "@/app/components/AreaChart";
import BarChart from "@/app/components/BarChart";
import HorizontalBarChart from "@/app/components/HorizontalBarChart";
import ComboBox from "@/app/components/ComboBox";

/* =========================================================
   Availability Page (polished UI)
   - Sticky, glassy filter bar
   - Containerized layout with better spacing/typography
   - Skeletons while loading, clean error banner
   - 4 charts grid + District chart
   ========================================================= */

export default function AvailabilityPage() {
  /* ---------- defaults ---------- */
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const last30Str = () => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  };
  const DEFAULT_SUBREGION = "North-1";

  /* ---------- filter state ---------- */
  const [subregion, setSubregion] = useState<string>(DEFAULT_SUBREGION);
  const [grid, setGrid] = useState<string>("");
  const [district, setDistrict] = useState<string>("");
  const [sitename, setSitename] = useState<string>("");

  const [dateFrom, setDateFrom] = useState<string>(last30Str());
  const [dateTo, setDateTo] = useState<string>(todayStr());

  // Reset dependent filters when parents change
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

  /* ---------- data ---------- */
  const [bundle, setBundle] = useState<BundleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const filters: BundleFilters = useMemo(
    () => ({
      subregion: blankToNull(subregion),
      grid: blankToNull(grid),
      district: blankToNull(district),
      sitename: blankToNull(sitename),
      dateFrom,
      dateTo,
    }),
    [subregion, grid, district, sitename, dateFrom, dateTo]
  );

  // Auto-fetch on any change
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await fetchCellAvailBundle(filters);
        if (alive) setBundle(data);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [filters]);

  // Dropdown providers (scoped by SubRegion)
  const getSubregions = async (_: string) => fetchSubregions();
  const getGrids = async (_: string) => fetchGrids(blankToNull(subregion));
  const getDistricts = async (_: string) =>
    fetchDistricts(blankToNull(subregion), blankToNull(grid));
  const getSiteNamesCb = async (term: string) =>
    fetchSiteNames(
      term,
      blankToNull(subregion),
      blankToNull(grid),
      blankToNull(district)
    );

  // Reset to defaults
  const resetFilters = () => {
    setSubregion(DEFAULT_SUBREGION);
    setGrid("");
    setDistrict("");
    setSitename("");
    setDateFrom(last30Str());
    setDateTo(todayStr());
  };

  const hasData =
    !!bundle &&
    (bundle.daily?.length ||
      bundle.weekly?.length ||
      bundle.by_district?.length);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/90 border-b">
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg md:text-xl font-semibold tracking-tight">
                Availability Dashboard
              </h1>
              <p className="text-xs md:text-sm text-slate-600">
                SubRegion defaults to{" "}
                <span className="font-medium">North-1</span>. Other filters
                follow it.
              </p>
            </div>
            <div className="hidden md:block text-xs text-slate-500">
              {dateFrom} → {dateTo}
            </div>
          </div>

          {/* Filter bar (glassy card) */}
          <div className="mt-3 rounded-2xl border bg-white/70 shadow-sm">
            <div className="grid md:grid-cols-6 gap-2 p-3">
              <ComboBox
                label="SubRegion"
                value={subregion}
                onChange={setSubregion}
                fetchOptions={getSubregions}
              />
              <ComboBox
                label="Grid"
                value={grid}
                onChange={setGrid}
                fetchOptions={getGrids}
              />
              <ComboBox
                label="District"
                value={district}
                onChange={setDistrict}
                fetchOptions={getDistricts}
              />
              <ComboBox
                label="SiteName"
                value={sitename}
                onChange={setSitename}
                fetchOptions={getSiteNamesCb}
              />
              <DateInput label="From" value={dateFrom} onChange={setDateFrom} />
              <DateInput label="To" value={dateTo} onChange={setDateTo} />
            </div>

            <div className="flex items-center gap-2 p-3 pt-0">
              <Button variant="ghost" onClick={resetFilters}>
                <RefreshIcon className="mr-1.5" /> Reset to defaults
              </Button>
              <div className="ml-auto text-xs text-slate-500">
                {loading ? "Refreshing…" : "Up to date"}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Error banner */}
        {err && <Banner type="error" message={err} />}

        {/* Cards or skeleton */}
        {loading && !bundle ? (
          <SkeletonCards />
        ) : (
          bundle && (
            <Cards
              siteCount={bundle.cards.site_count ?? 0}
              avgPGS={num(bundle.cards.avg_pgs)}
              avgSB={num(bundle.cards.avg_sb)}
            />
          )
        )}

        {/* Charts */}
        <Section
          title="Trends"
          subtitle="Daily areas & weekly bars for PGS and SB"
        >
          {loading && !hasData ? (
            <SkeletonGrid count={4} />
          ) : hasData ? (
            <div className="grid md:grid-cols-2 gap-4">
              <AreaChart
                title="Daily — PGS"
                data={bundle!.daily}
                xKey="date"
                yKey="pgs"
                series="PGS"
              />
              <BarChart
                title="Weekly — PGS"
                data={bundle!.weekly}
                xKey="week"
                yKey="pgs"
                series="PGS"
              />
              <AreaChart
                title="Daily — SB"
                data={bundle!.daily}
                xKey="date"
                yKey="sb"
                series="SB"
              />

              <BarChart
                title="Weekly — SB"
                data={bundle!.weekly}
                xKey="week"
                yKey="sb"
                series="SB"
              />
            </div>
          ) : (
            <EmptyState message="No trend data for the selected filters/dates." />
          )}
        </Section>

        {/* District averages */}
        <Section
          title="Distribution"
          subtitle="Average overall availability by District"
        >
          {loading && !bundle ? (
            <SkeletonGrid count={1} tall />
          ) : bundle && bundle.by_district?.length ? (
            <div className="grid gap-4">
              <HorizontalBarChart
                title="Avg Overall by District"
                data={bundle.by_district.map((r) => ({
                  ...r,
                  value: r.value ?? 0,
                }))}
                color="#8b5cf6"
                maxItems={15}
              />
            </div>
          ) : (
            <EmptyState message="No district data for the selected filters/dates." />
          )}
        </Section>

        <footer className="pt-2 pb-10 text-xs text-slate-500">
          Data reflects filters above. Overall is averaged per selection scope.
        </footer>
      </main>
    </div>
  );
}

/* ----------------- helpers & tiny UI atoms (local) ----------------- */
function blankToNull(s?: string | null) {
  return s && s.trim() !== "" ? s : null;
}
function num(n: number | null | undefined) {
  return n == null ? null : Number(n);
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="opacity-75">{label} (YYYY-MM-DD)</span>
      <input
        type="date"
        className="px-2 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-slate-300"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
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

function Button({
  children,
  onClick,
  variant = "solid",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "solid" | "ghost";
}) {
  const base = "inline-flex items-center rounded-lg text-sm transition";
  const styles =
    variant === "ghost"
      ? "px-3 py-2 border hover:bg-slate-50"
      : "px-3 py-2 bg-slate-900 text-white hover:bg-slate-800";
  return (
    <button onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

function RefreshIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M17.65 6.35A7.95 7.95 0 0012 4a8 8 0 108 8h-2a6 6 0 11-6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
  );
}

function Banner({
  type = "info",
  message,
}: {
  type?: "info" | "error";
  message: string;
}) {
  const isError = type === "error";
  const classes = isError
    ? "bg-rose-50 text-rose-700 border-rose-200"
    : "bg-blue-50 text-blue-700 border-blue-200";
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${classes}`}>
      {message}
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-2xl border shadow-sm bg-white animate-pulse"
        >
          <div className="h-3 w-24 bg-slate-200 rounded mb-2" />
          <div className="h-7 w-32 bg-slate-200 rounded" />
        </div>
      ))}
    </div>
  );
}

function SkeletonGrid({
  count = 4,
  tall = false,
}: {
  count?: number;
  tall?: boolean;
}) {
  return (
    <div className={`grid ${count > 1 ? "md:grid-cols-2" : ""} gap-4`}>
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-2xl border shadow-sm bg-white animate-pulse"
        >
          <div className="h-4 w-40 bg-slate-200 rounded mb-3" />
          <div
            className={`w-full ${tall ? "h-64" : "h-48"} bg-slate-100 rounded`}
          />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-600">
      {message}
    </div>
  );
}

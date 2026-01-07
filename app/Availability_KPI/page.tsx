// app/Availability_KPI/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  buildRecentMonths,
  fetchAvailabilityKpiMaxDate,
  fetchAvailabilityKpiSummary,
  fetchAvailabilityKpiSites,
  firstDayOfMonthFromYYYYMM,
  mergeAllRow,
  mergeRowByKey,
  parseGrain,
  parseRegion,
  toISODate,
  yyyymmFromISO,
  type Grain,
  type Group,
  type Region,
  type SummaryRow,
  type SiteRow,
} from "@/app/lib/rpc/avail_KPI";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Loader2,
  BarChart3,
  CalendarDays,
  Download,
  MapPin,
  CheckCircle2,
  MinusCircle,
  AlertTriangle,
  Percent,
  Gauge,
  RefreshCw,
  Database,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
} from "recharts";

/* ---------------- utils ---------------- */
const n0 = (x: unknown): string => {
  const v = typeof x === "number" ? x : Number(x);
  return Number.isFinite(v) ? v.toLocaleString() : "—";
};

const n2 = (x: unknown): string => {
  const v = typeof x === "number" ? x : Number(x);
  return Number.isFinite(v)
    ? v.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";
};

function scopeLabel(region: Region, sub: string | null) {
  if (sub) return `${region} · ${sub}`;
  if (region !== "ALL") return `Region: ${region}`;
  return `Nationwide`;
}

function AvailabilityKpiInner() {
  const sp = useSearchParams();
  const router = useRouter();

  const grain: Grain = parseGrain(sp.get("grain"));
  const region: Region = parseRegion(sp.get("region"));

  const subParam = sp.get("sub");
  const subRegion = subParam && subParam.trim() ? subParam.trim() : null;

  const asOfISO = useMemo(() => {
    const s = sp.get("asOf") ?? "";
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
  }, [sp]);

  const monthYYYYMM = useMemo(() => {
    const s = sp.get("month") ?? "";
    return /^\d{4}-\d{2}$/.test(s) ? s : "";
  }, [sp]);

  const effectiveDateISO = useMemo(() => {
    if (grain === "Monthly")
      return monthYYYYMM ? firstDayOfMonthFromYYYYMM(monthYYYYMM) : "";
    return asOfISO;
  }, [grain, asOfISO, monthYYYYMM]);

  const [loadingInit, setLoadingInit] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const [pgsSummary, setPgsSummary] = useState<SummaryRow[]>([]);
  const [sbSummary, setSbSummary] = useState<SummaryRow[]>([]);

  const [tableGroup, setTableGroup] = useState<Group>("PGS");
  const [tableSearch, setTableSearch] = useState("");

  const [monthsList, setMonthsList] = useState<string[]>([]);
  const [maxDate, setMaxDate] = useState<string>("");

  // ✅ row selection for site table (does not touch URL filters)
  type Region3 = Exclude<Region, "ALL">;

  const [selectedRow, setSelectedRow] = useState<{
    sub_region: string;
    region: Region3;
  } | null>(null);

  // ✅ site table states
  const [siteSearch, setSiteSearch] = useState("");
  const [siteRows, setSiteRows] = useState<SiteRow[]>([]);
  const [siteLoading, setSiteLoading] = useState(false);
  const [siteOffset, setSiteOffset] = useState(0);
  const siteLimit = 200;

  const setParams = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [key, val] of Object.entries(patch)) {
      if (val == null || val === "") p.delete(key);
      else p.set(key, val);
    }
    router.push(`?${p.toString()}`);
  };

  /* init max date */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingInit(true);
      try {
        const max = await fetchAvailabilityKpiMaxDate({
          group: null,
          region: region === "ALL" ? null : region,
        });
        if (cancelled) return;

        const maxISO = max || toISODate(new Date());
        setMaxDate(maxISO);
        setMonthsList(buildRecentMonths(maxISO, 24));

        if (grain === "Monthly") {
          const mm = monthYYYYMM || yyyymmFromISO(maxISO);
          if (!monthYYYYMM && mm) setParams({ month: mm, asOf: null });
        } else {
          if (!asOfISO) setParams({ asOf: maxISO, month: null });
        }
      } finally {
        if (!cancelled) setLoadingInit(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grain, region]);

  /* ✅ load BOTH from the SAME summary RPC */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!effectiveDateISO) return;

      setLoadingData(true);
      try {
        const [pgs, sb] = await Promise.all([
          fetchAvailabilityKpiSummary({
            group: "PGS",
            dateISO: effectiveDateISO,
            region,
          }),
          fetchAvailabilityKpiSummary({
            group: "SB",
            dateISO: effectiveDateISO,
            region,
          }),
        ]);

        if (cancelled) return;
        setPgsSummary(pgs);
        setSbSummary(sb);
      } catch (e) {
        console.error("Availability KPI load error:", e);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [region, effectiveDateISO]);

  const activeSummary = tableGroup === "PGS" ? pgsSummary : sbSummary;

  const pgsAll = useMemo(
    () => pgsSummary.find((r) => r.label.toLowerCase() === "all") ?? null,
    [pgsSummary]
  );
  const sbAll = useMemo(
    () => sbSummary.find((r) => r.label.toLowerCase() === "all") ?? null,
    [sbSummary]
  );

  /* ✅ cards are always ALL = PGS+SB merged */
  const scopeRowAll: SummaryRow | null = useMemo(() => {
    if (!pgsSummary.length && !sbSummary.length) return null;

    if (region !== "ALL" && subRegion) {
      return mergeRowByKey(pgsSummary, sbSummary, subRegion, region) ?? null;
    }
    if (region !== "ALL") {
      return mergeRowByKey(pgsSummary, sbSummary, region, region) ?? null;
    }
    return mergeAllRow(pgsAll, sbAll);
  }, [pgsSummary, sbSummary, region, subRegion, pgsAll, sbAll]);

  const cards = useMemo(() => {
    const r: any = scopeRowAll;
    return {
      total: r?.total_sites ?? 0,
      score: r?.score ?? null,
      ach: r?.achievement ?? null,
      t: r?.target_achieved ?? 0,
      b: r?.base_achieved ?? 0,
      below: r?.target_and_base_not_achieved ?? 0,
    };
  }, [scopeRowAll]);

  const subRegionOptions = useMemo(() => {
    if (region === "ALL") return [];
    const sub = activeSummary
      .filter(
        (r) =>
          r.parent_region === region &&
          r.label !== region &&
          r.label.toLowerCase() !== "all"
      )
      .map((r) => r.label);
    return Array.from(new Set(sub)).sort();
  }, [activeSummary, region]);

  const graphRows = useMemo(() => {
    const src = activeSummary;
    if (!src.length) return [];

    if (region !== "ALL" && subRegion) {
      const r = src.find((x) => x.label === subRegion);
      return r
        ? [
            {
              label: r.label,
              score: r.score ?? 0,
              achievement: r.achievement ?? 0,
            },
          ]
        : [];
    }

    if (region !== "ALL") {
      const rows = src
        .filter(
          (r) =>
            r.parent_region === region &&
            r.label !== region &&
            r.label.toLowerCase() !== "all"
        )
        .map((r) => ({
          label: r.label,
          score: r.score ?? 0,
          achievement: r.achievement ?? 0,
        }));
      rows.sort((a, b) => a.label.localeCompare(b.label));
      return rows;
    }

    const order = ["North", "Central", "South"];
    const rows = src
      .filter(
        (r) => r.label === r.parent_region && r.label.toLowerCase() !== "all"
      )
      .map((r) => ({
        label: r.label,
        score: r.score ?? 0,
        achievement: r.achievement ?? 0,
      }));
    rows.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
    return rows;
  }, [activeSummary, region, subRegion]);

  const tableRows = useMemo(() => {
    let rows = activeSummary.filter(
      (r) => r.label !== r.parent_region && r.label.toLowerCase() !== "all"
    );
    if (region !== "ALL") rows = rows.filter((r) => r.parent_region === region);

    const q = tableSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          r.parent_region.toLowerCase().includes(q)
      );
    }

    rows.sort(
      (a, b) =>
        a.parent_region.localeCompare(b.parent_region) ||
        a.label.localeCompare(b.label)
    );
    return rows;
  }, [activeSummary, region, tableSearch]);

  // ✅ Reset selection when group/date/region changes (keeps UX clean)
  useEffect(() => {
    setSelectedRow(null);
    setSiteSearch("");
    setSiteRows([]);
    setSiteOffset(0);
  }, [tableGroup, effectiveDateISO, region]);

  // ✅ Load site table (whenever selection/search/offset changes)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!effectiveDateISO) return;

      setSiteLoading(true);
      try {
        const scopedRegion =
          selectedRow?.region ??
          (region === "ALL" ? null : (region as Exclude<Region, "ALL">));

        const scopedSub = selectedRow?.sub_region ?? null;

        const rows = await fetchAvailabilityKpiSites({
          group: tableGroup,
          dateISO: effectiveDateISO,
          region: scopedRegion,
          subRegion: scopedSub,
          search: siteSearch.trim() ? siteSearch.trim() : null,
          limit: siteLimit,
          offset: siteOffset,
        });

        if (cancelled) return;

        if (siteOffset === 0) setSiteRows(rows);
        else setSiteRows((prev) => [...prev, ...rows]);
      } catch (e) {
        console.error("Site table load error:", e);
        if (!cancelled && siteOffset === 0) setSiteRows([]);
      } finally {
        if (!cancelled) setSiteLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    tableGroup,
    effectiveDateISO,
    region,
    selectedRow,
    siteSearch,
    siteOffset,
  ]);

  const downloadTableCsv = () => {
    const headers = [
      "SubRegion",
      "Region",
      "Total",
      "Target Achieved",
      "Base Achieved",
      "Below Base",
      "Ach%",
      "Score",
    ];

    const lines = [
      headers.join(","),
      ...tableRows.map((r) =>
        [
          `"${r.label}"`,
          `"${r.parent_region}"`,
          r.total_sites ?? 0,
          r.target_achieved ?? 0,
          r.base_achieved ?? 0,
          r.target_and_base_not_achieved ?? 0,
          r.achievement ?? "",
          r.score ?? "",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute(
      "download",
      `Availability_${tableGroup}_${grain}_${effectiveDateISO || "date"}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const datePillText = useMemo(() => {
    if (grain === "Monthly") return monthYYYYMM || "—";
    return effectiveDateISO || "—";
  }, [grain, monthYYYYMM, effectiveDateISO]);

  const contextText = useMemo(
    () => scopeLabel(region, subRegion),
    [region, subRegion]
  );

  const siteTitle = useMemo(() => {
    if (selectedRow)
      return `${tableGroup} · ${selectedRow.region} · ${selectedRow.sub_region} · Sites`;
    return `${tableGroup} · Sites (All / Paginated)`;
  }, [selectedRow, tableGroup]);

  return (
    <div className="dark">
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-6 space-y-4">
          {/* HEADER */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur px-4 py-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-teal-300" />
                </div>
                <div>
                  <div className="text-xl font-black tracking-wide">
                    AVAILABILITY KPI
                  </div>
                  <div className="text-[11px] text-slate-400 font-semibold tracking-widest uppercase">
                    Cards = ALL (PGS+SB) · Table/Graph = Toggle (PGS/SB)
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">
                  Context
                </div>
                <div className="mt-1 inline-flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="bg-slate-950/60 border border-slate-800"
                  >
                    {contextText}
                  </Badge>

                  {loadingInit || loadingData ? (
                    <Badge
                      variant="outline"
                      className="border-slate-700 text-slate-300"
                    >
                      <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                      Loading
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-slate-700 text-slate-300"
                    >
                      <CalendarDays className="h-3.5 w-3.5 mr-2" />
                      {datePillText}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* FILTERS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
              <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-2">
                <div className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-1">
                  Freq
                </div>
                <Select
                  value={grain}
                  onValueChange={(v) =>
                    setParams({ grain: v, asOf: null, month: null, sub: null })
                  }
                >
                  <SelectTrigger className="bg-transparent border-slate-800 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Daily">Daily</SelectItem>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="lg:col-span-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-2">
                <div className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-1 flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-teal-300" /> Region
                </div>
                <Select
                  value={region}
                  onValueChange={(v) =>
                    setParams({
                      region: v === "ALL" ? null : v,
                      sub: null,
                      asOf: null,
                      month: null,
                    })
                  }
                >
                  <SelectTrigger className="bg-transparent border-slate-800 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All (Nationwide)</SelectItem>
                    <SelectItem value="North">North</SelectItem>
                    <SelectItem value="Central">Central</SelectItem>
                    <SelectItem value="South">South</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="lg:col-span-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-2">
                <div className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-1">
                  Sub
                </div>
                <Select
                  value={subRegion ?? "ALL"}
                  onValueChange={(v) =>
                    setParams({ sub: v === "ALL" ? null : v })
                  }
                  disabled={region === "ALL"}
                >
                  <SelectTrigger className="bg-transparent border-slate-800 h-10 disabled:opacity-50">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All SubRegions</SelectItem>
                    {subRegionOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-2">
                <div className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-1">
                  {grain === "Monthly" ? "Month" : "Date"}
                </div>

                <div className="flex gap-2">
                  {grain === "Monthly" ? (
                    <Select
                      value={
                        monthYYYYMM || (maxDate ? yyyymmFromISO(maxDate) : "")
                      }
                      onValueChange={(v) => setParams({ month: v, asOf: null })}
                    >
                      <SelectTrigger className="bg-transparent border-slate-800 h-10">
                        <SelectValue placeholder="YYYY-MM" />
                      </SelectTrigger>
                      <SelectContent>
                        {monthsList.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type="date"
                      value={asOfISO}
                      onChange={(e) =>
                        setParams({ asOf: e.target.value, month: null })
                      }
                      className="bg-transparent border-slate-800 h-10 [color-scheme:dark]"
                    />
                  )}

                  <Button
                    variant="secondary"
                    className="h-10 px-3 bg-slate-900 border border-slate-800 hover:bg-slate-800"
                    onClick={() =>
                      router.push(
                        `?${new URLSearchParams(sp.toString()).toString()}`
                      )
                    }
                    title="Refresh"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* ✅ 50/50: CARDS (2 rows) + GRAPH (aligned) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* LEFT half: cards -> 3 columns, 2 rows */}
            <div className="lg:col-span-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 h-full">
                <KpiCard
                  title="Total Sites"
                  value={n0(cards.total)}
                  icon={BarChart3}
                  tone="teal"
                />
                <KpiCard
                  title="Avg Score"
                  value={cards.score == null ? "—" : `${n2(cards.score)}`}
                  icon={Gauge}
                  tone="violet"
                />
                <KpiCard
                  title="Ach %"
                  value={cards.ach == null ? "—" : `${n2(cards.ach)}%`}
                  icon={Percent}
                  tone="indigo"
                />
                <KpiCard
                  title="Target Achieved"
                  value={n0(cards.t)}
                  icon={CheckCircle2}
                  tone="teal"
                />
                <KpiCard
                  title="Base Achieved"
                  value={n0(cards.b)}
                  icon={MinusCircle}
                  tone="blue"
                />
                <KpiCard
                  title="Below Base"
                  value={n0(cards.below)}
                  icon={AlertTriangle}
                  tone="rose"
                />
              </div>
            </div>

            {/* RIGHT half: graph -> same block height as the two-row cards */}
            <div className="lg:col-span-6">
              <ChartCard
                className="h-full"
                chartHeightClass="h-[260px]"
                title={`${tableGroup} Comparison`}
                subtitle={
                  region === "ALL"
                    ? "North / Central / South"
                    : subRegion
                    ? `SubRegion: ${subRegion}`
                    : `SubRegions in ${region}`
                }
                data={graphRows}
                loading={loadingData}
              />
            </div>
          </div>

          {/* ✅ Under that: TWO TABLES side-by-side, SAME HEIGHT.
    ✅ SubRegion table: NO SCROLL (shows all rows)
    ✅ Site table: SCROLL (many rows) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* LEFT: SubRegion Table (NO scroll) */}
            <Card className="lg:col-span-6 border-slate-800 bg-slate-900/20 backdrop-blur rounded-3xl overflow-hidden flex flex-col">
              <div className="p-4 flex flex-col gap-3 border-b border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] text-slate-500 font-black tracking-widest uppercase">
                      SubRegion Summary Table
                    </div>
                    <div className="text-sm font-bold text-slate-200">
                      {tableGroup} · {grain} · {datePillText}{" "}
                      {region !== "ALL" ? `· ${region}` : ""}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-1 flex">
                    {(["PGS", "SB"] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => setTableGroup(g)}
                        className={[
                          "px-4 py-2 rounded-xl text-xs font-black transition",
                          tableGroup === g
                            ? "bg-violet-500/15 text-violet-200 border border-violet-500/25"
                            : "text-slate-400 hover:text-slate-200 border border-transparent",
                        ].join(" ")}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="Search SubRegion…"
                    className="w-[260px] bg-slate-950/40 border-slate-800"
                  />
                  <Button
                    onClick={downloadTableCsv}
                    className="bg-teal-500/10 text-teal-200 border border-teal-500/25 hover:bg-teal-500/15"
                    variant="secondary"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </Button>

                  {selectedRow ? (
                    <Button
                      variant="secondary"
                      className="bg-slate-950/40 border border-slate-800 hover:bg-slate-900"
                      onClick={() => {
                        setSelectedRow(null);
                        setSiteOffset(0);
                      }}
                      title="Clear selection"
                    >
                      Clear Selection
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* ✅ NO scroll here */}
              <div className="overflow-visible">
                <table className="w-full text-sm">
                  <thead className="bg-slate-950/60 border-b border-slate-800">
                    <tr className="text-left text-[11px] uppercase tracking-widest text-slate-500">
                      <th className="p-3">SubRegion</th>
                      <th className="p-3">Total</th>
                      <th className="p-3">Target</th>
                      <th className="p-3">Base</th>
                      <th className="p-3">Below</th>
                      <th className="p-3 text-right">Ach%</th>
                      <th className="p-3 text-right">Score</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loadingData ? (
                      <tr>
                        <td className="p-6 text-slate-300" colSpan={7}>
                          <Loader2 className="inline h-4 w-4 mr-2 animate-spin" />
                          Loading…
                        </td>
                      </tr>
                    ) : tableRows.length === 0 ? (
                      <tr>
                        <td className="p-6 text-slate-400" colSpan={7}>
                          No rows.
                        </td>
                      </tr>
                    ) : (
                      tableRows.map((r, idx) => {
                        const isSelected =
                          selectedRow?.sub_region === r.label &&
                          selectedRow?.region === r.parent_region;

                        return (
                          <tr
                            key={`${r.label}-${idx}`}
                            onClick={() => {
                              const pr = r.parent_region;
                              if (
                                pr === "North" ||
                                pr === "Central" ||
                                pr === "South"
                              ) {
                                setSelectedRow({
                                  sub_region: r.label,
                                  region: pr,
                                });
                                setSiteOffset(0);
                              }
                              setSiteOffset(0);
                            }}
                            className={[
                              "border-b border-slate-800/60 cursor-pointer",
                              isSelected
                                ? "bg-violet-500/10"
                                : "hover:bg-slate-950/30",
                            ].join(" ")}
                            title="Click to load site-wise rows"
                          >
                            <td className="p-3 font-semibold text-slate-200">
                              {r.label}
                            </td>
                            <td className="p-3 text-slate-200 tabular-nums">
                              {n0(r.total_sites)}
                            </td>
                            <td className="p-3 text-teal-200 tabular-nums">
                              {n0(r.target_achieved)}
                            </td>
                            <td className="p-3 text-blue-200 tabular-nums">
                              {n0(r.base_achieved)}
                            </td>
                            <td className="p-3 text-rose-200 tabular-nums">
                              {n0(r.target_and_base_not_achieved)}
                            </td>
                            <td className="p-3 text-right tabular-nums">
                              {r.achievement == null
                                ? "—"
                                : `${n2(r.achievement)}%`}
                            </td>
                            <td className="p-3 text-right tabular-nums">
                              {r.score == null ? "—" : `${n2(r.score)}`}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* RIGHT: Site-level table (SCROLL) */}
            <Card className="lg:col-span-6 rounded-3xl bg-slate-900/20 backdrop-blur border border-slate-800 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-2xl bg-slate-950/40 border border-slate-800 flex items-center justify-center text-slate-300">
                      <Database className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-black tracking-wide">
                        Site Details
                      </div>
                      <div className="text-[11px] text-slate-500 font-semibold">
                        {siteTitle}
                      </div>
                    </div>
                  </div>

                  {selectedRow ? (
                    <div className="mt-2 text-[11px] text-slate-400">
                      Selected:{" "}
                      <span className="text-slate-200 font-semibold">
                        {selectedRow.region} · {selectedRow.sub_region}
                      </span>
                    </div>
                  ) : (
                    <div className=" text-[11px] text-slate-500">
                      Tip: Click a SubRegion row to drill down to site level.
                    </div>
                  )}
                </div>

                <Badge
                  variant="secondary"
                  className="bg-slate-950/60 border border-slate-800"
                >
                  {siteLoading ? "Loading…" : `${siteRows.length} rows`}
                </Badge>
              </div>

              <div className="p-2 border-b border-slate-800 flex items-center gap-2">
                <Input
                  value={siteSearch}
                  onChange={(e) => {
                    setSiteSearch(e.target.value);
                    setSiteOffset(0);
                  }}
                  placeholder="Search SiteName…"
                  className="bg-slate-950/40 border-slate-800"
                />
              </div>

              {/* ✅ keep scroll only here */}
              <div className="h-[520px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-950/80 border-b border-slate-800 backdrop-blur">
                    <tr className="text-left text-[11px] uppercase tracking-widest text-slate-500">
                      <th className="p-3">Site</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Ach%</th>
                      <th className="p-3 text-right">Score</th>
                    </tr>
                  </thead>

                  <tbody>
                    {siteLoading && siteOffset === 0 ? (
                      <tr>
                        <td className="p-6 text-slate-300" colSpan={5}>
                          <Loader2 className="inline h-4 w-4 mr-2 animate-spin" />
                          Loading site rows…
                        </td>
                      </tr>
                    ) : siteRows.length === 0 ? (
                      <tr>
                        <td className="p-6 text-slate-400" colSpan={5}>
                          No sites found.
                        </td>
                      </tr>
                    ) : (
                      siteRows.map((s, i) => (
                        <tr
                          key={`${s.sitename ?? "x"}-${i}`}
                          className="border-b border-slate-800/60"
                        >
                          <td className="p-3 font-semibold text-slate-200 tabular-nums">
                            {s.sitename ?? "—"}
                          </td>
                          <td className="p-3 text-slate-300">
                            {s.category ?? "—"}
                          </td>
                          <td className="p-3 text-slate-300">
                            {s.target_status ?? "—"}
                          </td>
                          <td className="p-3 text-right tabular-nums text-slate-200">
                            {s.achievement == null
                              ? "—"
                              : `${n2(s.achievement)}%`}
                          </td>
                          <td className="p-3 text-right tabular-nums text-slate-200">
                            {s.score == null ? "—" : `${n2(s.score)}`}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-3 border-t border-slate-800 flex items-center justify-between">
                <div className="text-[11px] text-slate-500">
                  Showing {siteRows.length} (limit {siteLimit})
                </div>

                <Button
                  variant="secondary"
                  className="bg-slate-950/40 border border-slate-800 hover:bg-slate-900"
                  onClick={() => setSiteOffset((x) => x + siteLimit)}
                  disabled={siteLoading}
                  title="Load more rows"
                >
                  {siteLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading
                    </>
                  ) : (
                    "Load More"
                  )}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- small components ---------- */

function toneClasses(tone: "teal" | "violet" | "indigo" | "blue" | "rose") {
  const map: Record<string, { ring: string; icon: string; value: string }> = {
    teal: {
      ring: "border-teal-500/20 hover:border-teal-500/35",
      icon: "text-teal-300",
      value: "text-teal-100",
    },
    violet: {
      ring: "border-violet-500/20 hover:border-violet-500/35",
      icon: "text-violet-300",
      value: "text-violet-100",
    },
    indigo: {
      ring: "border-indigo-500/20 hover:border-indigo-500/35",
      icon: "text-indigo-300",
      value: "text-indigo-100",
    },
    blue: {
      ring: "border-blue-500/20 hover:border-blue-500/35",
      icon: "text-blue-300",
      value: "text-blue-100",
    },
    rose: {
      ring: "border-rose-500/20 hover:border-rose-500/35",
      icon: "text-rose-300",
      value: "text-rose-100",
    },
  };
  return map[tone];
}

function KpiCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  icon: any;
  tone: "teal" | "violet" | "indigo" | "blue" | "rose";
}) {
  const t = toneClasses(tone);
  return (
    <Card
      className={`rounded-3xl bg-slate-900/20 backdrop-blur border ${t.ring} transition`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="text-[11px] font-black tracking-widest uppercase text-slate-500">
            {title}
          </div>
          <div
            className={`h-9 w-9 rounded-2xl bg-slate-950/40 border border-slate-800 flex items-center justify-center ${t.icon}`}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className={`mt-3 text-3xl font-black tabular-nums ${t.value}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  subtitle,
  data,
  loading,
  className,
  chartHeightClass = "h-[320px]",
}: {
  title: string;
  subtitle: string;
  data: Array<{ label: string; score: number; achievement: number }>;
  loading: boolean;
  className?: string;
  chartHeightClass?: string;
}) {
  return (
    <Card
      className={[
        "rounded-3xl bg-slate-900/20 backdrop-blur border border-slate-800 overflow-hidden",
        className ?? "",
      ].join(" ")}
    >
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-sm font-black tracking-wide">{title}</div>
          <div className="text-[11px] text-slate-500 font-semibold">
            {subtitle}
          </div>
        </div>
        <Badge
          variant="secondary"
          className="bg-slate-950/60 border border-slate-800"
        >
          Score
        </Badge>
      </div>

      <div className="p-4">
        {loading ? (
          <div
            className={`${chartHeightClass} flex items-center justify-center text-slate-300`}
          >
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading…
          </div>
        ) : data.length === 0 ? (
          <div
            className={`${chartHeightClass} flex items-center justify-center text-slate-400`}
          >
            No data
          </div>
        ) : (
          <div className={chartHeightClass}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0b1220",
                    border: "1px solid #233146",
                    borderRadius: 12,
                  }}
                  labelStyle={{ color: "#e2e8f0" }}
                  formatter={(v: any) => [`${Number(v).toFixed(2)}`, "Score"]}
                />
                <Bar dataKey="score" radius={[10, 10, 0, 0]} fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function AvailabilityKpiPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading Availability KPI…
        </div>
      }
    >
      <AvailabilityKpiInner />
    </Suspense>
  );
}

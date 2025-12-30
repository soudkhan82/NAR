// app/franchise/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

import { Loader2 } from "lucide-react";

import supabase from "@/app/config/supabase-config";
import {
  fetchFranchiseEnriched,
  fetchFranchiseTimeseries60d,
  type FranchiseEnrichedRow,
  type FranchiseTimeseriesPoint,
} from "@/app/lib/rpc/franchise";

/* ---------------- helpers ---------------- */
function centroid(
  points: Array<{ latitude?: number | null; longitude?: number | null }>
) {
  const ps = points.filter(
    (p) => typeof p.latitude === "number" && typeof p.longitude === "number"
  ) as Array<{ latitude: number; longitude: number }>;
  if (!ps.length) return { lat: 33.6844, lon: 73.0479 };
  const { sumLat, sumLon } = ps.reduce(
    (acc, p) => ({
      sumLat: acc.sumLat + p.latitude,
      sumLon: acc.sumLon + p.longitude,
    }),
    { sumLat: 0, sumLon: 0 }
  );
  return { lat: sumLat / ps.length, lon: sumLon / ps.length };
}

function toPct(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n * 100;
}

function fmtDateShort(iso: string) {
  const s = String(iso ?? "");
  return s.length >= 10 ? s.slice(5, 10) : s; // MM-DD
}

const tokenize = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);
const containsAll = (hay: string, tokens: string[]) =>
  tokens.length ? tokens.every((t) => hay.toLowerCase().includes(t)) : true;

function normRemark(v: unknown) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function remarkColor(remark: string | null) {
  const r = normRemark(remark);
  if (r.includes("weak")) return "#ef4444";
  if (r.includes("good") || r.includes("ok") || r.includes("healthy"))
    return "#22c55e";
  if (r.includes("average") || r.includes("moderate")) return "#f59e0b";
  if (r.includes("critical") || r.includes("severe")) return "#7f1d1d";
  if (r.includes("unknown") || r === "" || r === "—") return "#64748b";
  return "#ec4899";
}

/* ---------------- chart ---------------- */
function AvailabilityChart60d(props: {
  data: FranchiseTimeseriesPoint[];
  heightPx: number;
}) {
  const rows = props.data ?? [];

  const chartData = rows.map((r) => ({
    dt: r.Report_Date,
    overall: toPct(r.Overall),
    g2: toPct(r["2G"]),
    g3: toPct(r["3G"]),
    g4: toPct(r["4G"]),
  }));

  const latest = rows[rows.length - 1];

  return (
    <div className="w-full h-full flex flex-col">
      <div className="px-3 py-2 border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium">Overall / 2G / 3G / 4G</div>
            <div className="text-xs text-muted-foreground">
              Y-axis fixed: 0–100 • Points {rows.length}
            </div>
          </div>
          <div className="text-xs text-muted-foreground text-right">
            {latest?.Report_Date ? (
              <>
                Latest:{" "}
                <span className="font-medium text-foreground">
                  {latest.Report_Date}
                </span>
              </>
            ) : (
              "—"
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 px-3 py-3">
        {!rows.length ? (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">
            No availability data for this SiteName
          </div>
        ) : (
          <div style={{ height: props.heightPx }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                // extra margins prevent ANY clipping (y label + legend + ticks)
                margin={{ top: 16, right: 22, left: 34, bottom: 42 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />

                <XAxis
                  dataKey="dt"
                  tick={{ fontSize: 12 }}
                  minTickGap={22}
                  tickMargin={8}
                  tickFormatter={fmtDateShort}
                  label={{
                    value: "Date",
                    position: "insideBottom",
                    offset: -24,
                  }}
                />

                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  tickMargin={10}
                  width={54}
                  label={{
                    value: "Availability (%)",
                    angle: -90,
                    position: "insideLeft",
                    offset: -10,
                  }}
                />

                <Tooltip
                  labelFormatter={(v) => `Date: ${String(v)}`}
                  formatter={(value: unknown, name: string) => {
                    const n = Number(value);
                    if (!Number.isFinite(n)) return ["—", name];
                    return [`${n.toFixed(1)}%`, name];
                  }}
                />

                <Legend
                  verticalAlign="bottom"
                  height={30}
                  wrapperStyle={{ paddingTop: 8 }}
                />

                <Line
                  type="monotone"
                  dataKey="overall"
                  name="Overall"
                  dot={false}
                  strokeWidth={2.6}
                />
                <Line
                  type="monotone"
                  dataKey="g2"
                  name="2G"
                  dot={false}
                  strokeWidth={2.2}
                  opacity={0.95}
                />
                <Line
                  type="monotone"
                  dataKey="g3"
                  name="3G"
                  dot={false}
                  strokeWidth={2.2}
                  opacity={0.85}
                />
                <Line
                  type="monotone"
                  dataKey="g4"
                  name="4G"
                  dot={false}
                  strokeWidth={2.2}
                  opacity={0.75}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= Page ================= */
export default function FranchisePage() {
  // Leaflet
  const [L, setLeaflet] = useState<typeof Leaflet | null>(null);
  useEffect(() => {
    let mounted = true;
    import("leaflet").then((mod) => mounted && setLeaflet(mod));
    return () => {
      mounted = false;
    };
  }, []);

  // filters
  const [subregion, setSubregion] = useState<string | null>(null);
  const [grid, setGrid] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [remarksFilter, setRemarksFilter] = useState<string | null>(null);

  // search
  const [siteSearch, setSiteSearch] = useState("");
  const [franchiseSearch, setFranchiseSearch] = useState("");
  const [addressSearch, setAddressSearch] = useState("");

  // picklists
  const [subregions, setSubregions] = useState<string[]>([]);
  const [grids, setGrids] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [remarksList, setRemarksList] = useState<string[]>([]);

  // data
  const [rows, setRows] = useState<FranchiseEnrichedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedRow, setSelectedRow] = useState<FranchiseEnrichedRow | null>(
    null
  );

  // timeseries
  const [ts, setTs] = useState<FranchiseTimeseriesPoint[]>([]);
  const [tsLoading, setTsLoading] = useState(false);
  const [tsErr, setTsErr] = useState<string | null>(null);

  // map refs
  const mapRef = useRef<Leaflet.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Record<number, Leaflet.Marker>>({} as any);

  /* diagnostics */
  const runDiagnostics = useCallback(async (joined: FranchiseEnrichedRow[]) => {
    try {
      const { count: fsCount, error: fsErr } = await supabase
        .from("franchise_summary")
        .select("id", { count: "exact", head: true });
      if (fsErr)
        console.warn("diagnostic: franchise_summary count error", fsErr);

      const coordOk = joined.filter(
        (r) => typeof r.Latitude === "number" && typeof r.Longitude === "number"
      ).length;

      console.log("✅ Franchise Diagnostics");
      console.log("franchise_summary total rows (exact):", fsCount ?? "n/a");
      console.log("RPC joined rows returned:", joined.length);
      console.log("Rows with valid coordinates:", coordOk);
      console.table(joined.slice(0, 5));
    } catch (e) {
      console.warn("diagnostic failed:", e);
    }
  }, []);

  /* fetch enriched */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        const data = await fetchFranchiseEnriched();
        if (!mounted) return;

        setRows(data);

        const subs = Array.from(
          new Set(data.map((x) => x.SubRegion).filter((v): v is string => !!v))
        ).sort();
        const gs = Array.from(
          new Set(data.map((x) => x.Grid).filter((v): v is string => !!v))
        ).sort();
        const ds = Array.from(
          new Set(data.map((x) => x.District).filter((v): v is string => !!v))
        ).sort();
        const rems = Array.from(
          new Set(
            data
              .map((x) => (x.remarks ?? "").trim())
              .filter((s) => s.length > 0)
          )
        ).sort();

        setSubregions(subs);
        setGrids(gs);
        setDistricts(ds);
        setRemarksList(rems);

        setSubregion(subs.includes("North-1") ? "North-1" : subs[0] ?? null);
        setGrid(null);
        setDistrict(null);
        setRemarksFilter(null);
        setSelectedRow(null);

        runDiagnostics(data);
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Failed to load franchise data.";
        setErrorMsg(msg);
        setRows([]);
        console.error("❌ Franchise fetch error:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [runDiagnostics]);

  /* filtered */
  const filtered = useMemo(() => {
    const siteTokens = tokenize(siteSearch);
    const frTokens = tokenize(franchiseSearch);
    const addrTokens = tokenize(addressSearch);

    return rows.filter((r) => {
      const pickOk =
        (!subregion || r.SubRegion === subregion) &&
        (!grid || r.Grid === grid) &&
        (!district || r.District === district) &&
        (!remarksFilter || normRemark(r.remarks) === normRemark(remarksFilter));

      if (!pickOk) return false;

      const hay = [
        r.SiteName ?? "",
        r.franchise_id ?? "",
        r.franchise_name ?? "",
        r.Grid ?? "",
        r.District ?? "",
        r.Address ?? "",
        r.remarks ?? "",
      ].join(" ");

      const siteOk = containsAll(hay, siteTokens);
      const frOk = containsAll(
        [r.franchise_id ?? "", r.franchise_name ?? ""].join(" "),
        frTokens
      );
      const addrOk = containsAll(r.Address ?? "", addrTokens);

      return siteOk && frOk && addrOk;
    });
  }, [
    rows,
    siteSearch,
    franchiseSearch,
    addressSearch,
    subregion,
    grid,
    district,
    remarksFilter,
  ]);

  /* map init */
  useEffect(() => {
    if (!L) return;
    if (!mapContainerRef.current || mapRef.current) return;

    const m = L.map(mapContainerRef.current, {
      center: [33.6844, 73.0479],
      zoom: 6,
      maxZoom: 19,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(m);

    mapRef.current = m;

    return () => {
      m.remove();
      mapRef.current = null;
    };
  }, [L]);

  /* recenter */
  const prevSubregionRef = useRef<string | null>(null);
  useEffect(() => {
    const m = mapRef.current;
    if (!L || !m) return;
    if (prevSubregionRef.current !== subregion) {
      prevSubregionRef.current = subregion ?? null;
      const c = centroid(
        filtered.map((x) => ({ latitude: x.Latitude, longitude: x.Longitude }))
      );
      m.setView([c.lat, c.lon], Math.max(m.getZoom(), 9));
    }
  }, [L, subregion, filtered]);

  /* zoom + select */
  const zoomToRow = useCallback(
    (row: FranchiseEnrichedRow, minZoom = 15) => {
      const m = mapRef.current;
      if (
        !L ||
        !m ||
        typeof row.Latitude !== "number" ||
        typeof row.Longitude !== "number"
      )
        return;

      const targetZoom = Math.max(m.getZoom(), minZoom);
      m.flyTo([row.Latitude, row.Longitude], Math.min(19, targetZoom), {
        duration: 0.5,
      });

      Object.entries(markersRef.current).forEach(([id, mk]) => {
        if (Number(id) === row.id) mk.openPopup();
        else mk.closePopup();
      });
    },
    [L]
  );

  const onRowSelect = useCallback(
    (row: FranchiseEnrichedRow) => {
      setSelectedRow(row);
      zoomToRow(row, 15);
    },
    [zoomToRow]
  );

  /* render markers */
  useEffect(() => {
    const map = mapRef.current;
    if (!L || !map) return;

    Object.values(markersRef.current).forEach((mk) => mk.remove());
    markersRef.current = {} as any;

    const mRows = filtered.filter(
      (r) => typeof r.Latitude === "number" && typeof r.Longitude === "number"
    );

    mRows.forEach((r) => {
      const isSel = selectedRow?.id === r.id;
      const base = remarkColor(r.remarks);
      const color = isSel ? "#2563eb" : base;

      const mk = L.marker([r.Latitude!, r.Longitude!], {
        icon: L.divIcon({
          className: "custom-marker",
          html: `<div style="
              width:${isSel ? 18 : 12}px;
              height:${isSel ? 18 : 12}px;
              background:${color};
              border:2px solid #fff;
              border-radius:9999px;
              box-shadow:0 1px 3px rgba(0,0,0,.25);
            "></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      }).addTo(map);

      mk.bindPopup(
        `<div style="font-size:12px;line-height:1.25;max-width:360px">
          <div><strong>${
            r.franchise_name ?? r.franchise_id ?? "Franchise"
          }</strong></div>
          <div>Site: <strong>${r.SiteName ?? "—"}</strong></div>
          <div>Remark: ${r.remarks ?? "—"}</div>
          <div>District: ${r.District ?? "—"}</div>
          <div>Grid: ${r.Grid ?? "—"}</div>
          <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${
            r.Address ?? "—"
          }</div>
        </div>`,
        { closeButton: true, autoClose: false, closeOnClick: false }
      );

      mk.on("mouseover", () => mk.openPopup());
      mk.on("mouseout", () => {
        if (selectedRow?.id !== r.id) mk.closePopup();
      });
      mk.on("click", () => onRowSelect(r));

      markersRef.current[r.id] = mk;
    });

    if (!mRows.length) {
      map.setView([33.6844, 73.0479], Math.max(map.getZoom(), 6));
    } else if (!selectedRow) {
      const c = centroid(
        mRows.map((x) => ({ latitude: x.Latitude, longitude: x.Longitude }))
      );
      map.setView([c.lat, c.lon], Math.max(map.getZoom(), 8));
    }
  }, [L, filtered, selectedRow, onRowSelect]);

  /* fetch timeseries for selected SiteName */
  useEffect(() => {
    let mounted = true;
    (async () => {
      const sn = String(selectedRow?.SiteName ?? "").trim();
      if (!sn) {
        if (mounted) {
          setTs([]);
          setTsErr(null);
          setTsLoading(false);
        }
        return;
      }

      setTsLoading(true);
      setTsErr(null);

      try {
        const data = await fetchFranchiseTimeseries60d(sn);
        if (!mounted) return;
        setTs(data ?? []);
      } catch (e: unknown) {
        if (!mounted) return;
        setTs([]);
        setTsErr(e instanceof Error ? e.message : "Failed to load timeseries.");
      } finally {
        if (mounted) setTsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedRow?.SiteName]);

  return (
    <div className="p-3 space-y-3">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 relative z-[50]">
        <Card className="md:col-span-12">
          <CardContent className="p-3 grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-3">
              <div className="text-xs mb-1">SubRegion</div>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={subregion ?? ""}
                onChange={(e) => {
                  const v = e.target.value || "";
                  setSubregion(v || null);
                  setGrid(null);
                  setDistrict(null);
                  setSelectedRow(null);
                }}
              >
                <option value="">All</option>
                {subregions.map((s: string) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <div className="text-xs mb-1">Grid</div>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={grid ?? ""}
                onChange={(e) => {
                  const v = e.target.value || "";
                  setGrid(v || null);
                  setDistrict(null);
                  setSelectedRow(null);
                }}
              >
                <option value="">All</option>
                {grids.map((g: string) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <div className="text-xs mb-1">District</div>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={district ?? ""}
                onChange={(e) => {
                  const v = e.target.value || "";
                  setDistrict(v || null);
                  setSelectedRow(null);
                }}
              >
                <option value="">All</option>
                {districts.map((d: string) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <div className="text-xs mb-1">Remarks</div>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={remarksFilter ?? ""}
                onChange={(e) => {
                  const v = (e.target.value || "").trim();
                  setRemarksFilter(v ? v : null);
                  setSelectedRow(null);
                }}
              >
                <option value="">All</option>
                {remarksList.map((r: string) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4">
              <div className="text-xs mb-1">SiteName (approx)</div>
              <Input
                value={siteSearch}
                onChange={(e) => setSiteSearch(e.target.value)}
              />
            </div>

            <div className="md:col-span-4">
              <div className="text-xs mb-1">Franchise (approx)</div>
              <Input
                value={franchiseSearch}
                onChange={(e) => setFranchiseSearch(e.target.value)}
              />
            </div>

            <div className="md:col-span-4">
              <div className="text-xs mb-1">Address (approx)</div>
              <Input
                value={addressSearch}
                onChange={(e) => setAddressSearch(e.target.value)}
              />
            </div>

            <div className="md:col-span-8 flex items-center gap-2">
              <div className="text-xs text-muted-foreground">
                Showing{" "}
                <span className="font-medium text-foreground">
                  {filtered.length.toLocaleString()}
                </span>{" "}
                rows
              </div>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {errorMsg && (
                <div className="text-xs text-rose-600">{errorMsg}</div>
              )}
            </div>

            <div className="md:col-span-4 flex items-end justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setGrid(null);
                  setDistrict(null);
                  setRemarksFilter(null);
                  setSiteSearch("");
                  setFranchiseSearch("");
                  setAddressSearch("");
                  setSelectedRow(null);
                }}
              >
                Clear
              </Button>

              <Button variant="outline" onClick={() => runDiagnostics(rows)}>
                Console Diagnostics
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== 3 visuals in ONE ROW: Table | Map | Chart ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
        {/* TABLE */}
        <Card className="xl:col-span-4 h-[560px] overflow-hidden">
          <CardContent className="p-0 h-full flex flex-col">
            <div className="px-3 py-2 flex items-center justify-between border-b">
              <div className="font-medium">
                Franchise ↔ Site Mapping{" "}
                <span className="text-muted-foreground">
                  ({filtered.length.toLocaleString()} rows)
                </span>
              </div>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>

            <div className="px-3 py-2 border-b flex items-center gap-2">
              <Input
                className="h-8 max-w-xs text-sm"
                placeholder="Select a row…"
                value={
                  selectedRow
                    ? `${
                        selectedRow.franchise_name ??
                        selectedRow.franchise_id ??
                        "Franchise"
                      } → ${selectedRow.SiteName ?? "—"}`
                    : ""
                }
                readOnly
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!selectedRow?.SiteName}
                onClick={() => {
                  if (!selectedRow?.SiteName) return;
                  window.open(
                    `/sitequery/${encodeURIComponent(selectedRow.SiteName)}`,
                    "_blank"
                  );
                }}
              >
                Goto Site Analytics
              </Button>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-2">Franchise</th>
                    <th className="text-left p-2">SiteName</th>
                    <th className="text-left p-2">District</th>
                    <th className="text-left p-2">Grid</th>
                    <th className="text-left p-2">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r: FranchiseEnrichedRow) => {
                    const isSel = selectedRow?.id === r.id;
                    const dotColor = isSel ? "#2563eb" : remarkColor(r.remarks);

                    return (
                      <tr
                        key={r.id}
                        className={`border-b hover:bg-accent cursor-pointer ${
                          isSel ? "bg-accent/50" : ""
                        }`}
                        onClick={() => onRowSelect(r)}
                      >
                        <td className="p-2 font-medium">
                          <span
                            style={{ color: dotColor, marginRight: 6 }}
                            aria-hidden
                          >
                            ●
                          </span>
                          {r.franchise_name ?? r.franchise_id ?? "—"}
                        </td>
                        <td className="p-2">{r.SiteName ?? "—"}</td>
                        <td className="p-2">{r.District ?? "—"}</td>
                        <td className="p-2">{r.Grid ?? "—"}</td>
                        <td className="p-2">{r.remarks ?? "—"}</td>
                      </tr>
                    );
                  })}

                  {!filtered.length && !loading && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-3 text-center text-muted-foreground"
                      >
                        No rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* MAP */}
        <Card className="xl:col-span-4 h-[560px] relative z-0">
          <CardContent className="p-0 h-full">
            <div
              ref={mapContainerRef}
              className="h-full w-full rounded-xl overflow-hidden z-0"
            />
            {!L && (
              <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
                Loading map…
              </div>
            )}
          </CardContent>
        </Card>

        {/* CHART */}
        <Card className="xl:col-span-4 h-[560px] overflow-hidden">
          <CardContent className="p-0 h-full flex flex-col">
            <div className="px-3 py-2 flex items-center justify-between border-b">
              <div className="font-medium">
                Daily Availability (60 days)
                <span className="text-muted-foreground">
                  {selectedRow?.SiteName ? ` • ${selectedRow.SiteName}` : ""}
                </span>
              </div>
              {tsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>

            {tsErr && (
              <div className="px-3 py-2 text-xs text-rose-600 border-b">
                {tsErr}
              </div>
            )}

            <div className="flex-1">
              {!selectedRow?.SiteName ? (
                <div className="h-full grid place-items-center text-sm text-muted-foreground">
                  Select a row to load the last 60 days trend
                </div>
              ) : (
                // inner chart height tuned so legend + labels never clip
                <AvailabilityChart60d data={ts} heightPx={480} />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

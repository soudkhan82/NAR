// app/franchise/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import supabase from "@/app/config/supabase-config";
import {
  fetchFranchiseEnriched,
  type FranchiseEnrichedRow,
} from "@/app/lib/rpc/franchise";

/* ---------------- helpers ---------------- */
const km = (m: number) => m / 1000;
function distanceMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
) {
  const R = 6371e3,
    toRad = (x: number) => (x * Math.PI) / 180;
  const φ1 = toRad(a.lat),
    φ2 = toRad(b.lat);
  const Δφ = toRad(b.lat - a.lat),
    Δλ = toRad(b.lon - a.lon);
  const s =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
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
const tokenize = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);
const containsAll = (hay: string, tokens: string[]) =>
  tokens.length ? tokens.every((t) => hay.toLowerCase().includes(t)) : true;

function normRemark(v: unknown) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

/* ---------------- remark → color ---------------- */
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

  // neighbors
  const [neighborIds, setNeighborIds] = useState<Set<number>>(new Set());
  const [neighbourRows, setNeighbourRows] = useState<
    { id: number; dkm: number; District: string | null; Grid: string | null }[]
  >([]);

  // map refs
  const mapRef = useRef<Leaflet.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Record<number, Leaflet.Marker>>({} as any);

  /* ---------------- DIAGNOSTIC TEST (counts + samples) ---------------- */
  const runDiagnostics = useCallback(async (joined: FranchiseEnrichedRow[]) => {
    try {
      // total in franchise_summary
      const { count: fsCount, error: fsErr } = await supabase
        .from("franchise_summary")
        .select("id", { count: "exact", head: true });
      if (fsErr)
        console.warn("diagnostic: franchise_summary count error", fsErr);

      // how many joined rows have coords
      const coordOk = joined.filter(
        (r) => typeof r.Latitude === "number" && typeof r.Longitude === "number"
      ).length;

      // how many missing SSL join (no region/subregion etc.)
      const missingSSL = joined.filter(
        (r) =>
          !r.Region &&
          !r.SubRegion &&
          !r.Grid &&
          !r.District &&
          !r.Address &&
          r.SiteName
      ).length;

      // sample rows
      const sample = joined.slice(0, 5);

      console.log("✅ Franchise Diagnostics");
      console.log("franchise_summary total rows (exact):", fsCount ?? "n/a");
      console.log("RPC joined rows returned:", joined.length);
      console.log("Rows with valid coordinates:", coordOk);
      console.log(
        "Rows missing SSL enrichment (likely no match on SiteName):",
        missingSSL
      );
      console.table(sample);
    } catch (e) {
      console.warn("diagnostic failed:", e);
    }
  }, []);

  /* -------------- fetch data via RPC (.ts backend) -------------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        const data = await fetchFranchiseEnriched();
        if (!mounted) return;

        setRows(data);

        // picklists
        const subs = Array.from(
          new Set(data.map((x) => x.SubRegion).filter(Boolean))
        ).sort() as string[];
        const gs = Array.from(
          new Set(data.map((x) => x.Grid).filter(Boolean))
        ).sort() as string[];
        const ds = Array.from(
          new Set(data.map((x) => x.District).filter(Boolean))
        ).sort() as string[];
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

        // run console diagnostic
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

  /* -------------- map init -------------- */
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

  /* -------------- filtered -------------- */
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

  /* -------------- recenter on SubRegion change -------------- */
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

  /* -------------- neighbors -------------- */
  const recomputeNeighbors = useCallback(() => {
    if (
      !selectedRow ||
      typeof selectedRow.Latitude !== "number" ||
      typeof selectedRow.Longitude !== "number"
    ) {
      setNeighborIds(new Set());
      setNeighbourRows([]);
      return;
    }

    const here = { lat: selectedRow.Latitude, lon: selectedRow.Longitude };

    const candidates = filtered
      .filter(
        (p) =>
          p.id !== selectedRow.id &&
          typeof p.Latitude === "number" &&
          typeof p.Longitude === "number"
      )
      .map((p) => ({
        id: p.id,
        dkm: km(distanceMeters(here, { lat: p.Latitude!, lon: p.Longitude! })),
        District: p.District ?? null,
        Grid: p.Grid ?? null,
      }))
      .filter((x) => x.dkm <= 5)
      .sort((a, b) => a.dkm - b.dkm)
      .slice(0, 5);

    setNeighborIds(new Set(candidates.map((c) => c.id)));
    setNeighbourRows(candidates);
  }, [selectedRow, filtered]);

  useEffect(() => {
    recomputeNeighbors();
  }, [recomputeNeighbors]);

  /* -------------- zoom + select -------------- */
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

  /* -------------- render markers -------------- */
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
      const isNei = neighborIds.has(r.id);

      const base = remarkColor(r.remarks);
      const color = isSel ? "#2563eb" : base;
      const ring = isNei
        ? "0 0 0 3px rgba(239,68,68,.45)"
        : "0 1px 3px rgba(0,0,0,.25)";

      const mk = L.marker([r.Latitude!, r.Longitude!], {
        icon: L.divIcon({
          className: "custom-marker",
          html: `<div style="
              width:${isSel ? 18 : 12}px;
              height:${isSel ? 18 : 12}px;
              background:${color};
              border:2px solid #fff;
              border-radius:9999px;
              box-shadow:${ring};
            "></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      }).addTo(map);

      mk.bindPopup(
        `<div style="font-size:12px;line-height:1.25;max-width:320px">
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
  }, [L, filtered, selectedRow, neighborIds, onRowSelect]);

  /* ================= UI ================= */
  return (
    <div className="p-3 space-y-3">
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
                {subregions.map((s) => (
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
                {grids.map((g) => (
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
                {districts.map((d) => (
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
                {remarksList.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4">
              <div className="text-xs mb-1">SiteName (approx)</div>
              <Input
                placeholder="e.g., ABC 123"
                value={siteSearch}
                onChange={(e) => setSiteSearch(e.target.value)}
              />
            </div>

            <div className="md:col-span-4">
              <div className="text-xs mb-1">Franchise (approx)</div>
              <Input
                placeholder="e.g., Saddar"
                value={franchiseSearch}
                onChange={(e) => setFranchiseSearch(e.target.value)}
              />
            </div>

            <div className="md:col-span-4">
              <div className="text-xs mb-1">Address (approx)</div>
              <Input
                placeholder="e.g., Main Rd"
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

              <Button
                variant="outline"
                onClick={() => runDiagnostics(rows)}
                title="Print diagnostic counts in console"
              >
                Console Diagnostics
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-7 h-[560px] relative z-0">
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

        <div className="lg:col-span-5 flex flex-col gap-3">
          <Card className="h-[360px] overflow-hidden">
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
                    const url = `/sitequery/${encodeURIComponent(
                      selectedRow.SiteName
                    )}`;
                    window.open(url, "_blank");
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
                    {filtered.map((r) => {
                      const isSel = selectedRow?.id === r.id;
                      const isNei = neighborIds.has(r.id);
                      const dotColor = isSel
                        ? "#2563eb"
                        : isNei
                        ? "#ef4444"
                        : remarkColor(r.remarks);

                      return (
                        <tr
                          key={r.id}
                          className={`border-b hover:bg-accent cursor-pointer ${
                            isSel ? "bg-accent/50" : ""
                          }`}
                          onClick={() => onRowSelect(r)}
                          title="Click to zoom in"
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

          <Card className="h-[200px] overflow-hidden">
            <CardContent className="p-0 h-full flex flex-col">
              <div className="px-3 py-2 border-b">
                <div className="font-medium">
                  Nearest 05 (within 5 km){" "}
                  {selectedRow?.SiteName ? `of ${selectedRow.SiteName}` : ""}{" "}
                  <span className="text-muted-foreground">
                    ({neighbourRows.length.toLocaleString()} rows)
                  </span>
                </div>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted sticky top-0 z-10">
                    <tr>
                      <th className="text-left p-2">Row</th>
                      <th className="text-left p-2">District</th>
                      <th className="text-left p-2">Grid</th>
                      <th className="text-left p-2">~Dist (km)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRow &&
                      neighbourRows.map((n) => (
                        <tr
                          key={n.id}
                          className="border-b hover:bg-accent cursor-pointer"
                          onClick={() => {
                            const row = filtered.find((x) => x.id === n.id);
                            if (row) onRowSelect(row);
                          }}
                          title="Click to zoom"
                        >
                          <td className="p-2 font-medium">#{n.id}</td>
                          <td className="p-2">{n.District ?? "—"}</td>
                          <td className="p-2">{n.Grid ?? "—"}</td>
                          <td className="p-2">{n.dkm.toFixed(2)}</td>
                        </tr>
                      ))}

                    {selectedRow && !neighbourRows.length && (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-3 text-center text-muted-foreground"
                        >
                          No neighbour found within 5 km
                        </td>
                      </tr>
                    )}
                    {!selectedRow && (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-3 text-center text-muted-foreground"
                        >
                          Select a row to see neighbours
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

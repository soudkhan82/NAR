// app/GIS/GISClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

import {
  fetchMapPointsEnriched,
  fetchSslSubregions,
  fetchSslGrids,
  fetchSslDistricts,
  searchSslSites,
  type MapPointEx,
  type FilterState as AvFilterState,
} from "@/app/lib/rpc/gis/gis_ssl";

/* ---------------- helpers ---------------- */
const km = (m: number) => m / 1000;
function distanceMeters(a:{lat:number;lon:number}, b:{lat:number;lon:number}) {
  const R = 6371e3, toRad = (x:number)=> (x*Math.PI)/180;
  const φ1 = toRad(a.lat), φ2 = toRad(b.lat);
  const Δφ = toRad(b.lat - a.lat), Δλ = toRad(b.lon - a.lon);
  const s = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return 2*R*Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
}
function centroid(points: Array<{ latitude?: number|null; longitude?: number|null }>) {
  const ps = points.filter(p => typeof p.latitude==="number" && typeof p.longitude==="number") as Array<{latitude:number;longitude:number}>;
  if (!ps.length) return { lat: 33.6844, lon: 73.0479 };
  const { sumLat, sumLon } = ps.reduce((acc,p)=>({sumLat:acc.sumLat+p.latitude, sumLon:acc.sumLon+p.longitude}), {sumLat:0,sumLon:0});
  return { lat: sumLat/ps.length, lon: sumLon/ps.length };
}
const tokenize = (q:string)=> q.toLowerCase().split(/\s+/).filter(Boolean);
const containsAll = (hay:string, tokens:string[]) => tokens.length ? tokens.every(t=> hay.toLowerCase().includes(t)) : true;

/* ================= Page (Client) ================= */
export default function GISClient() {
  // lazy-load Leaflet on client
  const [L, setLeaflet] = useState<typeof Leaflet | null>(null);
  useEffect(() => {
    let mounted = true;
    import("leaflet").then((mod) => mounted && setLeaflet(mod));
    return () => { mounted = false; };
  }, []);

  // filters
  const [region] = useState<string | null>(null);
  const [subregion, setSubregion] = useState<string | null>(null);
  const [grid, setGrid] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);

  // search
  const [siteSearch, setSiteSearch] = useState("");
  const [addressSearch, setAddressSearch] = useState("");
  const [siteSuggestions, setSiteSuggestions] = useState<string[]>([]);

  // picklists
  const [subregions, setSubregions] = useState<string[]>([]);
  const [grids, setGrids] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);

  // data
  const [points, setPoints] = useState<MapPointEx[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<MapPointEx | null>(null);

  // neighbors
  const [neighborIds, setNeighborIds] = useState<Set<string>>(new Set());
  const [neighbourRows, setNeighbourRows] = useState<
    { id: string; dkm: number; district: string | null; grid: string | null }[]
  >([]);

  // map refs
  const mapRef = useRef<Leaflet.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Record<string, Leaflet.Marker>>({} as any);

  /* -------------- picklists (RPCs ONLY) -------------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      const subs = await fetchSslSubregions();
      if (!mounted) return;
      setSubregions(subs);
      setSubregion(subs.includes("North-1") ? "North-1" : subs[0] ?? null);
      setGrid(null);
      setDistrict(null);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const g = await fetchSslGrids(subregion ?? null);
      if (!mounted) return;
      setGrids(g);
      setGrid(null);
    })();
    return () => { mounted = false; };
  }, [subregion]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const d = await fetchSslDistricts(subregion ?? null, grid ?? null);
      if (!mounted) return;
      setDistricts(d);
      setDistrict(null);
    })();
    return () => { mounted = false; };
  }, [subregion, grid]);

  /* -------------- data fetch -------------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingPoints(true);
      const filters: AvFilterState = {
        region: region ?? null,
        subregion: subregion ?? null,
        district: district ?? null,
        grid: grid ?? null,
        sitename: null,
      };
      const rows = await fetchMapPointsEnriched(filters);
      if (!mounted) return;
      setPoints(rows ?? []);
      setLoadingPoints(false);
    })();
    return () => { mounted = false; };
  }, [region, subregion, district, grid]);

  /* -------------- map init (after Leaflet is loaded) -------------- */
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

  /* -------------- filtered points -------------- */
  const filteredPoints = useMemo(() => {
    const siteTokens = tokenize(siteSearch);
    const addrTokens = tokenize(addressSearch);
    return points.filter((p) => {
      const siteHay = [
        p.sitename ?? "",
        p.site_id ?? "",
        p.grid ?? "",
        p.district ?? "",
        p.address ?? "",
      ].join(" ");
      const siteOk = containsAll(siteHay, siteTokens);
      const addrOk = containsAll(p.address ?? "", addrTokens);
      const pickOk =
        (!subregion || p.subregion === subregion) &&
        (!grid || p.grid === grid) &&
        (!district || p.district === district);
      return siteOk && addrOk && pickOk;
    });
  }, [points, siteSearch, addressSearch, subregion, grid, district]);

  /* -------------- recenter on SubRegion change -------------- */
  const prevSubregionRef = useRef<string | null>(null);
  useEffect(() => {
    const m = mapRef.current;
    if (!L || !m) return;
    if (prevSubregionRef.current !== subregion) {
      prevSubregionRef.current = subregion ?? null;
      const c = centroid(filteredPoints);
      m.setView([c.lat, c.lon], Math.max(m.getZoom(), 9));
    }
  }, [L, subregion, filteredPoints]);

  /* -------------- neighbors (top 5 within 5km) -------------- */
  const recomputeNeighbors = useCallback((selected: MapPointEx | null, all: MapPointEx[]) => {
    if (!selected || typeof selected.latitude !== "number" || typeof selected.longitude !== "number") {
      setNeighborIds(new Set());
      setNeighbourRows([]);
      return;
    }
    const here = { lat: selected.latitude, lon: selected.longitude };
    const candidates = all
      .filter((p) => p.site_id !== selected.site_id && typeof p.latitude === "number" && typeof p.longitude === "number")
      .map((p) => ({
        id: p.site_id,
        dkm: km(distanceMeters(here, { lat: p.latitude!, lon: p.longitude! })),
        district: p.district ?? null,
        grid: p.grid ?? null,
      }))
      .filter((x) => x.dkm <= 5)
      .sort((a, b) => a.dkm - b.dkm)
      .slice(0, 5);
    setNeighborIds(new Set(candidates.map((c) => c.id)));
    setNeighbourRows(candidates);
  }, []);

  useEffect(() => { recomputeNeighbors(selectedPoint, filteredPoints); },
    [selectedPoint, filteredPoints, recomputeNeighbors]
  );

  /* -------------- zoom + select -------------- */
  const zoomToPoint = useCallback((row: MapPointEx, minZoom = 15) => {
    const m = mapRef.current;
    if (!L || !m || typeof row.latitude !== "number" || typeof row.longitude !== "number") return;
    const targetZoom = Math.max(m.getZoom(), minZoom);
    m.flyTo([row.latitude, row.longitude], Math.min(19, targetZoom), { duration: 0.5 });
    Object.entries(markersRef.current).forEach(([id, mk]) => {
      if (id === row.site_id) mk.openPopup(); else mk.closePopup();
    });
  }, [L]);

  const onRowSelect = useCallback((row: MapPointEx) => {
    setSelectedPoint(row);
    zoomToPoint(row, 15);
  }, [zoomToPoint]);

  /* -------------- render markers -------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!L || !map) return;

    Object.values(markersRef.current).forEach((mk) => mk.remove());
    markersRef.current = {} as any;

    filteredPoints.forEach((p) => {
      if (typeof p.latitude !== "number" || typeof p.longitude !== "number") return;

      const isSel = selectedPoint?.site_id === p.site_id;
      const isNei = neighborIds.has(p.site_id);
      const color = isSel ? "#2563eb" : isNei ? "#ef4444" : "#ec4899";

      const mk = L.marker([p.latitude, p.longitude], {
        icon: L.divIcon({
          className: "custom-marker",
          html: `<div style="width:${isSel ? 18 : 12}px;height:${isSel ? 18 : 12}px;background:${color};border:2px solid #fff;border-radius:9999px;box-shadow:0 1px 3px rgba(0,0,0,.25)"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      }).addTo(map);

      mk.bindPopup(
        `<div style="font-size:12px;line-height:1.25;max-width:280px">
          <div><strong>${p.site_id}</strong></div>
          <div>Class: ${p.site_classification ?? "—"}</div>
          <div>District: ${p.district ?? "—"}</div>
          <div>Grid: ${p.grid ?? "—"}</div>
          <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.address ?? "—"}</div>
        </div>`,
        { closeButton: true, autoClose: false, closeOnClick: false }
      );

      mk.on("mouseover", () => mk.openPopup());
      mk.on("mouseout", () => { if (selectedPoint?.site_id !== p.site_id) mk.closePopup(); });
      mk.on("click", () => onRowSelect(p));

      markersRef.current[p.site_id] = mk;
    });

    if (!filteredPoints.length) {
      map.setView([33.6844, 73.0479], Math.max(map.getZoom(), 6));
    } else if (!selectedPoint) {
      const c = centroid(filteredPoints);
      map.setView([c.lat, c.lon], Math.max(map.getZoom(), 8));
    }
  }, [L, filteredPoints, selectedPoint, neighborIds, onRowSelect]);

  /* -------------- site suggestions -------------- */
  useEffect(() => {
    let mounted = true;
    const t = setTimeout(async () => {
      if (!siteSearch.trim()) {
        if (mounted) setSiteSuggestions([]);
        return;
      }
      const list = await searchSslSites(
        siteSearch.trim(), subregion ?? null, grid ?? null, district ?? null, 15
      );
      if (mounted) setSiteSuggestions(list ?? []);
    }, 250);
    return () => { mounted = false; clearTimeout(t); };
  }, [siteSearch, subregion, grid, district]);

  /* ================= UI ================= */
  return (
    <div className="p-3 space-y-3">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 relative z-[50]">
        <Card className="md:col-span-12">
          <CardContent className="p-3 grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-2">
              <div className="text-xs mb-1">SubRegion</div>
              <Select
                value={subregion ?? ""}
                onValueChange={(v) => {
                  setSubregion(v || null);
                  setGrid(null);
                  setDistrict(null);
                  setSelectedPoint(null);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select SubRegion" />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" sideOffset={6} className="z-[9999]">
                  {subregions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <div className="text-xs mb-1">Grid</div>
              <Select
                value={grid ?? ""}
                onValueChange={(v) => {
                  setGrid(v || null);
                  setDistrict(null);
                  setSelectedPoint(null);
                }}
                disabled={!subregion || grids.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Grid" />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" sideOffset={6} className="z-[9999]">
                  {grids.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <div className="text-xs mb-1">District</div>
              <Select
                value={district ?? ""}
                onValueChange={(v) => {
                  setDistrict(v || null);
                  setSelectedPoint(null);
                }}
                disabled={!subregion || districts.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select District" />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" sideOffset={6} className="z-[9999]">
                  {districts.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3">
              <div className="text-xs mb-1">SiteName (approx)</div>
              <Input
                placeholder="e.g., ABC 123"
                value={siteSearch}
                onChange={(e) => setSiteSearch(e.target.value)}
                list="sitenames"
              />
              <datalist id="sitenames">
                {siteSuggestions.map((s) => (<option key={s} value={s} />))}
              </datalist>
            </div>

            <div className="md:col-span-3">
              <div className="text-xs mb-1">Address (approx)</div>
              <Input
                placeholder="e.g., Main Rd"
                value={addressSearch}
                onChange={(e) => setAddressSearch(e.target.value)}
              />
            </div>

            <div className="md:col-span-12 flex items-end justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => { setSiteSearch(""); setAddressSearch(""); }}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map + Right Column */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Map */}
        <Card className="lg:col-span-7 h-[560px] relative z-0">
          <CardContent className="p-0 h-full">
            <div ref={mapContainerRef} className="h-full w-full rounded-xl overflow-hidden z-0" />
            {!L && (
              <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
                Loading map…
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column: Sites + Neighbours */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Sites table */}
          <Card className="h-[360px] overflow-hidden">
            <CardContent className="p-0 h-full flex flex-col">
              <div className="px-3 py-2 flex items-center justify-between border-b">
                <div className="font-medium">
                  Sites{" "}
                  <span className="text-muted-foreground">
                    ({filteredPoints.length.toLocaleString()} records)
                  </span>
                </div>
                {loadingPoints && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted sticky top-0 z-10">
                    <tr>
                      <th className="text-left p-2">SITE_ID</th>
                      <th className="text-left p-2">District</th>
                      <th className="text-left p-2">Grid</th>
                      <th className="text-left p-2">Class</th>
                      <th className="text-left p-2">Addr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPoints.map((p) => {
                      const isSel = selectedPoint?.site_id === p.site_id;
                      const isNei = neighborIds.has(p.site_id);
                      const dotColor = isSel ? "#2563eb" : isNei ? "#ef4444" : "#ec4899";
                      return (
                        <tr
                          key={p.site_id}
                          className={`border-b hover:bg-accent cursor-pointer ${isSel ? "bg-accent/50" : ""}`}
                          onClick={() => onRowSelect(p)}
                          title="Click to zoom in"
                        >
                          <td className="p-2 font-medium">
                            <span style={{ color: dotColor, marginRight: 6 }} aria-hidden>●</span>
                            {p.site_id}
                          </td>
                          <td className="p-2">{p.district ?? "—"}</td>
                          <td className="p-2">{p.grid ?? "—"}</td>
                          <td className="p-2">{p.site_classification ?? "—"}</td>
                          <td className="p-2">{p.address ?? "—"}</td>
                        </tr>
                      );
                    })}
                    {!filteredPoints.length && !loadingPoints && (
                      <tr>
                        <td colSpan={5} className="p-3 text-center text-muted-foreground">No rows</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Neighbour Sites table */}
          <Card className="h-[200px] overflow-hidden">
            <CardContent className="p-0 h-full flex flex-col">
              <div className="px-3 py-2 border-b">
                <div className="font-medium">
                  Neighbour Sites within 5 km {selectedPoint ? `of ${selectedPoint.site_id}` : ""}{" "}
                  <span className="text-muted-foreground">
                    ({neighbourRows.length.toLocaleString()} records)
                  </span>
                </div>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted sticky top-0 z-10">
                    <tr>
                      <th className="text-left p-2">SITE_ID</th>
                      <th className="text-left p-2">District</th>
                      <th className="text-left p-2">Grid</th>
                      <th className="text-left p-2">~Dist (km)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPoint &&
                      neighbourRows.map((n) => (
                        <tr
                          key={n.id}
                          className="border-b hover:bg-accent cursor-pointer"
                          onClick={() => {
                            const row = filteredPoints.find((p) => p.site_id === n.id);
                            if (row) onRowSelect(row);
                          }}
                          title="Click to zoom"
                        >
                          <td className="p-2 font-medium">{n.id}</td>
                          <td className="p-2">{n.district ?? "—"}</td>
                          <td className="p-2">{n.grid ?? "—"}</td>
                          <td className="p-2">{n.dkm.toFixed(2)}</td>
                        </tr>
                      ))}
                    {selectedPoint && !neighbourRows.length && (
                      <tr>
                        <td colSpan={4} className="p-3 text-center text-muted-foreground">
                          No neighbour found within 5 km
                        </td>
                      </tr>
                    )}
                    {!selectedPoint && (
                      <tr>
                        <td colSpan={4} className="p-3 text-center text-muted-foreground">
                          Select a site to see neighbours
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

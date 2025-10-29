// app/GIS/Availability/page.tsx
"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import maplibregl, { Map as MLMap, Marker, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

import {
  fetchMapPointsEnriched,
  fetchTimeseries,
  fetchSslSubregions,
  fetchSslGrids,
  fetchSslDistricts,
  searchSslSites,
  type MapPointEx,
  type AvPoint,
  type FilterState as AvFilterState,
} from "@/app/lib/rpc/gis/gis_avail";

/* ===== Helpers ===== */
const km = (m: number) => m / 1000;

function distanceMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
) {
  const R = 6371e3;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const φ1 = toRad(a.lat),
    φ2 = toRad(b.lat);
  const Δφ = toRad(b.lat - a.lat);
  const Δλ = toRad(b.lon - a.lon);
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

/** Find the maximum value across v2g/v3g/v4g/overall */
function maxOfSeries(rows: AvPoint[]) {
  let m = Number.NEGATIVE_INFINITY;
  for (const r of rows) {
    if (typeof r.v2g === "number") m = Math.max(m, r.v2g);
    if (typeof r.v3g === "number") m = Math.max(m, r.v3g);
    if (typeof r.v4g === "number") m = Math.max(m, r.v4g);
    if (typeof r.overall === "number") m = Math.max(m, r.overall);
  }
  return m === Number.NEGATIVE_INFINITY ? null : m;
}

/** tokenizers + approx match helpers */
function tokenize(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}
function containsAll(hay: string, tokens: string[]) {
  if (!tokens.length) return true;
  const h = hay.toLowerCase();
  return tokens.every((t) => h.includes(t));
}

/* ===== Page (client) ===== */
export default function Page() {
  // Filters
  const [region] = useState<string | null>(null);
  const [subregion, setSubregion] = useState<string>("North-1"); // default
  const [grid, setGrid] = useState<string>("All");
  const [district, setDistrict] = useState<string>("All");

  // NEW: separate table-only filters
  const [siteSearch, setSiteSearch] = useState<string>("");
  const [addressSearch, setAddressSearch] = useState<string>("");

  const [siteSuggestions, setSiteSuggestions] = useState<string[]>([]);
  const [days, setDays] = useState<number>(30);

  // Picklists
  const [subregions, setSubregions] = useState<string[]>([]);
  const [grids, setGrids] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);

  // Data
  const [points, setPoints] = useState<MapPointEx[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<MapPointEx | null>(null);
  const [neighbours, setNeighbours] = useState<MapPointEx[]>([]);
  const [series, setSeries] = useState<AvPoint[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(false);

  // Map
  const mapRef = useRef<MLMap | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const popupsRef = useRef<Record<string, Popup>>({});
  const prevViewRef = useRef<{ center: [number, number]; zoom: number } | null>(
    null
  );

  // Neighbor/selected marker coloring
  const neighborIds = useMemo(
    () => new Set(neighbours.map((n) => n.site_id)),
    [neighbours]
  );

  /* --- Picklists --- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      const subs = await fetchSslSubregions();
      if (!mounted) return;
      const list = subs.includes("North-1")
        ? ["North-1", ...subs.filter((s) => s !== "North-1")]
        : ["North-1", ...subs];
      setSubregions(list);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const g = await fetchSslGrids(subregion === "All" ? null : subregion);
      if (!mounted) return;
      setGrids(g);
      setGrid("All");
    })();
    return () => {
      mounted = false;
    };
  }, [subregion]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const d = await fetchSslDistricts(
        subregion === "All" ? null : subregion,
        grid === "All" ? null : grid
      );
      if (!mounted) return;
      setDistricts(d);
      setDistrict("All");
    })();
    return () => {
      mounted = false;
    };
  }, [subregion, grid]);

  /* --- Fetch points (no client-side limit to avoid 1000-cap) --- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingPoints(true);
      const filters: AvFilterState = {
        region: region ?? null,
        subregion: subregion === "All" ? null : subregion,
        district: district === "All" ? null : district,
        grid: grid === "All" ? null : grid,
        // keep sitename null so server returns full set; we filter table locally
        sitename: null,
        days,
      };
      const rows = await fetchMapPointsEnriched(filters);
      if (!mounted) return;
      setPoints(rows ?? []);
      setLoadingPoints(false);
    })();
    return () => {
      mounted = false;
    };
  }, [region, subregion, district, grid, days]);

  /* --- Map init --- */
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const m = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [73.0479, 33.6844],
      zoom: 5,
      attributionControl: { compact: true },
    });
    mapRef.current = m;

    m.on("load", () => {
      prevViewRef.current = {
        center: m.getCenter().toArray() as [number, number],
        zoom: m.getZoom(),
      };
    });

    // double-click anywhere to go back to previous view
    m.on("dblclick", () => {
      const prev = prevViewRef.current;
      if (prev)
        m.flyTo({ center: prev.center, zoom: prev.zoom, duration: 600 });
    });
  }, []);

  /* --- Markers + popups (incl. hover) --- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // clear
    Object.values(markersRef.current).forEach((mk) => mk.remove());
    Object.values(popupsRef.current).forEach((pp) => pp.remove());
    markersRef.current = {};
    popupsRef.current = {};

    points.forEach((p) => {
      if (typeof p.latitude !== "number" || typeof p.longitude !== "number")
        return;

      // Colors:
      // - selected: blue
      // - neighbour: red
      // - default: gray
      let fill = "#64748b"; // default
      if (selectedPoint?.site_id === p.site_id) fill = "#2563eb"; // blue
      else if (neighborIds.has(p.site_id)) fill = "#ef4444"; // red

      const el = document.createElement("div");
      el.className = "rounded-full border border-white shadow-md";
      el.style.width = selectedPoint?.site_id === p.site_id ? "16px" : "12px";
      el.style.height = selectedPoint?.site_id === p.site_id ? "16px" : "12px";
      el.style.background = fill;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([p.longitude, p.latitude])
        .addTo(map);

      const popup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: false, // keep hover popup independent of map clicks
        offset: 10,
      }).setHTML(
        `
        <div style="font-size:12px;line-height:1.25;max-width:280px">
          <div><strong>${p.site_id}</strong></div>
          <div>Class: ${p.site_classification ?? "—"}</div>
          <div>District: ${p.district ?? "—"}</div>
          <div>Grid: ${p.grid ?? "—"}</div>
          <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${
            p.address ?? "—"
          }</div>
        </div>
        `
      );

      // hover: show/remove popup
      el.addEventListener("mouseenter", () => {
        popup.setLngLat([p.longitude, p.latitude]).addTo(map);
      });
      el.addEventListener("mouseleave", () => {
        popup.remove();
      });

      // click: select + zoom + keep popup open
      el.addEventListener("click", () => {
        onRowSelect(p);
        popup.setLngLat([p.longitude, p.latitude]).addTo(map);
      });

      markersRef.current[p.site_id] = marker;
      popupsRef.current[p.site_id] = popup;
    });

    // fly to centroid of the current set
    const ctr = centroid(points);
    prevViewRef.current = {
      center: map.getCenter().toArray() as [number, number],
      zoom: map.getZoom(),
    };
    map.flyTo({
      center: [ctr.lon, ctr.lat],
      zoom: points.length > 50 ? 8 : points.length > 10 ? 10 : 11,
      duration: 700,
    });
  }, [points, selectedPoint, neighborIds]);

  /* --- Filter centroid fly --- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const bySub =
      subregion === "All"
        ? points
        : points.filter((p) => p.subregion === subregion);
    const byGrid =
      grid === "All" ? bySub : bySub.filter((p) => p.grid === grid);
    const byDist =
      district === "All"
        ? byGrid
        : byGrid.filter((p) => p.district === district);

    const subset = byDist.length ? byDist : points;
    const ctr = centroid(subset);
    prevViewRef.current = {
      center: map.getCenter().toArray() as [number, number],
      zoom: map.getZoom(),
    };
    map.flyTo({
      center: [ctr.lon, ctr.lat],
      zoom: subset.length ? 11 : 9,
      duration: 600,
    });
  }, [subregion, grid, district, points]);

  /* --- Neighbours --- */
  const recomputeNeighbours = useCallback(
    (selected: MapPointEx | null, all: MapPointEx[]) => {
      if (
        !selected ||
        typeof selected.latitude !== "number" ||
        typeof selected.longitude !== "number"
      ) {
        setNeighbours([]);
        return;
      }
      const here = { lat: selected.latitude, lon: selected.longitude };
      const ns = all
        .filter(
          (p) =>
            p.site_id !== selected.site_id &&
            typeof p.latitude === "number" &&
            typeof p.longitude === "number" &&
            km(distanceMeters(here, { lat: p.latitude!, lon: p.longitude! })) <=
              5
        )
        .slice(0, 2000); // generous UI cap; no server cap
      setNeighbours(ns);
    },
    []
  );

  /* --- Row select / double click --- */
  const onRowSelect = useCallback(
    async (row: MapPointEx) => {
      setSelectedPoint(row);
      const map = mapRef.current;
      if (
        map &&
        typeof row.latitude === "number" &&
        typeof row.longitude === "number"
      ) {
        prevViewRef.current = {
          center: map.getCenter().toArray() as [number, number],
          zoom: map.getZoom(),
        };
        map.flyTo({
          center: [row.longitude, row.latitude],
          zoom: 13,
          duration: 600,
        });
        const pp = popupsRef.current[row.site_id];
        if (pp) pp.setLngLat([row.longitude, row.latitude]).addTo(map);
      }

      setSeriesLoading(true);
      try {
        const ts = await fetchTimeseries(row.site_id, days);
        setSeries(ts ?? []);
      } finally {
        setSeriesLoading(false);
      }

      recomputeNeighbours(row, points);
    },
    [days, points, recomputeNeighbours]
  );

  const onRowDoubleClick = useCallback(() => {
    const map = mapRef.current;
    const prev = prevViewRef.current;
    if (map && prev)
      map.flyTo({ center: prev.center, zoom: prev.zoom, duration: 600 });
  }, []);

  /* --- SiteName suggestions (server-side search for hints only) --- */
  useEffect(() => {
    let mounted = true;
    const handle = setTimeout(async () => {
      if (!siteSearch.trim()) {
        if (mounted) setSiteSuggestions([]);
        return;
      }
      const list = await searchSslSites(
        siteSearch.trim(),
        subregion === "All" ? null : subregion,
        grid === "All" ? null : grid,
        district === "All" ? null : district,
        15
      );
      if (mounted) setSiteSuggestions(list ?? []);
    }, 250);
    return () => {
      mounted = false;
      clearTimeout(handle);
    };
  }, [siteSearch, subregion, grid, district]);

  /* ---- Chart scale/format: fraction (0–1) vs percent (0–100) ---- */
  const isFractionScale = useMemo(() => {
    const m = maxOfSeries(series);
    if (m === null) return false; // empty -> use 25–100% display
    return m <= 1.0000001;
  }, [series]);

  const yDomain = isFractionScale
    ? ([0, 1] as [number, number])
    : ([25, 100] as [number, number]);

  const fmtTick = (v: number) =>
    isFractionScale ? `${(v * 100).toFixed(1)}%` : `${v.toFixed(1)}%`;

  const fmtTip = (v: number) =>
    isFractionScale ? `${(v * 100).toFixed(2)}%` : `${v.toFixed(2)}%`;

  /* ---- Table rows filtered by approx SiteName AND approx Address ---- */
  const filteredPoints = useMemo(() => {
    const siteTokens = tokenize(siteSearch);
    const addrTokens = tokenize(addressSearch);

    return points.filter((p) => {
      // Site-name-like fuzzy across multiple fields
      const siteHay = [
        p.sitename ?? "",
        p.site_id ?? "",
        p.grid ?? "",
        p.district ?? "",
        p.address ?? "",
      ].join(" ");
      const siteOk = containsAll(siteHay, siteTokens);

      // Address-only fuzzy (when provided)
      const addrHay = p.address ?? "";
      const addrOk = containsAll(addrHay, addrTokens);

      return siteOk && addrOk;
    });
  }, [points, siteSearch, addressSearch]);

  /* ===== UI ===== */
  return (
    <div className="p-3 space-y-3">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
        <Card className="md:col-span-12">
          <CardContent className="p-3 grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-2">
              <div className="text-xs mb-1">SubRegion</div>
              <Select
                value={subregion}
                onValueChange={(v) => {
                  setSubregion(v);
                  setGrid("All");
                  setDistrict("All");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select SubRegion" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="North-1">North-1</SelectItem>
                  <SelectItem value="All">All</SelectItem>
                  {subregions
                    .filter((s) => s !== "North-1")
                    .map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <div className="text-xs mb-1">Grid</div>
              <Select value={grid} onValueChange={setGrid}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Grid" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {grids.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <div className="text-xs mb-1">District</div>
              <Select value={district} onValueChange={setDistrict}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select District" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {districts.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* SiteName approx (table-only) */}
            <div className="md:col-span-2">
              <div className="text-xs mb-1">SiteName (approx match)</div>
              <Input
                placeholder="e.g., ABC 123"
                value={siteSearch}
                onChange={(e) => setSiteSearch(e.target.value)}
                list="sitenames"
              />
              <datalist id="sitenames">
                {siteSuggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            {/* NEW: Address approx (table-only) */}
            <div className="md:col-span-2">
              <div className="text-xs mb-1">Address (approx match)</div>
              <Input
                placeholder="e.g., Main Rd Gulshan"
                value={addressSearch}
                onChange={(e) => setAddressSearch(e.target.value)}
              />
            </div>

            <div className="md:col-span-1">
              <div className="text-xs mb-1">Days</div>
              <Input
                type="number"
                min={7}
                max={365}
                value={days}
                onChange={(e) =>
                  setDays(
                    Math.max(7, Math.min(365, Number(e.target.value) || 30))
                  )
                }
              />
            </div>

            <div className="md:col-span-1 flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSiteSearch("");
                  setAddressSearch("");
                }}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map + Sites table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-7 h-[560px]">
          <CardContent className="p-0 h-full">
            <div
              ref={mapContainerRef}
              className="h-full w-full rounded-xl overflow-hidden"
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-5 h-[560px] overflow-hidden">
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
                    <th className="text-left p-2">SiteClassification</th>
                    <th className="text-left p-2">Address</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPoints.map((p) => (
                    <tr
                      key={p.site_id}
                      className={`border-b hover:bg-accent cursor-pointer ${
                        selectedPoint?.site_id === p.site_id
                          ? "bg-accent/50"
                          : ""
                      }`}
                      onClick={() => onRowSelect(p)}
                      onDoubleClick={onRowDoubleClick}
                      title="Click to zoom; double-click to go back"
                    >
                      <td className="p-2 font-medium">{p.site_id}</td>
                      <td className="p-2">{p.district ?? "—"}</td>
                      <td className="p-2">{p.grid ?? "—"}</td>
                      <td className="p-2">{p.site_classification ?? "—"}</td>
                      <td className="p-2">{p.address ?? "—"}</td>
                    </tr>
                  ))}
                  {!filteredPoints.length && !loadingPoints && (
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
      </div>

      {/* Chart + Neighbours */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-7 h-[360px]">
          <CardContent className="p-3 h-full flex flex-col">
            <div className="flex items-center justify-between">
              <div className="font-medium">
                {selectedPoint ? `KPIs: ${selectedPoint.site_id}` : "KPIs"}
              </div>
              {seriesLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dt" tick={{ fontSize: 12 }} minTickGap={24} />
                  <YAxis
                    domain={isFractionScale ? [0, 1] : [25, 100]}
                    tickFormatter={(v) =>
                      isFractionScale
                        ? `${(v * 100).toFixed(1)}%`
                        : `${v.toFixed(1)}%`
                    }
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(val: any) =>
                      typeof val === "number"
                        ? isFractionScale
                          ? `${(val * 100).toFixed(2)}%`
                          : `${val.toFixed(2)}%`
                        : val
                    }
                    labelFormatter={(l) => new Date(l).toLocaleDateString()}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="v2g"
                    name="2G"
                    stroke="#0ea5e9"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="v3g"
                    name="3G"
                    stroke="#10b981"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="v4g"
                    name="4G"
                    stroke="#f59e0b"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5 h-[360px] overflow-hidden">
          <CardContent className="p-0 h-full flex flex-col">
            <div className="px-3 py-2 border-b">
              <div className="font-medium">
                Neighbour Sites within 5 km{" "}
                {selectedPoint ? `of ${selectedPoint.site_id}` : ""}{" "}
                <span className="text-muted-foreground">
                  ({neighbours.length.toLocaleString()} records)
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
                    neighbours.map((n) => {
                      const d =
                        typeof selectedPoint.latitude === "number" &&
                        typeof selectedPoint.longitude === "number" &&
                        typeof n.latitude === "number" &&
                        typeof n.longitude === "number"
                          ? km(
                              distanceMeters(
                                {
                                  lat: selectedPoint.latitude,
                                  lon: selectedPoint.longitude,
                                },
                                { lat: n.latitude, lon: n.longitude }
                              )
                            )
                          : null;
                      return (
                        <tr
                          key={n.site_id}
                          className="border-b hover:bg-accent cursor-pointer"
                          onClick={() => onRowSelect(n)}
                          title="Click to zoom"
                        >
                          <td className="p-2 font-medium">{n.site_id}</td>
                          <td className="p-2">{n.district ?? "—"}</td>
                          <td className="p-2">{n.grid ?? "—"}</td>
                          <td className="p-2">
                            {d !== null ? d.toFixed(2) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  {selectedPoint && !neighbours.length && (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-3 text-center text-muted-foreground"
                      >
                        No neighbour found within 5 km
                      </td>
                    </tr>
                  )}
                  {!selectedPoint && (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-3 text-center text-muted-foreground"
                      >
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
  );
}

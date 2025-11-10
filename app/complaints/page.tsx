"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import maplibregl, {
  Map as MLMap,
  Marker,
  Popup,
  type StyleSpecification,
  type RasterLayerSpecification,
  type RasterSourceSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import {
  fetchRegions,
  fetchSubregions,
  fetchDistricts,
  fetchGrids,
  fetchSitesAgg,
  fetchTimeseries,
  fetchServiceBadges,
  fetchNeighbors,
  type SiteAggRow as RpcSiteAggRow,
  type TsRow,
  type ServiceBadgeRow,
  type NeighborRow as RpcNeighborRow,
} from "@/app/lib/rpc/complaints";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

/* ================= Types (aligned with RPC outputs) ================= */
type SiteAggRow = RpcSiteAggRow;
type NeighborRow = RpcNeighborRow;

/* ================= Helpers ================= */
const POPUP_WIDTH = 380; // click-popup width
const POPUP_MAX_HEIGHT = 420; // click-popup max height
const CHART_HEIGHT = 200;

const fmtN = (n: number | null | undefined) =>
  typeof n === "number" ? n.toLocaleString() : "—";

const toBigint = (siteNameText: string): number | null => {
  const n = Number(siteNameText);
  return Number.isFinite(n) ? n : null;
};

const norm = (s: unknown) =>
  (
    String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "") as string
  ).trim();

type MarkerRec = { siteName: string; marker: Marker };

/** Threshold colors */
const complaintsColor = (count: number | null | undefined): string => {
  const v = typeof count === "number" ? count : 0;
  if (v > 40) return "rgba(220, 38, 38, 0.9)"; // red
  if (v >= 20) return "rgba(249, 115, 22, 0.9)"; // orange
  return "rgba(234, 179, 8, 0.9)"; // yellow
};

export default function ComplaintsGeoPage() {
  /** Filters */
  const [region, setRegion] = useState<string>("South");
  const [subRegion, setSubRegion] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [grid, setGrid] = useState<string | null>(null);

  /** Picklists */
  const [regions, setRegions] = useState<string[]>([]);
  const [subRegions, setSubRegions] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [grids, setGrids] = useState<string[]>([]);

  /** Data */
  const [sites, setSites] = useState<SiteAggRow[]>([]);
  const [neighbors, setNeighbors] = useState<NeighborRow[]>([]);

  /** Selection details */
  const [selectedSite, setSelectedSite] = useState<SiteAggRow | null>(null);
  const [ts, setTs] = useState<TsRow[]>([]);
  const [badges, setBadges] = useState<ServiceBadgeRow[]>([]);

  /** Map refs */
  const mapRef = useRef<MLMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<MarkerRec[]>([]);
  const popupRef = useRef<Popup | null>(null); // click popup
  const hoverPopupRef = useRef<Popup | null>(null); // hover popup

  /* ---------------- Map init (Dark basemap + zoom controls) ---------------- */
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const style: StyleSpecification = {
      version: 8,
      name: "Blank",
      sources: {},
      layers: [],
    };

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [67.0011, 24.8607],
      zoom: 4.8,
    });

    // Zoom +/- controls
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );

    map.on("load", () => {
      // Carto Dark Matter tiles
      const darkSource: RasterSourceSpecification = {
        type: "raster",
        tiles: [
          "https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
          "https://cartodb-basemaps-b.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
          "https://cartodb-basemaps-c.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
          "https://cartodb-basemaps-d.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors © CARTO",
      };
      map.addSource("dark", darkSource);

      const darkLayer: RasterLayerSpecification = {
        id: "dark-raster",
        type: "raster",
        source: "dark",
      };
      map.addLayer(darkLayer);
    });

    // Remove hover popup while panning/zooming
    map.on("movestart", () => {
      hoverPopupRef.current?.remove();
      hoverPopupRef.current = null;
    });

    mapRef.current = map;
  }, []);

  /* ---------------- Load picklists ---------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetchRegions();
        if (!alive) return;
        setRegions(r);
      } catch (e) {
        console.error("fetchRegions error", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setSubRegion(null);
    setDistrict(null);
    setGrid(null);
    (async () => {
      try {
        const sr = await fetchSubregions(region ?? null);
        if (!alive) return;
        setSubRegions(sr);
      } catch (e) {
        console.error("fetchSubregions error", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [region]);

  useEffect(() => {
    let alive = true;
    setDistrict(null);
    setGrid(null);
    (async () => {
      try {
        const d = await fetchDistricts(region ?? null, subRegion ?? null);
        if (!alive) return;
        setDistricts(d);
      } catch (e) {
        console.error("fetchDistricts error", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [region, subRegion]);

  useEffect(() => {
    let alive = true;
    setGrid(null);
    (async () => {
      try {
        const g = await fetchGrids(
          region ?? null,
          subRegion ?? null,
          district ?? null
        );
        if (!alive) return;
        setGrids(g);
      } catch (e) {
        console.error("fetchGrids error", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [region, subRegion, district]);

  /* ---------------- Build markers (hover+click, threshold colors) ---------------- */
  const rebuildMarkers = useCallback((rows: SiteAggRow[]) => {
    // clear old
    markersRef.current.forEach((m) => m.marker.remove());
    markersRef.current = [];
    if (!mapRef.current) return;

    // scale 6..28 px by complaints_count
    const vals = rows.map((r) => r.complaints_count);
    const minV = vals.length ? Math.min(...vals) : 0;
    const maxV = vals.length ? Math.max(...vals) : 1;
    const scale = (v: number) => {
      const t = maxV === minV ? 1 : (v - minV) / (maxV - minV);
      return 6 + t * 22;
    };

    rows.forEach((r) => {
      if (typeof r.Longitude !== "number" || typeof r.Latitude !== "number")
        return;

      const el = document.createElement("div");
      const px = scale(r.complaints_count);
      el.style.width = `${px}px`;
      el.style.height = `${px}px`;
      el.style.borderRadius = "9999px";
      const baseCol = complaintsColor(r.complaints_count);
      el.style.background = baseCol;
      (el as any).dataset.baseColor = baseCol;
      el.style.border = "2px solid #fff";
      el.style.cursor = "pointer";
      el.title = `${r.SiteName} • ${fmtN(r.complaints_count)} complaints`;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([r.Longitude, r.Latitude])
        .addTo(mapRef.current as MLMap);

      // Hover popup (aligned to RIGHT of point)
      const onEnter = () => {
        hoverPopupRef.current?.remove();
        const html = `
          <div style="font-size:12px; line-height:1.25">
            <div><strong>Site:</strong> ${r.SiteName}</div>
            <div><strong>Grid:</strong> ${r.Grid ?? "—"}</div>
            <div><strong>District:</strong> ${r.District ?? "—"}</div>
            <div><strong>Complaints:</strong> ${fmtN(r.complaints_count)}</div>
          </div>
        `;
        const p = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          anchor: "left", // popup appears on the RIGHT side
          offset: [12, 0], // push a bit further right
          maxWidth: `${POPUP_WIDTH}px`,
        })
          .setLngLat([r.Longitude as number, r.Latitude as number])
          .setHTML(html)
          .addTo(mapRef.current as MLMap);

        p.getElement().style.zIndex = "60"; // above tables
        hoverPopupRef.current = p;
      };
      const onLeave = () => {
        hoverPopupRef.current?.remove();
        hoverPopupRef.current = null;
      };
      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mouseleave", onLeave);

      // Click details
      el.addEventListener("click", () => void handleSelectSite(r));

      markersRef.current.push({ siteName: r.SiteName, marker });
    });
  }, []);

  /* ---------------- Load sites + centroid zoom ---------------- */
  const loadSites = useCallback(async () => {
    try {
      const rows = await fetchSitesAgg({
        region: region ?? null,
        subregion: subRegion ?? null,
        district: district ?? null,
        grid: grid ?? null,
        limit: 1000,
      });

      rows.sort(
        (a, b) => (b.complaints_count ?? 0) - (a.complaints_count ?? 0)
      );
      setSites(rows);

      if (mapRef.current && rows.length) {
        const pts = rows.filter(
          (d) =>
            typeof d.Longitude === "number" && typeof d.Latitude === "number"
        );
        if (pts.length) {
          const lon =
            pts.reduce((a, b) => a + (b.Longitude ?? 0), 0) / pts.length;
          const lat =
            pts.reduce((a, b) => a + (b.Latitude ?? 0), 0) / pts.length;
          mapRef.current.easeTo({
            center: [lon, lat],
            zoom: 7.5,
            duration: 500,
          });
        }
      }
      rebuildMarkers(rows);
    } catch (e) {
      console.error("loadSites error", e);
    }
  }, [region, subRegion, district, grid, rebuildMarkers]);

  useEffect(() => {
    if (!mapRef.current) return;
    void loadSites();
  }, [loadSites]);

  /* ---------------- Selection: recolor, popup, zoom ---------------- */
  const colorizeMarkers = useCallback(
    (selectedName: string, neighborNames: Set<string>) => {
      markersRef.current.forEach((rec) => {
        const el = rec.marker.getElement() as HTMLDivElement & {
          dataset: { baseColor?: string };
        };
        if (rec.siteName === selectedName) {
          el.style.background = "rgba(37, 99, 235, 0.9)"; // blue selected
        } else if (neighborNames.has(rec.siteName)) {
          el.style.background = "rgba(220, 38, 38, 0.9)"; // red neighbors
        } else {
          el.style.background = el.dataset.baseColor ?? "rgba(0,0,0,0.6)";
        }
      });
    },
    []
  );

  const fitToSelectedAndNeighbors = useCallback(
    (sel: SiteAggRow, nb: NeighborRow[]) => {
      if (!mapRef.current) return;
      if (typeof sel.Longitude !== "number" || typeof sel.Latitude !== "number")
        return;
      const coords: Array<[number, number]> = [[sel.Longitude, sel.Latitude]];
      nb.forEach((n) => {
        const lon = n.Longitude;
        const lat = n.Latitude;
        if (typeof lon === "number" && typeof lat === "number")
          coords.push([lon, lat]);
      });
      if (coords.length > 1) {
        const lons = coords.map((c) => c[0]);
        const lats = coords.map((c) => c[1]);
        mapRef.current.fitBounds(
          [
            [Math.min(...lons), Math.min(...lats)],
            [Math.max(...lons), Math.max(...lats)],
          ],
          { padding: 60, duration: 500 }
        );
      } else {
        mapRef.current.easeTo({ center: coords[0], zoom: 12, duration: 500 });
      }
    },
    []
  );

  const renderPopupContent = useCallback(async (site: SiteAggRow) => {
    const id = `site-${site.SiteName}`;
    const wrap = document.createElement("div");
    wrap.style.width = `${POPUP_WIDTH}px`;
    wrap.style.maxHeight = `${POPUP_MAX_HEIGHT}px`;
    wrap.style.overflowY = "auto";
    wrap.style.overflowX = "hidden";
    wrap.innerHTML = `
      <div style="font-size:12px; line-height:1.25">
        <div style="margin-bottom:8px">
          <div style="font-weight:600; font-size:14px">${site.SiteName}</div>
          <div><strong>Region:</strong> ${site.Region ?? "—"}</div>
          <div><strong>SubRegion:</strong> ${site.SubRegion ?? "—"}</div>
          <div><strong>District:</strong> ${site.District ?? "—"}</div>
          <div><strong>Grid:</strong> ${site.Grid ?? "—"}</div>
          <div><strong>Address:</strong> ${site.Address ?? "—"}</div>
          <div><strong>Total Complaints:</strong> ${fmtN(
            site.complaints_count
          )}</div>
        </div>
        <div id="${id}-chart" style="height:${CHART_HEIGHT}px;"></div>
        <div id="${id}-badges" style="margin-top:8px; display:flex; flex-wrap:wrap; gap:6px;"></div>
      </div>
    `;
    return { wrap, chartId: `${id}-chart`, badgesId: `${id}-badges` };
  }, []);

  const mountChartAndBadges = useCallback(
    async (
      chartId: string,
      badgesId: string,
      tsData: TsRow[],
      badgesData: ServiceBadgeRow[]
    ) => {
      const { createRoot } = await import("react-dom/client");
      const chartHost = document.getElementById(chartId);
      if (chartHost) {
        const root = createRoot(chartHost);
        root.render(
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <LineChart data={tsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="d" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="complaints_count" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        );
      }
      const badgesHost = document.getElementById(badgesId);
      if (badgesHost) {
        badgesHost.innerHTML = badgesData
          .map(
            (b) =>
              `<span style="background:#eef2ff;color:#1e3a8a;border:1px solid #c7d2fe;border-radius:999px;padding:3px 8px;font-size:11px;">
                ${b.SERVICETITLE ?? "—"}: <strong>${fmtN(
                b.complaints_count
              )}</strong>
              </span>`
          )
          .join("");
      }
    },
    []
  );

  const handleSelectSite = useCallback(
    async (site: SiteAggRow) => {
      setSelectedSite(site);
      const idBig = toBigint(site.SiteName);

      setNeighbors([]);

      let tsData: TsRow[] = [];
      let badgesData: ServiceBadgeRow[] = [];
      let nbData: NeighborRow[] = [];
      if (idBig) {
        [tsData, badgesData, nbData] = await Promise.all([
          fetchTimeseries(idBig, null, null),
          fetchServiceBadges(idBig, null, null),
          fetchNeighbors(idBig, 5),
        ]);
      }

      setTs(tsData);
      setBadges(badgesData);
      setNeighbors(nbData);

      colorizeMarkers(
        site.SiteName,
        new Set(nbData.map((n) => n.NeighborSiteName))
      );

      hoverPopupRef.current?.remove();
      hoverPopupRef.current = null;

      // Click popup anchored to RIGHT of the point
      if (
        mapRef.current &&
        typeof site.Longitude === "number" &&
        typeof site.Latitude === "number"
      ) {
        popupRef.current?.remove();
        const { wrap, chartId, badgesId } = await renderPopupContent(site);
        popupRef.current = new maplibregl.Popup({
          closeButton: true,
          anchor: "left", // popup appears on the RIGHT side
          offset: [14, 0], // extra horizontal space
          maxWidth: `${POPUP_WIDTH + 40}px`, // avoid default 240px clamp
        })
          .setLngLat([site.Longitude, site.Latitude])
          .setDOMContent(wrap)
          .addTo(mapRef.current);

        // Keep above tables
        popupRef.current.getElement().style.zIndex = "60";

        void mountChartAndBadges(chartId, badgesId, tsData, badgesData);
      }

      fitToSelectedAndNeighbors(site, nbData);
    },
    [
      colorizeMarkers,
      fitToSelectedAndNeighbors,
      mountChartAndBadges,
      renderPopupContent,
    ]
  );

  // Helper: select by name + known coordinates (for neighbor clicks)
  const handleSelectByName = useCallback(
    async (
      siteName: string,
      lon: number | null | undefined,
      lat: number | null | undefined,
      extras: Partial<SiteAggRow> = {}
    ) => {
      const site = {
        SiteName: siteName,
        Longitude: lon ?? undefined,
        Latitude: lat ?? undefined,
        ...extras,
      } as SiteAggRow;
      await handleSelectSite(site);
    },
    [handleSelectSite]
  );

  /* ---------------- Client-side search (approx match: includes) ---------------- */
  const [siteQuery, setSiteQuery] = useState<string>("");
  const [siteAddrQuery, setSiteAddrQuery] = useState<string>("");

  const filteredSites = useMemo(() => {
    const qName = norm(siteQuery);
    const qAddr = norm(siteAddrQuery);
    if (!qName && !qAddr) return sites;
    return sites.filter((r) => {
      const nameOk = qName ? norm(r.SiteName).includes(qName) : true;
      const addrOk = qAddr ? norm(r.Address).includes(qAddr) : true;
      return nameOk && addrOk;
    });
  }, [sites, siteQuery, siteAddrQuery]);

  const [nbQuery, setNbQuery] = useState<string>("");
  const [nbAddrQuery, setNbAddrQuery] = useState<string>("");

  const filteredNeighbors = useMemo(() => {
    const qName = norm(nbQuery);
    const qAddr = norm(nbAddrQuery);
    if (!qName && !qAddr) return neighbors;
    return neighbors.filter((n) => {
      const nameOk = qName ? norm(n.NeighborSiteName).includes(qName) : true;
      const addrOk = qAddr ? norm(n.Address).includes(qAddr) : true;
      return nameOk && addrOk;
    });
  }, [neighbors, nbQuery, nbAddrQuery]);

  /* ---------------- Tables (scroll 10 rows) ---------------- */
  const rowH = 44;
  const visibleRows = 10;
  const bodyMaxH = rowH * visibleRows;
  const selectedName = selectedSite?.SiteName ?? null;

  const onRowClick = (r: SiteAggRow) => void handleSelectSite(r);

  const onNeighborRowClick = (n: NeighborRow) =>
    void handleSelectByName(n.NeighborSiteName, n.Longitude, n.Latitude, {
      District: n.District ?? undefined,
      Grid: n.Grid ?? undefined,
      Address: n.Address ?? undefined,
    });

  /* ---------------- Render ---------------- */
  return (
    <div className="p-4 space-y-4">
      {/* Raise popups above surrounding layout */}
      <style jsx global>{`
        .maplibregl-popup {
          z-index: 60 !important;
        }
      `}</style>

      <h1 className="text-xl font-semibold">Complaints Geo Dashboard</h1>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <label className="flex flex-col text-sm">
          <span className="mb-1">Region</span>
          <select
            className="border rounded px-2 py-1"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1">SubRegion</span>
          <select
            className="border rounded px-2 py-1"
            value={subRegion ?? ""}
            onChange={(e) => setSubRegion(e.target.value || null)}
          >
            <option value="">All</option>
            {subRegions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1">District</span>
          <select
            className="border rounded px-2 py-1"
            value={district ?? ""}
            onChange={(e) => setDistrict(e.target.value || null)}
          >
            <option value="">All</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1">Grid</span>
          <select
            className="border rounded px-2 py-1"
            value={grid ?? ""}
            onChange={(e) => setGrid(e.target.value || null)}
          >
            <option value="">All</option>
            {grids.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="button"
            className="border rounded px-3 py-2 text-sm"
            onClick={() => void loadSites()}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Map (no clipping: overflow-visible; ensure stacking context: relative) */}
      <div
        ref={containerRef}
        className="relative h-[430px] rounded-xl border overflow-visible"
        style={{ backgroundColor: "#0f172a" }}
      />

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sites Table */}
        <div className="border rounded-xl shadow-sm overflow-hidden">
          <div className="bg-slate-800 text-white px-3 py-2 text-sm font-medium flex items-center gap-3">
            <span>{`Sites (${filteredSites.length.toLocaleString()} records)`}</span>
            <input
              placeholder="Search SiteName…"
              className="ml-auto rounded border px-2 py-1 text-black"
              value={siteQuery}
              onChange={(e) => setSiteQuery(e.target.value)}
            />
            <input
              placeholder="Search Address…"
              className="rounded border px-2 py-1 text-black"
              value={siteAddrQuery}
              onChange={(e) => setSiteAddrQuery(e.target.value)}
            />
          </div>
          <div className="overflow-auto" style={{ maxHeight: bodyMaxH }}>
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  <th className="text-left p-2">SiteName</th>
                  <th className="text-right p-2">Complaints</th>
                  <th className="text-left p-2">District</th>
                  <th className="text-left p-2">Grid</th>
                  <th className="text-left p-2">SiteAddress</th>
                </tr>
              </thead>
              <tbody>
                {filteredSites.map((r, idx) => (
                  <tr
                    key={r.SiteName}
                    className={`cursor-pointer ${
                      selectedName === r.SiteName
                        ? "bg-blue-50"
                        : idx % 2
                        ? "bg-white"
                        : "bg-slate-50"
                    } hover:bg-blue-100`}
                    onClick={() => onRowClick(r)}
                    style={{ height: rowH }}
                  >
                    <td className="p-2">{r.SiteName}</td>
                    <td className="p-2 text-right">
                      {fmtN(r.complaints_count)}
                    </td>
                    <td className="p-2">{r.District ?? ""}</td>
                    <td className="p-2">{r.Grid ?? ""}</td>
                    <td className="p-2">{r.Address ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Neighbors Table */}
        <div className="border rounded-xl shadow-sm overflow-hidden">
          <div className="bg-slate-800 text-white px-3 py-2 text-sm font-medium flex items-center gap-3">
            <span>{`Neighbors (≤ 5 km — ${filteredNeighbors.length.toLocaleString()} records)`}</span>
            <input
              placeholder="Search Neighbor SiteName…"
              className="ml-auto rounded border px-2 py-1 text-black"
              value={nbQuery}
              onChange={(e) => setNbQuery(e.target.value)}
            />
            <input
              placeholder="Search Address…"
              className="rounded border px-2 py-1 text-black"
              value={nbAddrQuery}
              onChange={(e) => setNbAddrQuery(e.target.value)}
            />
          </div>
          <div className="overflow-auto" style={{ maxHeight: bodyMaxH }}>
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  <th className="text-left p-2">Neighbor SiteName</th>
                  <th className="text-right p-2">Distance (km)</th>
                  <th className="text-left p-2">District</th>
                  <th className="text-left p-2">Grid</th>
                  <th className="text-left p-2">Address</th>
                </tr>
              </thead>
              <tbody>
                {filteredNeighbors.map((n, idx) => (
                  <tr
                    key={n.NeighborSiteName ?? `${idx}`}
                    className="cursor-pointer hover:bg-blue-100"
                    style={{ height: rowH }}
                    onClick={() => onNeighborRowClick(n)} // NEW: click + zoom + popup
                  >
                    <td className="p-2">{n.NeighborSiteName}</td>
                    <td className="p-2 text-right">
                      {typeof n.distance_km === "number"
                        ? n.distance_km.toFixed(2)
                        : "—"}
                    </td>
                    <td className="p-2">{n.District ?? ""}</td>
                    <td className="p-2">{n.Grid ?? ""}</td>
                    <td className="p-2">{n.Address ?? ""}</td>
                  </tr>
                ))}
                {!filteredNeighbors.length && (
                  <tr>
                    <td className="p-2 text-gray-500" colSpan={5}>
                      {neighbors.length
                        ? "No neighbors match your search."
                        : "Select a site to see neighbors…"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  fetchSiteMeta, // ✅
  fetchTimeseries,
  fetchServiceBadges,
  fetchNeighbors,
  fetchTimeseriesAll,
  fetchCountsByService,
  fetchCountsByGrid,
  type SiteAggRow as RpcSiteAggRow,
  type TsRow,
  type ServiceBadgeRow,
  type NeighborRow as RpcNeighborRow,
  type TsAggRow,
  type ServiceCountRow,
  type GridCountRow,
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

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

/* ================= Types ================= */
type SiteAggRow = RpcSiteAggRow;
type NeighborRow = RpcNeighborRow;

// Week window ONLY for top charts + right tables (NOT for dialog)
type WeekWindow = "all" | "4" | "8" | "12" | "24";

/* ================= Helpers ================= */
const POPUP_WIDTH = 380;

const fmtN = (n: number | null | undefined) =>
  typeof n === "number" ? n.toLocaleString() : "—";

const fmtAvail = (v: number | null | undefined) =>
  typeof v === "number" ? (v * 100).toFixed(2) : "—";

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

const complaintsColor = (count: number | null | undefined): string => {
  const v = typeof count === "number" ? count : 0;
  if (v > 40) return "rgba(220, 38, 38, 0.9)";
  if (v >= 20) return "rgba(249, 115, 22, 0.9)";
  return "rgba(234, 179, 8, 0.9)";
};

const SERVICE_COLORS = ["#ef4444", "#f97316", "#22c55e", "#3b82f6"] as const;

const buildDateRangeFromWeekWindow = (
  weekWindow: WeekWindow
): { dateFrom: string | null; dateTo: string | null } => {
  if (weekWindow === "all") return { dateFrom: null, dateTo: null };

  const weeks = Number(weekWindow);
  const today = new Date();
  const to = new Date(today);
  const from = new Date(today);
  from.setDate(to.getDate() - weeks * 7 + 1);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { dateFrom: fmt(from), dateTo: fmt(to) };
};

export default function ComplaintsGeoPage() {
  /** Filters */
  const [region, setRegion] = useState<string>("South");
  const [subRegion, setSubRegion] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [grid, setGrid] = useState<string | null>(null);

  // ✅ Week window affects ONLY top charts + right tables (NOT dialog)
  const [weekWindow, setWeekWindow] = useState<WeekWindow>("all");

  /** Picklists */
  const [regions, setRegions] = useState<string[]>([]);
  const [subRegions, setSubRegions] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [grids, setGrids] = useState<string[]>([]);

  /** Data */
  const [sites, setSites] = useState<SiteAggRow[]>([]);
  const [neighbors, setNeighbors] = useState<NeighborRow[]>([]);

  /** Dialog selection details */
  const [selectedSite, setSelectedSite] = useState<SiteAggRow | null>(null);
  const [ts, setTs] = useState<TsRow[]>([]);
  const [badges, setBadges] = useState<ServiceBadgeRow[]>([]);

  /** RIGHT SIDEBAR + TOP CHART DATA (week-scoped) */
  const [tsAll, setTsAll] = useState<TsAggRow[]>([]);
  const [svcCounts, setSvcCounts] = useState<ServiceCountRow[]>([]);
  const [gridCounts, setGridCounts] = useState<GridCountRow[]>([]);

  /** Dialog state */
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsErr, setDetailsErr] = useState<string | null>(null);

  /** Map refs */
  const mapRef = useRef<MLMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<MarkerRec[]>([]);
  const hoverPopupRef = useRef<Popup | null>(null);

  /* ---------------- Map init ---------------- */
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

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );

    map.on("load", () => {
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

  /* ---------------- Selection: recolor + zoom ---------------- */
  const colorizeMarkers = useCallback(
    (selectedName: string, neighborNames: Set<string>) => {
      markersRef.current.forEach((rec) => {
        const el = rec.marker.getElement() as HTMLDivElement & {
          dataset: { baseColor?: string };
        };
        if (rec.siteName === selectedName) {
          el.style.background = "rgba(37, 99, 235, 0.9)";
        } else if (neighborNames.has(rec.siteName)) {
          el.style.background = "rgba(220, 38, 38, 0.9)";
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
        if (typeof n.Longitude === "number" && typeof n.Latitude === "number") {
          coords.push([n.Longitude, n.Latitude]);
        }
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

  /* ---------------- Center dialog select handler ---------------- */
  const handleSelectSite = useCallback(
    async (site: SiteAggRow) => {
      setDetailsOpen(true);
      setDetailsLoading(true);
      setDetailsErr(null);

      setNeighbors([]);
      setTs([]);
      setBadges([]);

      try {
        // ✅ hydrate from SSL to ensure SiteClassification always correct
        const meta = await fetchSiteMeta(site.SiteName);

        const mergedSite: SiteAggRow = {
          ...site,
          ...(meta ?? {}),
          complaints_count: site.complaints_count ?? 0,
        };

        setSelectedSite(mergedSite);

        const idBig = toBigint(mergedSite.SiteName);

        let tsData: TsRow[] = [];
        let badgesData: ServiceBadgeRow[] = [];
        let nbData: NeighborRow[] = [];

        // ✅ dialog ignores weeks => dateFrom/dateTo always null
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
          mergedSite.SiteName,
          new Set(nbData.map((n) => n.NeighborSiteName))
        );

        hoverPopupRef.current?.remove();
        hoverPopupRef.current = null;

        fitToSelectedAndNeighbors(mergedSite, nbData);
      } catch (e) {
        console.error("handleSelectSite error", e);
        setDetailsErr("Failed to load site details.");
      } finally {
        setDetailsLoading(false);
      }
    },
    [colorizeMarkers, fitToSelectedAndNeighbors]
  );

  const handleSelectByName = useCallback(
    async (siteName: string) => {
      // ✅ minimal object; handleSelectSite will hydrate from SSL anyway
      await handleSelectSite({
        SiteName: siteName,
        Region: null,
        SubRegion: null,
        District: null,
        Grid: null,
        Latitude: null,
        Longitude: null,
        Address: null,
        SiteClassification: null,
        complaints_count: 0,
      });
    },
    [handleSelectSite]
  );

  /* ---------------- Build markers (hover+click) ---------------- */
  const rebuildMarkers = useCallback(
    (rows: SiteAggRow[]) => {
      markersRef.current.forEach((m) => m.marker.remove());
      markersRef.current = [];
      if (!mapRef.current) return;

      const vals = rows.map((r) => r.complaints_count ?? 0);
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
        const px = scale(r.complaints_count ?? 0);
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

        const onEnter = () => {
          hoverPopupRef.current?.remove();

          const html = `
            <div style="font-size:12px; line-height:1.25">
              <div><strong>Site:</strong> ${r.SiteName}</div>
              <div><strong>Grid:</strong> ${r.Grid ?? "—"}</div>
              <div><strong>SiteClass:</strong> ${
                r.SiteClassification ?? "—"
              }</div>
              <div><strong>District:</strong> ${r.District ?? "—"}</div>
              <div><strong>Complaints:</strong> ${fmtN(
                r.complaints_count
              )}</div>
              <div style="margin-top:6px; opacity:0.85"><em>Click marker for details</em></div>
            </div>
          `;

          const p = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            anchor: "left",
            offset: [12, 0],
            maxWidth: `${POPUP_WIDTH}px`,
          })
            .setLngLat([r.Longitude as number, r.Latitude as number])
            .setHTML(html)
            .addTo(mapRef.current as MLMap);

          p.getElement().style.zIndex = "60";
          hoverPopupRef.current = p;
        };

        const onLeave = () => {
          hoverPopupRef.current?.remove();
          hoverPopupRef.current = null;
        };

        el.addEventListener("mouseenter", onEnter);
        el.addEventListener("mouseleave", onLeave);

        el.addEventListener("click", () => void handleSelectSite(r));

        markersRef.current.push({ siteName: r.SiteName, marker });
      });
    },
    [handleSelectSite]
  );

  /* ---------------- Load sites ---------------- */
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

  /* ---------------- Client-side search ---------------- */
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

  /* ---------------- Right scoped data (week-scoped only) ---------------- */
  const loadRightScoped = useCallback(async () => {
    try {
      const argsBase = {
        region: region ?? null,
        subregion: subRegion ?? null,
        district: district ?? null,
        grid: grid ?? null,
      };

      const tsPromise = fetchTimeseriesAll(argsBase);
      const { dateFrom, dateTo } = buildDateRangeFromWeekWindow(weekWindow);

      const [tsA, svc, grd] = await Promise.all([
        tsPromise,
        fetchCountsByService({ ...argsBase, dateFrom, dateTo }),
        fetchCountsByGrid({ ...argsBase, dateFrom, dateTo }),
      ]);

      svc.sort((a, b) => (b.complaints_count ?? 0) - (a.complaints_count ?? 0));
      grd.sort((a, b) => (b.complaints_count ?? 0) - (a.complaints_count ?? 0));

      setTsAll(tsA);
      setSvcCounts(svc);
      setGridCounts(grd);
    } catch (e) {
      console.error("loadRightScoped error", e);
      setTsAll([]);
      setSvcCounts([]);
      setGridCounts([]);
    }
  }, [region, subRegion, district, grid, weekWindow]);

  useEffect(() => {
    void loadRightScoped();
  }, [loadRightScoped]);

  const totalSvcComplaints = useMemo(
    () => svcCounts.reduce((sum, r) => sum + (r.complaints_count ?? 0), 0),
    [svcCounts]
  );

  const totalGridComplaints = useMemo(
    () => gridCounts.reduce((sum, r) => sum + (r.complaints_count ?? 0), 0),
    [gridCounts]
  );

  /* ---------------- Top 4 service trends (week scoped for charts only) ---------------- */
  type ServiceSeries = { service: string; points: TsAggRow[]; total: number };

  const topServiceSeries: ServiceSeries[] = useMemo(() => {
    if (!tsAll.length) return [];

    let cutoffDate: Date | null = null;
    if (weekWindow !== "all") {
      const weeks = Number(weekWindow);
      let maxDate: Date | null = null;
      for (const row of tsAll) {
        const d = new Date(row.d);
        if (!maxDate || d > maxDate) maxDate = d;
      }
      if (maxDate) {
        const c = new Date(maxDate);
        c.setDate(c.getDate() - weeks * 7 + 1);
        cutoffDate = c;
      }
    }

    const grouped = new Map<string, TsAggRow[]>();
    tsAll.forEach((row) => {
      const key = row.SERVICETITLE ?? "Unknown";
      const arr = grouped.get(key) ?? [];
      arr.push(row);
      grouped.set(key, arr);
    });

    const series: ServiceSeries[] = [];
    grouped.forEach((rows, key) => {
      const filteredRows =
        cutoffDate === null
          ? rows
          : rows.filter((r) => new Date(r.d) >= cutoffDate);

      if (!filteredRows.length) return;

      const total = filteredRows.reduce(
        (sum, r) => sum + (r.complaints_count ?? 0),
        0
      );
      filteredRows.sort((a, b) => (a.d === b.d ? 0 : a.d < b.d ? -1 : 1));
      series.push({ service: key, points: filteredRows, total });
    });

    series.sort((a, b) => b.total - a.total);
    return series.slice(0, 4);
  }, [tsAll, weekWindow]);

  /* ---------------- Tables sizing ---------------- */
  const rowH = 44;
  const bodyMaxH = rowH * 10;
  const selectedName = selectedSite?.SiteName ?? null;

  const onRowClick = (r: SiteAggRow) => void handleSelectSite(r);

  const onNeighborRowClick = (n: NeighborRow) =>
    void handleSelectByName(n.NeighborSiteName);

  /* ---------------- Dialog totals (ignore weeks) ---------------- */
  const dialogTotalComplaints = useMemo(() => {
    const sumBadges = badges.reduce((s, b) => s + (b.complaints_count ?? 0), 0);
    if (sumBadges > 0) return sumBadges;
    return selectedSite?.complaints_count ?? 0;
  }, [badges, selectedSite]);

  /* ---------------- Render ---------------- */
  return (
    <div className="p-4 space-y-4">
      <style jsx global>{`
        .maplibregl-popup {
          z-index: 60 !important;
        }
      `}</style>

      <h1 className="text-xl font-semibold">Complaints Geo Dashboard</h1>

      {/* TOP ROW – Filters + 4 ServiceTitle Time-series Charts */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
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

          <label className="flex flex-col text-sm">
            <span className="mb-1">Weeks (charts &amp; tables)</span>
            <select
              className="border rounded px-2 py-1"
              value={weekWindow}
              onChange={(e) => setWeekWindow(e.target.value as WeekWindow)}
            >
              <option value="all">All</option>
              <option value="4">Last 4 weeks</option>
              <option value="8">Last 8 weeks</option>
              <option value="12">Last 12 weeks</option>
              <option value="24">Last 24 weeks</option>
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              className="border rounded px-3 py-2 text-sm w-full"
              onClick={() => void loadSites()}
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Top 4 charts */}
        <div className="border rounded-xl shadow-sm p-3 space-y-2 bg-slate-50">
          <div className="text-sm font-medium text-slate-800 mb-1">
            Top 4 ServiceTitle complaint trends
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {topServiceSeries.map((s, idx) => {
              const color =
                SERVICE_COLORS[idx % SERVICE_COLORS.length] ?? "#3b82f6";
              return (
                <div
                  key={s.service}
                  className="border rounded-lg bg-white shadow-sm flex flex-col"
                >
                  <div
                    className="px-3 py-1.5 text-xs font-semibold text-white truncate"
                    style={{ backgroundColor: color }}
                  >
                    {s.service}
                  </div>
                  <div className="p-2 h-[170px]">
                    <ResponsiveContainer width="100%" height={150}>
                      <LineChart data={s.points}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="d" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 9 }} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="complaints_count"
                          dot={false}
                          stroke={color}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
            {!topServiceSeries.length && (
              <div className="text-xs text-gray-500 px-2 py-4">
                No time-series data for current filters / week window.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MAP + RIGHT SIDEBAR */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <div
            ref={containerRef}
            className="relative h-[480px] rounded-xl border overflow-visible"
            style={{ backgroundColor: "#0f172a" }}
          />
        </div>

        <div className="space-y-4">
          {/* Service table */}
          <div className="border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-800 text-white px-3 py-2 text-sm font-medium">
              ServiceTitle — total complaints: {fmtN(totalSvcComplaints)}{" "}
              <span className="text-xs text-slate-300">
                ({svcCounts.length.toLocaleString()} rows)
              </span>
            </div>
            <div className="overflow-auto" style={{ maxHeight: 240 }}>
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-100">
                  <tr>
                    <th className="text-left p-2">ServiceTitle</th>
                    <th className="text-right p-2">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {svcCounts.map((r, i) => (
                    <tr
                      key={(r.SERVICETITLE ?? "—") + i}
                      className={i % 2 ? "bg-white" : "bg-slate-50"}
                    >
                      <td className="p-2">{r.SERVICETITLE ?? "—"}</td>
                      <td className="p-2 text-right">
                        {fmtN(r.complaints_count)}
                      </td>
                    </tr>
                  ))}
                  {!svcCounts.length && (
                    <tr>
                      <td className="p-2 text-gray-500" colSpan={2}>
                        No data for current filters / week window.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grid table */}
          <div className="border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-800 text-white px-3 py-2 text-sm font-medium">
              Grid — total complaints: {fmtN(totalGridComplaints)}{" "}
              <span className="text-xs text-slate-300">
                ({gridCounts.length.toLocaleString()} rows)
              </span>
            </div>
            <div className="overflow-auto" style={{ maxHeight: 240 }}>
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-100">
                  <tr>
                    <th className="text-left p-2">Grid</th>
                    <th className="text-right p-2">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {gridCounts.map((r, i) => (
                    <tr
                      key={(r.Grid ?? "—") + i}
                      className={i % 2 ? "bg-white" : "bg-slate-50"}
                    >
                      <td className="p-2">{r.Grid ?? "—"}</td>
                      <td className="p-2 text-right">
                        {fmtN(r.complaints_count)}
                      </td>
                    </tr>
                  ))}
                  {!gridCounts.length && (
                    <tr>
                      <td className="p-2 text-gray-500" colSpan={2}>
                        No data for current filters / week window.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* LOWER TABLES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sites */}
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
                  <th className="text-left p-2">SiteClass</th>
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
                    <td className="p-2">{r.SiteClassification ?? ""}</td>
                    <td className="p-2">{r.Address ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Neighbors */}
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
                  <th className="text-right p-2">Overall Avail</th>
                  <th className="text-left p-2">District</th>
                  <th className="text-left p-2">Grid</th>
                  <th className="text-left p-2">Address</th>
                </tr>
              </thead>
              <tbody>
                {filteredNeighbors.map((n, idx) => (
                  <tr
                    key={`${n.NeighborSiteName ?? idx}`}
                    className="cursor-pointer hover:bg-blue-100"
                    style={{ height: rowH }}
                    onClick={() => onNeighborRowClick(n)}
                  >
                    <td className="p-2">{n.NeighborSiteName}</td>
                    <td className="p-2 text-right">
                      {typeof n.distance_km === "number"
                        ? n.distance_km.toFixed(2)
                        : "—"}
                    </td>
                    <td className="p-2 text-right">
                      {typeof n.latest_overall === "number"
                        ? `${fmtAvail(n.latest_overall)}%`
                        : "—"}
                    </td>
                    <td className="p-2">{n.District ?? ""}</td>
                    <td className="p-2">{n.Grid ?? ""}</td>
                    <td className="p-2">{n.Address ?? ""}</td>
                  </tr>
                ))}

                {!filteredNeighbors.length && (
                  <tr>
                    <td className="p-2 text-gray-500" colSpan={6}>
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

      {/* ✅ CENTER DIALOG (IGNORES weeks for stats) */}
      <Dialog
        open={detailsOpen}
        onOpenChange={(o) => {
          setDetailsOpen(o);
          if (!o) {
            setDetailsErr(null);
            setDetailsLoading(false);
          }
        }}
      >
        {/* scrollable + resizable vertically */}
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto resize-y">
          <DialogHeader>
            <DialogTitle>
              Site Details — {selectedSite?.SiteName ?? "—"}
            </DialogTitle>
          </DialogHeader>

          {detailsLoading && (
            <div className="py-6 text-sm text-muted-foreground">Loading…</div>
          )}

          {detailsErr && (
            <div className="py-4 text-sm text-red-600">{detailsErr}</div>
          )}

          {!detailsLoading && !detailsErr && selectedSite && (
            <div className="space-y-4">
              {/* Top info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-semibold">Region:</span>{" "}
                  {selectedSite.Region ?? "—"}
                </div>
                <div>
                  <span className="font-semibold">SubRegion:</span>{" "}
                  {selectedSite.SubRegion ?? "—"}
                </div>
                <div>
                  <span className="font-semibold">District:</span>{" "}
                  {selectedSite.District ?? "—"}
                </div>
                <div>
                  <span className="font-semibold">Grid:</span>{" "}
                  {selectedSite.Grid ?? "—"}
                </div>

                <div>
                  <span className="font-semibold">SiteClassification:</span>{" "}
                  {selectedSite.SiteClassification ?? "—"}
                </div>
                <div />

                <div className="md:col-span-2">
                  <span className="font-semibold">Address:</span>{" "}
                  {selectedSite.Address ?? "—"}
                </div>

                <div className="md:col-span-2">
                  <span className="font-semibold">Total Complaints:</span>{" "}
                  {fmtN(dialogTotalComplaints)}
                  <span className="ml-2 text-xs text-muted-foreground">
                    (ignores Weeks)
                  </span>
                </div>
              </div>

              {/* Trend chart */}
              <div className="h-[260px] rounded-lg border bg-white p-2">
                {ts.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ts}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="d" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="complaints_count"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    No time-series data.
                  </div>
                )}
              </div>

              {/* Service badges */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Complaints by Service (ignores Weeks)
                </div>
                <div className="flex flex-wrap gap-2">
                  {badges.length ? (
                    badges.map((b, i) => (
                      <Badge
                        key={`${b.SERVICETITLE ?? "—"}-${i}`}
                        variant="secondary"
                        title={`${b.SERVICETITLE ?? "—"} • ${fmtN(
                          b.complaints_count
                        )}`}
                      >
                        {b.SERVICETITLE ?? "—"}
                        <span className="ml-2 font-semibold tabular-nums">
                          {fmtN(b.complaints_count)}
                        </span>
                      </Badge>
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      No service split data.
                    </div>
                  )}
                </div>
              </div>

              {/* Neighbors list (click opens neighbor in same dialog) */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Neighbors (≤ 5 km)
                </div>

                <div className="max-h-[220px] overflow-auto rounded-lg border">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-slate-100">
                      <tr>
                        <th className="text-left p-2">Neighbor</th>
                        <th className="text-right p-2">Distance (km)</th>
                        <th className="text-right p-2">Overall</th>
                      </tr>
                    </thead>
                    <tbody>
                      {neighbors.map((n, idx) => (
                        <tr
                          key={`${n.NeighborSiteName ?? "—"}-${idx}`}
                          className="cursor-pointer hover:bg-blue-50"
                          onClick={() =>
                            void handleSelectByName(n.NeighborSiteName)
                          }
                        >
                          <td className="p-2">{n.NeighborSiteName ?? "—"}</td>
                          <td className="p-2 text-right tabular-nums">
                            {typeof n.distance_km === "number"
                              ? n.distance_km.toFixed(2)
                              : "—"}
                          </td>
                          <td className="p-2 text-right tabular-nums">
                            {typeof n.latest_overall === "number"
                              ? `${fmtAvail(n.latest_overall)}%`
                              : "—"}
                          </td>
                        </tr>
                      ))}

                      {!neighbors.length && (
                        <tr>
                          <td className="p-2 text-muted-foreground" colSpan={3}>
                            No neighbors.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="text-xs text-muted-foreground">
                  Tip: click a neighbor to open it in this same dialog and zoom
                  the map.
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

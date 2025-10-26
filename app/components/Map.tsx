// app/components/Map.tsx
"use client";

import maplibregl, {
  LngLatBoundsLike,
  Map as MLMap,
  MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { memo, useEffect, useMemo, useRef } from "react";

export type MapPointInput = {
  id: string;
  lat: number;
  lon: number;
  size: number; // pixel radius (we pass 4..24 typically)
  tooltip?: string;
  color?: string | undefined; // optional override
};

type Props = {
  title?: string;
  points: MapPointInput[];
  onPointClick?: (p: { id: string }) => void;
  styleUrl?: string; // optional custom style
};

type FeatureProps = {
  id: string;
  tooltip?: string;
  color?: string;
  size: number;
};

function Map({ title, points, onPointClick, styleUrl }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  // Build GeoJSON
  const geojson = useMemo<
    GeoJSON.FeatureCollection<GeoJSON.Point, FeatureProps>
  >(
    () => ({
      type: "FeatureCollection",
      features: points.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: {
          id: p.id,
          tooltip: p.tooltip,
          color: p.color,
          size: p.size,
        },
      })),
    }),
    [points]
  );

  // Compute bounds
  const bounds = useMemo<LngLatBoundsLike | null>(() => {
    if (points.length === 0) return null;
    const lons = points.map((p) => p.lon);
    const lats = points.map((p) => p.lat);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    if (
      !isFinite(minLon) ||
      !isFinite(maxLon) ||
      !isFinite(minLat) ||
      !isFinite(maxLat)
    )
      return null;
    return [
      [minLon, minLat],
      [maxLon, maxLat],
    ];
  }, [points]);

  // Create map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl ?? "https://demotiles.maplibre.org/style.json",
      center: [70.0, 30.0], // fallback view (Pakistan-ish)
      zoom: 4,
    });
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("sites-src", {
        type: "geojson",
        data: geojson,
      });

      map.addLayer({
        id: "sites-circle",
        type: "circle",
        source: "sites-src",
        paint: {
          "circle-radius": ["get", "size"],
          "circle-color": ["coalesce", ["get", "color"], "#2563eb"],
          "circle-opacity": 0.8,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#111827",
        },
      });

      // Fit bounds initially if we have points
      if (bounds) {
        map.fitBounds(bounds, { padding: 40, duration: 0 });
      }
    });

    // Hover popup
    const handleMouseMove = (e: MapMouseEvent) => {
      if (!mapRef.current) return;
      const features = mapRef.current.queryRenderedFeatures(e.point, {
        layers: ["sites-circle"],
      });
      const f = features[0];
      if (!f) {
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
        return;
      }
      const props = f.properties as unknown as FeatureProps;
      const coordinates = (f.geometry as GeoJSON.Point).coordinates as [
        number,
        number
      ];
      if (!popupRef.current) {
        popupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 8,
        });
      }
      popupRef.current
        .setLngLat(coordinates)
        .setHTML(
          `<div style="white-space:pre-line;font-size:12px;">${(
            props.tooltip ?? props.id
          )
            .toString()
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")}</div>`
        )
        .addTo(mapRef.current);
    };

    const handleMouseLeave = () => {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    };

    const handleClick = (e: MapMouseEvent) => {
      if (!mapRef.current || !onPointClick) return;
      const features = mapRef.current.queryRenderedFeatures(e.point, {
        layers: ["sites-circle"],
      });
      const f = features[0];
      if (!f) return;
      const props = f.properties as unknown as FeatureProps;
      onPointClick({ id: props.id });
    };

    map.on("mousemove", "sites-circle", handleMouseMove);
    map.on("mouseleave", "sites-circle", handleMouseLeave);
    map.on("click", "sites-circle", handleClick);

    return () => {
      map.off("mousemove", "sites-circle", handleMouseMove);
      map.off("mouseleave", "sites-circle", handleMouseLeave);
      map.off("click", "sites-circle", handleClick);
      map.remove();
      mapRef.current = null;
    };
  }, [bounds, geojson, onPointClick, styleUrl]);

  // Update data when points change
  useEffect(() => {
    const map = mapRef.current;
    const src = map?.getSource("sites-src") as
      | maplibregl.GeoJSONSource
      | undefined;
    if (map && src) {
      src.setData(geojson);
      if (bounds) map.fitBounds(bounds, { padding: 40, duration: 300 });
    }
  }, [geojson, bounds]);

  return (
    <div className="p-4 rounded-2xl shadow-sm border bg-white">
      {title ? <h2 className="text-sm font-medium mb-3">{title}</h2> : null}
      <div
        ref={containerRef}
        className="h-72 w-full rounded-xl overflow-hidden"
      />
    </div>
  );
}

export default memo(Map);

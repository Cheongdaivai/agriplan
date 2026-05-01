import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet-draw";
import * as turf from "@turf/turf";
import useFarmStore from "../store/useFarmStore.js";
import { isPointInPolygon } from "../utils/geometry.js";
import { calculateAreaSqm } from "../utils/calculations.js";
import LocateButton from "./LocateButton.jsx";

/**
 * Format a geodesic segment distance for display.
 * < 1000 m → "42 m", ≥ 1000 m → "1.23 km"
 */
function formatSegmentLength(metres) {
  if (metres < 1) return "<1 m";
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(2)} km`;
}

// Fix Leaflet default icon paths that Vite's bundler breaks
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

// ── Tile layer configs ────────────────────────────────────────────────────────
// Zoom at which satellite imagery becomes unavailable — auto-switch to OSM
const SATELLITE_FALLBACK_ZOOM = 19;

const TILE_LAYERS = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxZoom: 21,
    maxNativeZoom: 18, // satellite data limit; tiles upscale beyond this
  },
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://openstreetmap.org">OSM</a>',
    maxZoom: 21,
    maxNativeZoom: 19, // OSM native limit; upscale to 21 for extra detail
  },
};

// ── AutoTileSwitcher ──────────────────────────────────────────────────────────
/**
 * Listens to zoom events and auto-switches between satellite and OSM.
 * Switches to OSM  when zoom >= SATELLITE_FALLBACK_ZOOM (satellite is blank).
 * Switches back to satellite when zoom drops to SATELLITE_FALLBACK_ZOOM - 2.
 */
function AutoTileSwitcher({ tileLayer, onTileChange }) {
  useMapEvents({
    zoomend: (e) => {
      const zoom = e.target.getZoom();
      if (tileLayer === "satellite" && zoom >= SATELLITE_FALLBACK_ZOOM) {
        onTileChange("osm");
      } else if (tileLayer === "osm" && zoom < SATELLITE_FALLBACK_ZOOM - 1) {
        onTileChange("satellite");
      }
    },
  });
  return null;
}

// ── MapController ─────────────────────────────────────────────────────────────
/**
 * Inner component with access to the Leaflet map instance via useMap().
 * All imperative Leaflet draw/render logic lives here — no declarative JSX layers.
 */
function MapController() {
  const map = useMap();
  const {
    mode,
    boundary,
    zones,
    crops,
    selectedZoneId,
    addBoundaryPoint,
    closeBoundary,
    addZonePoint,
    closeZone,
    selectZone,
    currentPoints,
  } = useFarmStore();

  // Leaflet layer refs — so we can tear down and re-create on state changes
  const boundaryLayerRef = useRef(null);
  const zoneLayersRef = useRef({}); // { [zoneId]: L.Polygon }
  const inProgressLayerRef = useRef(null);
  const clickTimerRef = useRef(null);

  // Shadow refs — read inside event handlers without stale closures
  const modeRef = useRef(mode);
  const boundaryRef = useRef(boundary);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    boundaryRef.current = boundary;
  }, [boundary]);

  // ── Click / dblclick ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleClick = (e) => {
      const latlng = { lat: e.latlng.lat, lng: e.latlng.lng };

      // 180 ms debounce to separate single-click from dblclick
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        const currentMode = modeRef.current;

        if (currentMode === "boundary") {
          addBoundaryPoint(latlng);
        } else if (currentMode === "zone") {
          const bnd = boundaryRef.current;
          if (bnd.length >= 3) {
            if (isPointInPolygon(latlng, bnd)) {
              addZonePoint(latlng);
            } else {
              // Flash red outline — point is outside the farm boundary
              const container = map.getContainer();
              container.style.outline = "3px solid #ef4444";
              setTimeout(() => {
                container.style.outline = "";
              }, 300);
            }
          }
        }
      }, 180);
    };

    const handleDblClick = (e) => {
      L.DomEvent.stop(e); // prevent default map zoom on dblclick
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      const currentMode = modeRef.current;
      if (currentMode === "boundary") closeBoundary();
      else if (currentMode === "zone") closeZone();
    };

    map.on("click", handleClick);
    map.on("dblclick", handleDblClick);
    return () => {
      map.off("click", handleClick);
      map.off("dblclick", handleDblClick);
    };
  }, [map, addBoundaryPoint, addZonePoint, closeBoundary, closeZone]);

  // ── Cursor per mode ───────────────────────────────────────────────────────
  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor =
      mode === "boundary" || mode === "zone" ? "crosshair" : "";
  }, [map, mode]);

  // ── Boundary polygon ──────────────────────────────────────────────────────
  useEffect(() => {
    if (boundaryLayerRef.current) {
      map.removeLayer(boundaryLayerRef.current);
      boundaryLayerRef.current = null;
    }
    if (boundary.length >= 3) {
      const latlngs = boundary.map((p) => [p.lat, p.lng]);
      boundaryLayerRef.current = L.polygon(latlngs, {
        color: "#22c55e",
        weight: 2,
        fillColor: "#22c55e",
        fillOpacity: 0.06,
        dashArray: "6 3",
        interactive: false,
      }).addTo(map);
    }
    return () => {
      if (boundaryLayerRef.current) {
        map.removeLayer(boundaryLayerRef.current);
        boundaryLayerRef.current = null;
      }
    };
  }, [map, boundary]);

  // ── In-progress drawing preview ────────────────────────────────────────────
  useEffect(() => {
    // Tear down previous preview
    if (inProgressLayerRef.current) {
      const { line, markers } = inProgressLayerRef.current;
      if (markers)
        markers.forEach((m) => {
          try {
            map.removeLayer(m);
          } catch {}
        });
      try {
        map.removeLayer(line);
      } catch {}
      inProgressLayerRef.current = null;
    }

    if (currentPoints.length >= 2) {
      const color = mode === "boundary" ? "#4ade80" : "#60a5fa";
      const fillColor = mode === "boundary" ? "#22c55e" : "#3b82f6";
      const latlngs = currentPoints.map((p) => [p.lat, p.lng]);

      const line = L.polyline(latlngs, {
        color,
        weight: 2,
        dashArray: "6 4",
        opacity: 0.8,
        interactive: false,
      }).addTo(map);

      // Vertex dot markers + segment length labels
      const markers = [];

      currentPoints.forEach((pt, i) => {
        // Vertex circle
        markers.push(
          L.circleMarker([pt.lat, pt.lng], {
            radius: i === 0 ? 6 : 4,
            color: "white",
            weight: 1.5,
            fillColor,
            fillOpacity: 1,
            interactive: false,
          }).addTo(map),
        );

        // Segment length label — placed at the midpoint of the segment
        if (i > 0) {
          const prev = currentPoints[i - 1];
          const from = turf.point([prev.lng, prev.lat]);
          const to = turf.point([pt.lng, pt.lat]);
          const distM = turf.distance(from, to, { units: "kilometers" }) * 1000;

          // Midpoint
          const midLat = (prev.lat + pt.lat) / 2;
          const midLng = (prev.lng + pt.lng) / 2;

          const labelIcon = L.divIcon({
            className: "",
            html: `<div style="
              background: rgba(17,24,39,0.85);
              color: ${mode === "boundary" ? "#86efac" : "#93c5fd"};
              font-size: 10px;
              font-weight: 700;
              font-family: system-ui, sans-serif;
              padding: 2px 6px;
              border-radius: 4px;
              border: 1px solid rgba(75,85,99,0.6);
              white-space: nowrap;
              box-shadow: 0 1px 4px rgba(0,0,0,0.5);
              pointer-events: none;
            ">${formatSegmentLength(distM)}</div>`,
            iconAnchor: [0, 0],
          });

          markers.push(
            L.marker([midLat, midLng], {
              icon: labelIcon,
              interactive: false,
              zIndexOffset: 500,
            }).addTo(map),
          );
        }
      });

      inProgressLayerRef.current = { line, markers };
    }

    return () => {
      if (inProgressLayerRef.current) {
        const { line, markers } = inProgressLayerRef.current;
        if (markers)
          markers.forEach((m) => {
            try {
              map.removeLayer(m);
            } catch {}
          });
        try {
          map.removeLayer(line);
        } catch {}
        inProgressLayerRef.current = null;
      }
    };
  }, [map, currentPoints, mode]);

  // ── Zone polygon layers ───────────────────────────────────────────────────
  useEffect(() => {
    // Remove layers for zones that no longer exist
    const currentIds = new Set(zones.map((z) => z.id));
    Object.keys(zoneLayersRef.current).forEach((id) => {
      if (!currentIds.has(id)) {
        try {
          map.removeLayer(zoneLayersRef.current[id]);
        } catch {}
        delete zoneLayersRef.current[id];
      }
    });

    // Add or re-create each zone layer (re-create to apply updated style/selection)
    zones.forEach((zone) => {
      const crop = crops.find(
        (c) => c._id === zone.cropId || c.id === zone.cropId,
      );
      const color = crop?.color ?? zone.color;
      const isSelected = zone.id === selectedZoneId;
      const latlngs = zone.coordinates.map((p) => [p.lat, p.lng]);

      // Always remove existing to rebuild with updated style
      if (zoneLayersRef.current[zone.id]) {
        try {
          map.removeLayer(zoneLayersRef.current[zone.id]);
        } catch {}
      }

      const poly = L.polygon(latlngs, {
        color,
        weight: isSelected ? 3 : 1.5,
        fillColor: color,
        fillOpacity: 0.35,
        dashArray: isSelected ? "8 4" : null,
        interactive: true,
      }).addTo(map);

      // Permanent label tooltip
      const areaSqm = calculateAreaSqm(zone.coordinates);
      const areaLabel =
        areaSqm >= 10000
          ? `${(areaSqm / 10000).toFixed(2)} ha`
          : `${Math.round(areaSqm)} m\u00b2`;
      const label = crop
        ? `${zone.name}\n${crop.name}\n${areaLabel}`
        : `${zone.name}\n${areaLabel}`;

      poly.bindTooltip(label, {
        permanent: true,
        direction: "center",
        className: "zone-label-tooltip",
        interactive: false,
      });

      // Click to select / deselect
      poly.on("click", (e) => {
        L.DomEvent.stop(e);
        selectZone(isSelected ? null : zone.id);
      });

      // Hover highlight
      poly.on("mouseover", () => {
        poly.setStyle({ fillOpacity: 0.55, weight: isSelected ? 3 : 2.5 });
        map.getContainer().style.cursor = "pointer";
      });
      poly.on("mouseout", () => {
        poly.setStyle({ fillOpacity: 0.35, weight: isSelected ? 3 : 1.5 });
        map.getContainer().style.cursor =
          modeRef.current === "boundary" || modeRef.current === "zone"
            ? "crosshair"
            : "";
      });

      zoneLayersRef.current[zone.id] = poly;
    });

    // Cleanup on unmount
    return () => {
      Object.values(zoneLayersRef.current).forEach((l) => {
        try {
          map.removeLayer(l);
        } catch {}
      });
      zoneLayersRef.current = {};
    };
  }, [map, zones, crops, selectedZoneId, selectZone]);

  return null; // All rendering is imperative via map.addLayer(...)
}

// ── TileLayerSwitcher ─────────────────────────────────────────────────────────
function TileLayerSwitcher({ current, onChange }) {
  return (
    <div className="absolute bottom-8 left-3 z-[1000] flex flex-col gap-1.5 items-start">
      <button
        onClick={() => onChange(current === "satellite" ? "osm" : "satellite")}
        className="bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg border border-gray-600 hover:bg-gray-700 transition-colors shadow-lg"
        title="Toggle map layer"
      >
        {current === "satellite"
          ? "\uD83D\uDDFA Street Map"
          : "\uD83D\uDEF0 Satellite"}
      </button>
      <span className="text-gray-400 text-[10px] bg-gray-900/70 px-2 py-0.5 rounded">
        {current === "satellite"
          ? "Auto-switches to street at high zoom"
          : "Auto-switches to satellite at low zoom"}
      </span>
    </div>
  );
}

// ── EmptyStateOverlay ─────────────────────────────────────────────────────────
function EmptyStateOverlay({ show }) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-[500] pointer-events-none">
      <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl px-8 py-6 text-center max-w-sm border border-gray-700">
        <div className="text-3xl mb-3">\uD83C\uDF3E</div>
        <p className="text-green-300 font-semibold text-base mb-1">
          Click to draw your farm boundary
        </p>
        <p className="text-gray-400 text-sm">
          Click on the map to place points &middot; Double-click to close the
          polygon
        </p>
      </div>
    </div>
  );
}

// ── ModeHint ──────────────────────────────────────────────────────────────────
function ModeHint({ mode, boundary, currentPoints, selectedZoneId }) {
  let hint = "";

  if (mode === "boundary" && currentPoints.length > 0) {
    hint = `${currentPoints.length} point${currentPoints.length !== 1 ? "s" : ""} \u00b7 Double-click to close boundary`;
  } else if (mode === "zone" && currentPoints.length > 0) {
    hint = `${currentPoints.length} point${currentPoints.length !== 1 ? "s" : ""} \u00b7 Double-click to close zone`;
  } else if (mode === "zone" && boundary.length >= 3) {
    hint = "Click inside boundary to draw a zone";
  } else if (mode === "select") {
    hint = selectedZoneId
      ? "Zone selected \u00b7 Pick a crop in the panel \u2192"
      : "Click a zone to select it";
  }

  if (!hint) return null;

  return (
    <div className="absolute bottom-12 left-3 z-[1000] pointer-events-none">
      <div className="bg-gray-900/90 text-gray-300 text-xs px-3 py-1.5 rounded-lg border border-gray-700 shadow">
        {hint}
      </div>
    </div>
  );
}

// ── CanvasMap (root export) ───────────────────────────────────────────────────
export default function CanvasMap() {
  const { mode, boundary, currentPoints, selectedZoneId } = useFarmStore();
  const [tileLayer, setTileLayer] = useState("satellite");
  const tile = TILE_LAYERS[tileLayer];

  const showEmptyState =
    boundary.length === 0 && currentPoints.length === 0 && mode === "boundary";

  return (
    <div className="relative w-full h-full">
      {/* Zone tooltip styles injected as a style tag */}
      <style>{`
        .zone-label-tooltip {
          background: rgba(17, 24, 39, 0.85) !important;
          border: 1px solid rgba(75, 85, 99, 0.6) !important;
          border-radius: 6px !important;
          color: #f3f4f6 !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          padding: 4px 8px !important;
          white-space: pre-line !important;
          text-align: center !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5) !important;
          pointer-events: none !important;
        }
        .zone-label-tooltip::before {
          display: none !important;
        }
      `}</style>

      <MapContainer
        center={[11.5624, 104.9282]}
        zoom={15}
        maxZoom={21}
        style={{ width: "100%", height: "100%" }}
        doubleClickZoom={false}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          key={tileLayer}
          url={tile.url}
          attribution={tile.attribution}
          maxZoom={tile.maxZoom}
          maxNativeZoom={tile.maxNativeZoom}
        />
        <AutoTileSwitcher tileLayer={tileLayer} onTileChange={setTileLayer} />
        <MapController />
        <LocateButton />
      </MapContainer>

      <EmptyStateOverlay show={showEmptyState} />
      <TileLayerSwitcher current={tileLayer} onChange={setTileLayer} />
      <ModeHint
        mode={mode}
        boundary={boundary}
        currentPoints={currentPoints}
        selectedZoneId={selectedZoneId}
      />
    </div>
  );
}

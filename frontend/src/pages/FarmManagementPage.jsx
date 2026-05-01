import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Tooltip,
  CircleMarker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { layoutsApi, sensorsApi } from "../utils/api.js";
import { calculateAreaSqm, calculateFarmStats } from "../utils/calculations.js";
import useManagementStore from "../store/useManagementStore.js";
import PlantGridOverlay from "../components/PlantGridOverlay.jsx";
import "leaflet/dist/leaflet.css";

// ─── Tile config ───────────────────────────────────────────────────────────────
const MGMT_SATELLITE_FALLBACK_ZOOM = 19;
const MGMT_TILE_LAYERS = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 21,
    maxNativeZoom: 18,
  },
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 21,
    maxNativeZoom: 19,
  },
};

function MgmtAutoTileSwitcher({ tileLayer, onTileChange }) {
  useMapEvents({
    zoomend: (e) => {
      const zoom = e.target.getZoom();
      if (tileLayer === "satellite" && zoom >= MGMT_SATELLITE_FALLBACK_ZOOM) {
        onTileChange("osm");
      } else if (tileLayer === "osm" && zoom < MGMT_SATELLITE_FALLBACK_ZOOM - 1) {
        onTileChange("satellite");
      }
    },
  });
  return null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getBoundaryCentroid(points) {
  if (!points || points.length === 0) return [11.5624, 104.9282];
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return [lat, lng];
}

function formatArea(sqm) {
  if (!sqm) return "0 m²";
  if (sqm >= 10000) return `${(sqm / 10000).toFixed(2)} ha`;
  return `${sqm.toFixed(1)} m²`;
}

function timeAgo(dateStr) {
  if (!dateStr) return "unknown";
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function sensorColor(type, value) {
  const v = parseFloat(value);
  if (isNaN(v)) return "text-gray-400";
  if (type === "soil_moisture") {
    if (v < 20) return "text-red-400";
    if (v < 40) return "text-yellow-400";
    return "text-green-400";
  }
  if (type === "temperature") {
    if (v < 10 || v > 40) return "text-red-400";
    return "text-green-400";
  }
  if (type === "humidity") {
    if (v < 30) return "text-yellow-400";
    return "text-green-400";
  }
  return "text-gray-300";
}

function sensorDot(type, value) {
  const v = parseFloat(value);
  if (isNaN(v)) return "🔵";
  if (type === "soil_moisture") {
    if (v < 20) return "🔴";
    if (v < 40) return "🟡";
    return "🟢";
  }
  if (type === "temperature") {
    if (v < 10 || v > 40) return "🔴";
    return "🟢";
  }
  if (type === "humidity") {
    if (v < 30) return "🟡";
    return "🟢";
  }
  return "🔵";
}

function deviceIcon(type) {
  if (type === "rover") return "🤖";
  if (type === "drone") return "🚁";
  return "📡"; // esp32, default
}

function statusBadge(status) {
  if (status === "online")
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/60 text-green-400 border border-green-700">
        online
      </span>
    );
  if (status === "error")
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/60 text-red-400 border border-red-700">
        error
      </span>
    );
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-400 border border-gray-600">
      offline
    </span>
  );
}

function deviceMarkerColor(status) {
  if (status === "online") return "#22c55e";
  if (status === "error") return "#ef4444";
  return "#6b7280";
}

// ─── FlyToLayout — imperatively flies the map to centroid ──────────────────────

function FlyToLayout({ layout }) {
  const map = useMap();
  const prevIdRef = useRef(null);

  useEffect(() => {
    if (!layout || !layout.boundary?.length) return;
    const id = layout._id ?? layout.id;
    if (id === prevIdRef.current) return;
    prevIdRef.current = id;
    const center = getBoundaryCentroid(layout.boundary);
    map.flyTo(center, 16, { duration: 1.2 });
  }, [layout, map]);

  return null;
}

// ─── ManagementMap ─────────────────────────────────────────────────────────────

function ManagementMap({
  activeLayout,
  selectedZoneId,
  onSelectZone,
  devices,
}) {
  const defaultCenter = [11.5624, 104.9282];
  const [tileLayer, setTileLayer] = useState("satellite");
  const tile = MGMT_TILE_LAYERS[tileLayer];

  const selectedZone = activeLayout?.zones?.find(
    (z) => (z.zoneId ?? z.id) === selectedZoneId,
  );

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={defaultCenter}
        zoom={15}
        maxZoom={21}
        className="w-full h-full"
        doubleClickZoom={false}
        attributionControl={false}
      >
        <TileLayer
          key={tileLayer}
          url={tile.url}
          maxZoom={tile.maxZoom}
          maxNativeZoom={tile.maxNativeZoom}
        />

        <MgmtAutoTileSwitcher tileLayer={tileLayer} onTileChange={setTileLayer} />
      {activeLayout && <FlyToLayout layout={activeLayout} />}

      {/* Boundary polygon */}
      {activeLayout?.boundary?.length >= 3 && (
        <Polygon
          positions={activeLayout.boundary.map((p) => [p.lat, p.lng])}
          pathOptions={{
            color: "#22c55e",
            fillColor: "transparent",
            weight: 2,
            dashArray: "8 4",
            opacity: 0.8,
          }}
        />
      )}

      {/* Zone polygons */}
      {activeLayout?.zones?.map((zone) => {
        const zid = zone.zoneId ?? zone.id;
        const isSelected = zid === selectedZoneId;
        return (
          <Polygon
            key={zid}
            positions={zone.coordinates.map((p) => [p.lat, p.lng])}
            pathOptions={{
              color: isSelected ? "#ffffff" : (zone.cropColor ?? "#6b7280"),
              fillColor: zone.cropColor ?? "#6b7280",
              fillOpacity: 0,
              weight: isSelected ? 3 : 1.5,
              dashArray: isSelected ? "6 3" : undefined,
            }}
            eventHandlers={{
            click: (e) => {
              // Stop propagation so the event does NOT bubble to the map
              // and fire onSelectZone a second time (which would toggle it off).
              e.originalEvent?.stopPropagation();
              onSelectZone(zid);
            },
          }}
          >
            <Tooltip
              permanent
              direction="center"
              className="zone-label-tooltip"
            >
              <span className="text-xs font-semibold text-white drop-shadow">
                {zone.name}
                {zone.cropName ? ` · ${zone.cropName}` : ""}
              </span>
              <br />
              <span className="text-xs text-gray-300">
                {formatArea(zone.areaSqm)}
              </span>
            </Tooltip>
          </Polygon>
        );
      })}

      {/* Plant grid overlay for selected zone */}
      {selectedZone &&
        selectedZone.rowPlan?.rows > 0 &&
        selectedZone.rowPlan?.columns > 0 && (
          <PlantGridOverlay zone={selectedZone} />
        )}

      {/* Device markers */}
      {devices.map((device) => {
        if (!device.location?.lat && !device.lat) return null;
        const lat = device.location?.lat ?? device.lat;
        const lng = device.location?.lng ?? device.lng;
        if (!lat || !lng) return null;
        return (
          <CircleMarker
            key={device.deviceId ?? device._id}
            center={[lat, lng]}
            radius={8}
            pathOptions={{
              color: deviceMarkerColor(device.status),
              fillColor: deviceMarkerColor(device.status),
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-sm space-y-1 min-w-[140px]">
                <p className="font-semibold">
                  {deviceIcon(device.type)} {device.name ?? device.deviceId}
                </p>
                <p className="text-gray-500 text-xs">{device.deviceId}</p>
                <p>
                  Status:{" "}
                  <strong
                    style={{
                      color: deviceMarkerColor(device.status),
                    }}
                  >
                    {device.status ?? "unknown"}
                  </strong>
                </p>
                {device.lastReading && (
                  <p className="text-xs text-gray-600">
                    Last reading:{" "}
                    {JSON.stringify(device.lastReading).slice(0, 60)}
                  </p>
                )}
                {device.lastSeen && (
                  <p className="text-xs text-gray-500">
                    Seen: {timeAgo(device.lastSeen)}
                  </p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
      </MapContainer>

      {/* Tile toggle button */}
      <div className="absolute bottom-8 left-3 z-[1000] flex flex-col gap-1.5 items-start pointer-events-auto">
        <button
          onClick={() => setTileLayer((t) => t === "satellite" ? "osm" : "satellite")}
          className="bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg border border-gray-600 hover:bg-gray-700 transition-colors shadow-lg"
        >
          {tileLayer === "satellite" ? "🗺 Street Map" : "🛰 Satellite"}
        </button>
        <span className="text-gray-400 text-[10px] bg-gray-900/70 px-2 py-0.5 rounded">
          {tileLayer === "satellite" ? "Auto-switches to street at high zoom" : "Auto-switches to satellite at low zoom"}
        </span>
      </div>
    </div>
  );
}

// ─── LayoutSidebar ─────────────────────────────────────────────────────────────

function LayoutSidebar({ layouts, activeLayout, onLoadLayout }) {
  const templates = layouts.filter((l) => l.isTemplate);
  const regular = layouts.filter((l) => !l.isTemplate);

  function LayoutCard({ layout }) {
    const isActive =
      (activeLayout?._id ?? activeLayout?.id) === (layout._id ?? layout.id);
    return (
      <button
        onClick={() => onLoadLayout(layout)}
        className={[
          "w-full text-left px-3 py-2.5 rounded-lg transition-colors border",
          isActive
            ? "bg-green-900/40 border-green-700 text-white"
            : "bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700",
        ].join(" ")}
      >
        <p className="font-medium text-sm truncate">
          {layout.name ?? "Untitled Layout"}
        </p>
        <div className="flex gap-3 mt-1 text-xs text-gray-400">
          <span>{layout.zones?.length ?? 0} zones</span>
          {layout.metadata?.totalAreaSqm != null && (
            <span>{formatArea(layout.metadata.totalAreaSqm)}</span>
          )}
        </div>
      </button>
    );
  }

  return (
    <aside className="w-72 bg-gray-900 border-r border-gray-700 flex flex-col overflow-hidden flex-shrink-0">
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <span>📋</span> Layouts
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Regular layouts */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Saved Layouts
          </p>
          {regular.length === 0 ? (
            <p className="text-xs text-gray-600 italic px-1">
              No saved layouts yet. Save a farm from the editor to create one.
            </p>
          ) : (
            <div className="space-y-2">
              {regular.map((l) => (
                <LayoutCard key={l._id ?? l.id} layout={l} />
              ))}
            </div>
          )}
        </div>

        {/* Templates */}
        {templates.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Templates
            </p>
            <div className="space-y-2">
              {templates.map((l) => (
                <LayoutCard key={l._id ?? l.id} layout={l} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Zone list for active layout */}
      {activeLayout && (
        <div className="border-t border-gray-700 flex flex-col max-h-64 overflow-hidden">
          <div className="px-4 py-2 bg-gray-800/60">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Zones in this layout
            </p>
          </div>
          <div className="overflow-y-auto flex-1">
            {(activeLayout.zones ?? []).map((zone) => {
              const zid = zone.zoneId ?? zone.id;
              return (
                <div
                  key={zid}
                  className="px-4 py-2 border-b border-gray-700/60 flex items-center gap-2"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: zone.cropColor ?? "#6b7280",
                    }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-200 truncate">
                      {zone.name}
                    </p>
                    {zone.cropName && (
                      <p className="text-xs text-gray-500">{zone.cropName}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}

// ─── ZoneDetailPanel ───────────────────────────────────────────────────────────

function ZoneDetailPanel({
  activeLayout,
  selectedZoneId,
  sensorData,
  devices,
  onRowPlanUpdate,
  onDeviceRegister,
  onSimulateReading,
}) {
  const rawZone = activeLayout?.zones?.find(
    (z) => (z.zoneId ?? z.id) === selectedZoneId,
  );

  // Keep a ref to the last valid zone so we never flash "Click a zone"
  // during a transient re-render (e.g. right after optimistic update).
  // Only truly show the empty state when selectedZoneId is explicitly null.
  const pinnedZoneRef = useRef(null);
  if (rawZone) pinnedZoneRef.current = rawZone;
  const zone = rawZone ?? (selectedZoneId ? pinnedZoneRef.current : null);

  const [rowPlan, setRowPlan] = useState({
    rows: 0,
    columns: 0,
    spacingM: 0.5,
    orientation: "horizontal",
  });
  const [applyingRowPlan, setApplyingRowPlan] = useState(false);
  const [applyError, setApplyError] = useState("");

  // Add device form state
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [newDevice, setNewDevice] = useState({
    deviceId: "",
    name: "",
    type: "esp32",
  });
  const [registeringDevice, setRegisteringDevice] = useState(false);

  // Simulating reading state
  const [simulating, setSimulating] = useState(false);

  // Sync rowPlan inputs when zone changes
  useEffect(() => {
    if (zone?.rowPlan) {
      setRowPlan({
        rows: zone.rowPlan.rows ?? 0,
        columns: zone.rowPlan.columns ?? 0,
        spacingM: zone.rowPlan.spacingM ?? 0.5,
        orientation: zone.rowPlan.orientation ?? "horizontal",
      });
    } else {
      setRowPlan({
        rows: 0,
        columns: 0,
        spacingM: 0.5,
        orientation: "horizontal",
      });
    }
  }, [zone]);

  const zoneDevices = devices.filter(
    (d) => d.zoneId === selectedZoneId || d.zone === selectedZoneId,
  );
  const zoneSensorData = sensorData[selectedZoneId] ?? {};
  const sensorEntries = Object.entries(zoneSensorData);

  async function handleApplyRowPlan() {
    if (!activeLayout || !selectedZoneId) return;
    setApplyingRowPlan(true);
    setApplyError("");
    try {
      await onRowPlanUpdate(
        activeLayout._id ?? activeLayout.id,
        selectedZoneId,
        rowPlan,
      );
    } catch (err) {
      setApplyError(
        err?.response?.data?.message ??
        err?.message ??
        "Failed to save row plan to server. Grid is shown locally only."
      );
    } finally {
      setApplyingRowPlan(false);
    }
  }

  async function handleRegisterDevice(e) {
    e.preventDefault();
    if (!newDevice.deviceId.trim()) return;
    setRegisteringDevice(true);
    try {
      await onDeviceRegister({
        ...newDevice,
        zoneId: selectedZoneId,
        farmId: activeLayout?.farmId,
      });
      setNewDevice({ deviceId: "", name: "", type: "esp32" });
      setShowAddDevice(false);
    } finally {
      setRegisteringDevice(false);
    }
  }

  async function handleSimulate() {
    if (!activeLayout || !selectedZoneId) return;
    setSimulating(true);
    try {
      await onSimulateReading(
        activeLayout.farmId ?? activeLayout._id ?? activeLayout.id,
        selectedZoneId,
      );
    } finally {
      setSimulating(false);
    }
  }

  // Computed zone stats
  const areaSqm = zone?.areaSqm ?? 0;
  const yieldKg = areaSqm * 0.3; // fallback estimate
  const revenue = yieldKg * 1.1;
  const waterL = areaSqm * 5;

  if (!zone) {
    return (
      <aside className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col overflow-hidden flex-shrink-0">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-bold text-white">Zone Details</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500 text-sm text-center px-6">
            Click a zone on the map to view details and sensor data.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col overflow-hidden flex-shrink-0">
      <div className="px-4 py-3 border-b border-gray-700 flex-shrink-0">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: zone.cropColor ?? "#6b7280" }}
          />
          {zone.name}
        </h2>
        {zone.cropName && (
          <p className="text-xs text-gray-400 mt-0.5">{zone.cropName}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Zone Info */}
        <div className="px-4 py-3 border-b border-gray-700 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Area</span>
            <span className="text-gray-200 font-medium">
              {formatArea(areaSqm)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Crop</span>
            <span className="text-gray-200">
              {zone.cropName ? (
                <>
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: zone.cropColor ?? "#6b7280" }}
                  />
                  {zone.cropName}
                </>
              ) : (
                <span className="text-gray-500">—</span>
              )}
            </span>
          </div>
        </div>

        {/* Estimated Stats */}
        <div className="px-4 py-3 border-b border-gray-700">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            📊 Estimated Stats
          </p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Yield</span>
              <span className="text-green-400 font-medium">
                {yieldKg.toFixed(1)} kg
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Revenue</span>
              <span className="text-green-400 font-medium">
                ${revenue.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Water</span>
              <span className="text-blue-400 font-medium">
                {waterL.toLocaleString()} L
              </span>
            </div>
          </div>
        </div>

        {/* Row Planner */}
        <div className="px-4 py-3 border-b border-gray-700">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            🌱 Row Planner
          </p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rows</label>
              <input
                type="number"
                min="0"
                value={rowPlan.rows}
                onChange={(e) =>
                  setRowPlan((p) => ({
                    ...p,
                    rows: parseInt(e.target.value) || 0,
                  }))
                }
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Columns
              </label>
              <input
                type="number"
                min="0"
                value={rowPlan.columns}
                onChange={(e) =>
                  setRowPlan((p) => ({
                    ...p,
                    columns: parseInt(e.target.value) || 0,
                  }))
                }
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-green-500"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">
              Spacing (m)
            </label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={rowPlan.spacingM}
              onChange={(e) =>
                setRowPlan((p) => ({
                  ...p,
                  spacingM: parseFloat(e.target.value) || 0.5,
                }))
              }
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-green-500"
            />
          </div>

          {/* Grid size estimate + warning */}
          {rowPlan.rows > 0 && rowPlan.columns > 0 && (() => {
            const total = rowPlan.rows * rowPlan.columns;
            if (total > 1_000_000) return (
              <p className="text-xs text-red-400 bg-red-900/30 border border-red-700/50 rounded px-2 py-1.5">
                ⛔ {total.toLocaleString()} pts exceeds the 1,000,000 limit.
                Reduce rows or columns.
              </p>
            );
            if (total > 100_000) return (
              <p className="text-xs text-yellow-400 bg-yellow-900/30 border border-yellow-700/50 rounded px-2 py-1.5">
                ⚡ {total.toLocaleString()} pts — large grid, will compute in background.
                Expect 5–30 s wait.
              </p>
            );
            if (total > 10_000) return (
              <p className="text-xs text-blue-400 bg-blue-900/20 border border-blue-700/40 rounded px-2 py-1.5">
                ℹ️ {total.toLocaleString()} pts — rendered in background, brief wait.
              </p>
            );
            return (
              <p className="text-xs text-gray-500 px-1">
                ~{total.toLocaleString()} grid points
              </p>
            );
          })()}

          <button
            onClick={handleApplyRowPlan}
            disabled={applyingRowPlan}
            className={[
              "w-full py-2 rounded text-sm font-medium transition-colors",
              applyingRowPlan
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-500 text-white",
            ].join(" ")}
          >
            {applyingRowPlan ? "Applying…" : "Apply Row Plan"}
          </button>

          {/* Error feedback */}
          {applyError && (
            <p className="text-xs text-red-400 bg-red-900/30 border border-red-700/50 rounded px-2 py-1.5">
              ⚠️ {applyError}
            </p>
          )}
        </div>

        {/* IoT / Sensor Panel */}
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            📡 Sensors & Devices
          </p>

          {/* Device list */}
          {zoneDevices.length === 0 ? (
            <p className="text-xs text-gray-600 italic mb-3">
              No devices registered for this zone.
            </p>
          ) : (
            <div className="space-y-2 mb-3">
              {zoneDevices.map((device) => (
                <div
                  key={device.deviceId ?? device._id}
                  className="bg-gray-800 rounded-lg px-3 py-2 border border-gray-700"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">
                      {deviceIcon(device.type)}{" "}
                      <span className="text-gray-200 font-medium text-xs">
                        {device.name ?? device.deviceId}
                      </span>
                    </span>
                    {statusBadge(device.status)}
                  </div>
                  <p className="text-xs text-gray-500 font-mono mb-1">
                    {device.deviceId}
                  </p>
                  {device.lastReading && (
                    <p className="text-xs text-gray-400">
                      {Object.entries(device.lastReading)
                        .slice(0, 2)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ")}
                    </p>
                  )}
                  {device.lastSeen && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      Last seen: {timeAgo(device.lastSeen)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Live sensor readings */}
          {sensorEntries.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-2">Latest readings:</p>
              <div className="space-y-1">
                {sensorEntries.slice(0, 5).map(([type, reading]) => (
                  <div
                    key={type}
                    className="flex items-center justify-between text-xs bg-gray-800/60 rounded px-2 py-1"
                  >
                    <span className="text-gray-400">{type}</span>
                    <span className={sensorColor(type, reading.value)}>
                      {reading.value}
                      {reading.unit ? ` ${reading.unit}` : ""}
                    </span>
                    <span className="text-xs">
                      {sensorDot(type, reading.value)}
                    </span>
                    {reading.recordedAt && (
                      <span className="text-gray-600 text-xs">
                        {new Date(reading.recordedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Simulate Reading button */}
          <button
            onClick={handleSimulate}
            disabled={simulating}
            className="w-full mb-2 py-1.5 rounded text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-50"
          >
            {simulating ? "Sending…" : "⚡ Simulate Reading"}
          </button>

          {/* Add Device */}
          {!showAddDevice ? (
            <button
              onClick={() => setShowAddDevice(true)}
              className="w-full py-1.5 rounded text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600 transition-colors"
            >
              + Add Device
            </button>
          ) : (
            <form
              onSubmit={handleRegisterDevice}
              className="bg-gray-800 rounded-lg p-3 border border-gray-600 space-y-2"
            >
              <p className="text-xs font-semibold text-gray-300 mb-1">
                Register Device
              </p>
              <input
                type="text"
                placeholder="Device ID"
                value={newDevice.deviceId}
                onChange={(e) =>
                  setNewDevice((d) => ({ ...d, deviceId: e.target.value }))
                }
                required
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-green-500"
              />
              <input
                type="text"
                placeholder="Name (optional)"
                value={newDevice.name}
                onChange={(e) =>
                  setNewDevice((d) => ({ ...d, name: e.target.value }))
                }
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-green-500"
              />
              <select
                value={newDevice.type}
                onChange={(e) =>
                  setNewDevice((d) => ({ ...d, type: e.target.value }))
                }
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-green-500"
              >
                <option value="esp32">📡 ESP32</option>
                <option value="rover">🤖 Rover</option>
                <option value="drone">🚁 Drone</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDevice(false)}
                  className="flex-1 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registeringDevice}
                  className="flex-1 py-1.5 rounded text-xs bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50"
                >
                  {registeringDevice ? "Saving…" : "Register"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </aside>
  );
}

// ─── FarmManagementPage ────────────────────────────────────────────────────────

export default function FarmManagementPage() {
  const navigate = useNavigate();
  const { layoutId: routeLayoutId } = useParams();
  const [searchParams] = useSearchParams();
  const queryLayoutId = searchParams.get("layoutId");

  const {
    layouts,
    activeLayout,
    selectedZoneId,
    sensorData,
    devices,
    setLayouts,
    loadLayout,
    setActiveLayout,
    setSelectedZone,
    setSensorData,
    setDevices,
    updateSensorReading,
    setLastRefresh,
  } = useManagementStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  // Load all layouts on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await layoutsApi.getAll();
        if (cancelled) return;
        // API returns { success, data: [...] } envelope
        const payload = res.data;
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.layouts)
              ? payload.layouts
              : [];
        setLayouts(list);

        // Auto-load from URL param or route param
        const targetId = routeLayoutId ?? queryLayoutId;
        if (targetId) {
          const found = list.find((l) => (l._id ?? l.id) === targetId);
          if (found) {
            loadLayout(found);  // resets zone selection when switching layouts
          } else {
            // Try fetching directly
            try {
              const single = await layoutsApi.getById(targetId);
              if (!cancelled) {
                // single.data = { success, data: layout } — extract inner data
                const sp = single.data;
                const layout = sp?.data ?? sp;
                loadLayout(layout);
              }
            } catch {
              // ignore
            }
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? "Failed to load layouts.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [routeLayoutId, queryLayoutId, setLayouts, loadLayout]);

  // Poll sensor data every 30 s
  useEffect(() => {
    if (!activeLayout) return;

    async function fetchSensors() {
      const farmId = activeLayout.farmId ?? activeLayout._id ?? activeLayout.id;
      if (!farmId) return;
      try {
        const [latestRes, devRes] = await Promise.allSettled([
          sensorsApi.getLatest(farmId),
          sensorsApi.getDevices(farmId),
        ]);

        if (latestRes.status === "fulfilled") {
          // latestRes.value.data = { success, data: { [zoneId]: {...} } }
          const envelope = latestRes.value?.data;
          const readings = envelope?.data ?? envelope;
          if (readings && typeof readings === "object" && !Array.isArray(readings)) {
            setSensorData(readings);
          }
        }
        if (devRes.status === "fulfilled") {
          // devRes.value.data = { success, data: [...] } or plain array
          const envelope = devRes.value?.data;
          const rawDev = envelope?.data ?? envelope;
          const devList = Array.isArray(rawDev)
            ? rawDev
            : Array.isArray(rawDev?.devices)
              ? rawDev.devices
              : [];
          setDevices(devList);
        }
        setLastRefresh();
      } catch {
        // silent — sensor data is non-critical
      }
    }

    fetchSensors();
    pollRef.current = setInterval(fetchSensors, 30_000);
    return () => clearInterval(pollRef.current);
  }, [activeLayout, setSensorData, setDevices, setLastRefresh]);

  const handleLoadLayout = useCallback(
    (layout) => {
      loadLayout(layout); // resets zone selection when user picks a different layout
    },
    [loadLayout],
  );

  const handleSelectZone = useCallback(
    (zid) => {
      // Simply select the clicked zone — do NOT toggle off.
      // Deselection only happens via an explicit null (map-background click).
      setSelectedZone(zid);
    },
    [setSelectedZone],
  );

  const handleRowPlanUpdate = useCallback(
    async (layoutId, zoneId, rowPlan) => {
      // ① Optimistic update FIRST — grid renders immediately without waiting for the API
      if (activeLayout) {
        const updated = {
          ...activeLayout,
          zones: activeLayout.zones.map((z) =>
            (z.zoneId ?? z.id) === zoneId ? { ...z, rowPlan } : z,
          ),
        };
        setActiveLayout(updated);
      }
      // ② Persist to backend — re-throw so ZoneDetailPanel can show the error
      try {
        await layoutsApi.updateZoneRowPlan(layoutId, zoneId, rowPlan);
      } catch (err) {
        console.warn("Row plan save failed (grid still shown locally):", err.message);
        throw err;
      }
    },
    [activeLayout, setActiveLayout],
  );

  const handleDeviceRegister = useCallback(
    async (deviceData) => {
      try {
        const res = await sensorsApi.registerDevice(deviceData);
        const newDevice = res.data;
        setDevices([...devices, newDevice]);
      } catch (err) {
        console.warn("Device registration failed:", err.message);
      }
    },
    [devices, setDevices],
  );

  const handleSimulateReading = useCallback(
    async (farmId, zoneId) => {
      const sensorTypes = ["soil_moisture", "temperature", "humidity"];
      const type = sensorTypes[Math.floor(Math.random() * sensorTypes.length)];

      const valueRanges = {
        soil_moisture: { min: 10, max: 80, unit: "%" },
        temperature: { min: 15, max: 42, unit: "°C" },
        humidity: { min: 20, max: 90, unit: "%" },
      };

      const range = valueRanges[type];
      const value = (
        Math.random() * (range.max - range.min) +
        range.min
      ).toFixed(1);

      const reading = {
        farmId,
        zoneId,
        deviceId: `sim-device-${zoneId?.slice(-4) ?? "0000"}`,
        sensorType: type,
        value: parseFloat(value),
        unit: range.unit,
        recordedAt: new Date().toISOString(),
      };

      try {
        await sensorsApi.ingest(reading);
        updateSensorReading(zoneId, type, {
          value: reading.value,
          unit: reading.unit,
          recordedAt: reading.recordedAt,
        });
      } catch {
        // If backend fails, still update UI locally
        updateSensorReading(zoneId, type, {
          value: reading.value,
          unit: reading.unit,
          recordedAt: reading.recordedAt,
        });
      }
    },
    [updateSensorReading],
  );

  const activeLayoutTitle = activeLayout?.name ?? "No layout selected";

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      {/* NavBar */}
      <header className="h-14 bg-gray-900 border-b border-gray-700 flex items-center px-4 gap-4 flex-shrink-0 z-10">
        <div className="flex items-center gap-2 mr-2">
          <span className="text-xl">🌿</span>
          <span className="text-white font-bold text-lg tracking-tight">
            AgriPlan
          </span>
        </div>

        <div className="w-px h-6 bg-gray-600" />

        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
        >
          ← Farm Editor
        </button>

        <div className="w-px h-6 bg-gray-600" />

        <h1 className="text-sm font-semibold text-gray-200 truncate max-w-xs">
          {activeLayoutTitle}
        </h1>

        <div className="flex-1" />

        {loading && (
          <span className="text-xs text-gray-500 animate-pulse">Loading…</span>
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Layout Sidebar */}
        <LayoutSidebar
          layouts={layouts}
          activeLayout={activeLayout}
          onLoadLayout={handleLoadLayout}
        />

        {/* Center — Map */}
        <main className="flex-1 relative overflow-hidden">
          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-900/80 border border-red-700 text-red-300 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {!activeLayout && !loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="text-center space-y-2 bg-gray-900/80 px-8 py-6 rounded-xl border border-gray-700">
                <p className="text-4xl">🗺️</p>
                <p className="text-white font-semibold">No layout selected</p>
                <p className="text-gray-400 text-sm">
                  Select a layout from the left panel, or save a farm from the
                  editor first.
                </p>
              </div>
            </div>
          )}

          <ManagementMap
            activeLayout={activeLayout}
            selectedZoneId={selectedZoneId}
            onSelectZone={handleSelectZone}
            devices={devices}
          />
        </main>

        {/* Right — Zone Detail */}
        <ZoneDetailPanel
          activeLayout={activeLayout}
          selectedZoneId={selectedZoneId}
          sensorData={sensorData}
          devices={devices}
          onRowPlanUpdate={handleRowPlanUpdate}
          onDeviceRegister={handleDeviceRegister}
          onSimulateReading={handleSimulateReading}
        />
      </div>
    </div>
  );
}

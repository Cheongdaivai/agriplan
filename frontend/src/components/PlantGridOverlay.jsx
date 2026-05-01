import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

// ── Constants ──────────────────────────────────────────────────────────────────
const MAX_POINTS   = 1_000_000;
const CHUNK_ROWS   = 30;
const MIN_DOT_ZOOM = 17; // dots only visible at this zoom level and above

// ── Helpers ────────────────────────────────────────────────────────────────────
function isInsidePolygon(lat, lng, coords) {
  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i].lat, yi = coords[i].lng;
    const xj = coords[j].lat, yj = coords[j].lng;
    if (((yi > lng) !== (yj > lng)) &&
        (lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
}

/** Dot radius in px for a given zoom level */
function dotRadius(zoom) {
  return Math.max(1, Math.min(7, 0.07 * Math.pow(2, zoom - 13)));
}

/**
 * Inline Web Worker source — projects [lat,lng,...] → [worldX,worldY,...] at a
 * given zoom using Leaflet's Web Mercator formula so the main thread is never
 * blocked by a large projection loop.
 */
const WORKER_SRC = `
const R = 6378137;
const DEG = Math.PI / 180;
const TILE = 256;
function projectY(lat) {
  const s = Math.sin(lat * DEG);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}
self.onmessage = function(e) {
  const { pts, zoom } = e.data;
  const scale = TILE * Math.pow(2, zoom);
  const out   = new Float64Array(pts.length);
  for (let i = 0; i < pts.length; i += 2) {
    out[i]     = (pts[i + 1] / 360 + 0.5) * scale;   // worldX from lng
    out[i + 1] = projectY(pts[i])           * scale;   // worldY from lat
  }
  self.postMessage({ cache: out, zoom }, [out.buffer]);
};
`;

// ── Custom Leaflet canvas layer ────────────────────────────────────────────────
/**
 * Strategy
 * ────────
 * • Canvas lives in a dedicated Leaflet pane (z-index 450).
 *   Leaflet's own CSS transforms pan/zoom the pane → zero JS per animation frame.
 *
 * • During zoom animation (zoomanim … zoomend) we hide the canvas so the
 *   user never sees incorrectly-scaled dots while the pane is being CSS-scaled.
 *
 * • After zoom/move settles we rebuild the pixel cache in a Web Worker
 *   (non-blocking) then fade the canvas back in with a smooth opacity transition.
 *
 * • Per-redraw draw loop: 2 reads + 2 subtractions per point, single fill().
 */
const PANE_NAME = "plantDotsPane";

class GridCanvasLayer extends L.Layer {
  constructor(pts, color) {
    super();
    this._geopts    = pts;     // Float32Array [lat, lng, ...]
    this._pxCache   = null;    // Float64Array [worldX, worldY, ...] — built off-thread
    this._cacheZoom = null;
    this._color     = color;
    this._rafId     = null;
    this._zooming   = false;
    this._worker    = null;
  }

  onAdd(map) {
    if (!map.getPane(PANE_NAME)) {
      map.createPane(PANE_NAME).style.zIndex = 450;
    }
    const canvas = L.DomUtil.create("canvas", "", map.getPane(PANE_NAME));
    Object.assign(canvas.style, {
      pointerEvents: "none",
      position:      "absolute",
      opacity:       "0",
      transition:    "opacity 0.2s ease",
    });
    this._canvas = canvas;

    // Spawn worker from blob URL so no extra bundler config is needed
    const blob = new Blob([WORKER_SRC], { type: "text/javascript" });
    this._worker = new Worker(URL.createObjectURL(blob));
    this._worker.onmessage = (e) => this._onCacheDone(e.data);

    map.on("zoomanim",  this._onZoomStart, this);
    map.on("zoomend",   this._onZoomEnd,   this);
    map.on("viewreset", this._onZoomEnd,   this);
    map.on("moveend",   this._onMoveEnd,   this);

    this._requestCache(map.getZoom());
    return this;
  }

  onRemove(map) {
    map.off("zoomanim",  this._onZoomStart, this);
    map.off("zoomend",   this._onZoomEnd,   this);
    map.off("viewreset", this._onZoomEnd,   this);
    map.off("moveend",   this._onMoveEnd,   this);
    if (this._rafId)  { cancelAnimationFrame(this._rafId); this._rafId = null; }
    if (this._worker) { this._worker.terminate(); this._worker = null; }
    if (this._canvas) { L.DomUtil.remove(this._canvas); this._canvas = null; }
  }

  /** Hide dots immediately when a zoom animation begins. */
  _onZoomStart() {
    this._zooming = true;
    if (this._canvas) this._canvas.style.opacity = "0";
  }

  /** Zoom finished — request a fresh cache at the new zoom. */
  _onZoomEnd() {
    this._zooming = false;
    this._requestCache(this._map.getZoom());
  }

  /** Pan settled — cache is still valid, just redraw at new offset. */
  _onMoveEnd() {
    if (!this._zooming) this._scheduleRedraw();
  }

  /** Send geo points + zoom to the worker for off-thread projection. */
  _requestCache(zoom) {
    if (zoom < MIN_DOT_ZOOM) {
      // Below visibility threshold — clear and stay hidden.
      this._pxCache = null;
      if (this._canvas) {
        this._canvas.style.opacity = "0";
        const ctx = this._canvas.getContext("2d");
        ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
      }
      return;
    }
    // Transfer the buffer to the worker (zero-copy); we'll get it back in onmessage.
    const pts = this._geopts;
    const copy = new Float32Array(pts);           // clone so we keep _geopts intact
    this._worker.postMessage({ pts: copy, zoom }, [copy.buffer]);
  }

  /** Worker finished — stash cache and trigger a redraw. */
  _onCacheDone({ cache, zoom }) {
    this._pxCache   = cache;
    this._cacheZoom = zoom;
    // Discard stale results if the user has already zoomed to a different level
    if (zoom !== this._map?.getZoom()) return;
    this._scheduleRedraw();
  }

  _scheduleRedraw() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this._redraw();
    });
  }

  _redraw() {
    const map    = this._map;
    const canvas = this._canvas;
    if (!map || !canvas || !this._pxCache) return;

    const zoom = map.getZoom();
    if (zoom < MIN_DOT_ZOOM || zoom !== this._cacheZoom) return;

    const size    = map.getSize();
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(canvas, topLeft);
    if (canvas.width  !== size.x) canvas.width  = size.x;
    if (canvas.height !== size.y) canvas.height = size.y;

    const ctx    = canvas.getContext("2d");
    const r      = dotRadius(zoom);
    const origin = map.getPixelOrigin();
    const offX   = origin.x + topLeft.x;
    const offY   = origin.y + topLeft.y;
    const cache  = this._pxCache;
    const maxX   = size.x + r;
    const maxY   = size.y + r;
    const TAU    = Math.PI * 2;

    ctx.clearRect(0, 0, size.x, size.y);
    ctx.fillStyle = this._color;
    ctx.beginPath();
    for (let i = 0; i < cache.length; i += 2) {
      const x = cache[i]     - offX;
      const y = cache[i + 1] - offY;
      if (x < -r || x > maxX || y < -r || y > maxY) continue;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fill();

    // Fade in after drawing so the user never sees a half-drawn frame
    canvas.style.opacity = "1";
  }
}

// ── PlantGridOverlay ───────────────────────────────────────────────────────────
export default function PlantGridOverlay({ zone }) {
  const map = useMap();

  const zoneRef   = useRef(zone);
  zoneRef.current = zone;

  const zoneId = zone?.zoneId ?? zone?.id ?? null;
  const rows   = zone?.rowPlan?.rows    ?? 0;
  const cols   = zone?.rowPlan?.columns ?? 0;

  const layerRef   = useRef(null);
  const timerRef   = useRef(null);
  const controlRef = useRef(null);
  const cancelRef  = useRef(false);

  function abort() {
    cancelRef.current = true;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }
  function removeLayer() {
    if (layerRef.current) {
      try { map.removeLayer(layerRef.current); } catch { /**/ }
      layerRef.current = null;
    }
  }
  function removeControl() {
    if (controlRef.current) {
      try { map.removeControl(controlRef.current); } catch { /**/ }
      controlRef.current = null;
    }
  }
  function showMsg(html, accent = "#22c55e", autoMs = 0) {
    removeControl();
    const el = L.DomUtil.create("div");
    Object.assign(el.style, {
      background: "rgba(17,24,39,0.92)", color: "white",
      padding: "8px 14px", borderRadius: "8px",
      border: `1px solid ${accent}55`, fontSize: "12px",
      fontFamily: "system-ui,sans-serif", lineHeight: "1.6",
      pointerEvents: "none", minWidth: "180px",
    });
    el.innerHTML = html;
    const ctrl = L.control({ position: "bottomleft" });
    ctrl.onAdd = () => el;
    ctrl.addTo(map);
    controlRef.current = ctrl;
    if (autoMs > 0) setTimeout(() => { if (controlRef.current === ctrl) removeControl(); }, autoMs);
    return el;
  }

  useEffect(() => {
    abort();
    removeLayer();
    removeControl();

    if (!zoneId || rows <= 0 || cols <= 0) return;
    const total = rows * cols;
    if (total > MAX_POINTS) {
      showMsg(`⛔ ${total.toLocaleString()} pts exceeds 1,000,000.`, "#ef4444", 5000);
      return;
    }

    const coords    = zoneRef.current?.coordinates ?? [];
    const cropColor = zoneRef.current?.cropColor ?? "#22c55e";
    if (coords.length < 3) return;

    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const { lat, lng } of coords) {
      if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
    }
    if (maxLat === minLat || maxLng === minLng) return;

    const latRange = maxLat - minLat;
    const lngRange = maxLng - minLng;

    const progressEl = showMsg("🌱 Generating grid… 0%", "#22c55e");
    cancelRef.current = false;

    const pts = [];
    let currentRow = 0;

    function processChunk() {
      if (cancelRef.current) return;
      const endRow = Math.min(currentRow + CHUNK_ROWS, rows);
      for (let r = currentRow; r < endRow; r++) {
        const lat = minLat + ((r + 0.5) / rows) * latRange;
        for (let c = 0; c < cols; c++) {
          const lng = minLng + ((c + 0.5) / cols) * lngRange;
          if (isInsidePolygon(lat, lng, coords)) pts.push(lat, lng);
        }
      }
      currentRow = endRow;
      const pct = Math.round((currentRow / rows) * 100);
      if (progressEl) {
        progressEl.innerHTML =
          `🌱 Generating grid… ${pct}%<br>` +
          `<span style="font-size:10px;color:#9ca3af">${(pts.length / 2).toLocaleString()} pts inside</span>`;
      }

      if (currentRow < rows) {
        timerRef.current = setTimeout(processChunk, 0);
        return;
      }

      timerRef.current = null;
      if (cancelRef.current) return;

      if (pts.length === 0) {
        showMsg("⚠️ No points found inside zone.", "#f59e0b", 4000);
        return;
      }

      const layer = new GridCanvasLayer(new Float32Array(pts), cropColor);
      layer.addTo(map);
      layerRef.current = layer;
      removeControl();
    }

    timerRef.current = setTimeout(processChunk, 0);
    return () => { abort(); removeLayer(); removeControl(); };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, zoneId, rows, cols]);

  return null;
}

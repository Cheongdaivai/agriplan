import { useEffect, useRef, useCallback } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import useFarmStore from "../store/useFarmStore.js";

/**
 * useUserLocation
 *
 * Encapsulates all geolocation logic using Leaflet's built-in map.locate() API.
 * Must be called from a component rendered inside a <MapContainer>.
 *
 * State machine:
 *   idle → requesting → located
 *                    ↘ error
 *   (error or located) → idle (via resetLocation + re-click)
 *
 * Returns:
 *   locate()  — trigger a geolocation request
 */
export function useUserLocation() {
  const map = useMap();
  const {
    setLocationRequesting,
    setUserLocation,
    setLocationError,
    resetLocation,
    locationState,
  } = useFarmStore();

  // Refs to Leaflet layers so we can remove and re-add them on each update
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  // Ref to track whether we're in watch mode so we can stop it
  const watchActiveRef = useRef(false);

  /**
   * Trigger a geolocation request.
   * Uses watch:true so Leaflet keeps refining the position as the device
   * GPS warms up.  We stop watching once accuracy drops below 50 m.
   * maximumAge:0 forces a fresh GPS fix — prevents returning a stale
   * WiFi-triangulation cache result (which causes the ±200m circle).
   */
  const locate = useCallback(() => {
    if (locationState === "requesting") return; // already in-flight
    if (locationState === "error") resetLocation();

    watchActiveRef.current = true;
    setLocationRequesting();

    map.locate({
      setView: true, // fly the map to the user on first fix
      maxZoom: 18, // zoom close enough to see individual fields
      enableHighAccuracy: true, // always request GPS on mobile
      timeout: 15000, // 15 s — longer gives GPS time to acquire
      maximumAge: 0, // NEVER use a cached position — forces fresh fix
      watch: true, // keep refining position as accuracy improves
    });
  }, [map, locationState, setLocationRequesting, resetLocation]);

  // ── Event listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    // ── Success ──────────────────────────────────────────────────────────
    const onLocationFound = (e) => {
      const { latlng, accuracy } = e;

      setUserLocation({ lat: latlng.lat, lng: latlng.lng, accuracy });

      // Once accuracy is good enough, stop watching to save battery
      if (watchActiveRef.current && accuracy <= 50) {
        map.stopLocate();
        watchActiveRef.current = false;
      }

      // Tear down previous marker + circle if they exist
      if (markerRef.current) {
        try {
          map.removeLayer(markerRef.current);
        } catch {}
        markerRef.current = null;
      }
      if (circleRef.current) {
        try {
          map.removeLayer(circleRef.current);
        } catch {}
        circleRef.current = null;
      }

      // ── Pulsing blue dot marker ─────────────────────────────────────
      const pulsingIcon = L.divIcon({
        className: "",
        html: `
          <div style="
            position:relative;
            width:16px;
            height:16px;
          ">
            <!-- Outer pulse ring -->
            <div style="
              position:absolute;
              inset:-4px;
              border-radius:50%;
              background:rgba(37,99,235,0.25);
              animation:agri-pulse 2s ease-out infinite;
            "></div>
            <!-- Inner solid dot -->
            <div style="
              position:absolute;
              inset:0;
              background:#2563eb;
              border:2.5px solid white;
              border-radius:50%;
              box-shadow:0 2px 6px rgba(0,0,0,0.35);
            "></div>
          </div>
          <style>
            @keyframes agri-pulse {
              0%   { transform:scale(1);   opacity:0.8; }
              70%  { transform:scale(2.4); opacity:0; }
              100% { transform:scale(2.4); opacity:0; }
            }
          </style>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        popupAnchor: [0, -12],
      });

      markerRef.current = L.marker(latlng, {
        icon: pulsingIcon,
        zIndexOffset: 1000, // render above zone polygons
        interactive: true,
      })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:system-ui;font-size:13px;line-height:1.6">
            <strong style="color:#111827">Your location</strong><br/>
            <span style="color:#6b7280">Accuracy: ±${Math.round(accuracy)} m</span><br/>
            <span style="color:#6b7280;font-size:11px;font-family:monospace">
              ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}
            </span>
          </div>`,
          { maxWidth: 220, className: "agri-location-popup" },
        );

      // ── Accuracy radius circle ─────────────────────────────────────
      circleRef.current = L.circle(latlng, {
        radius: accuracy,
        color: "#2563eb",
        fillColor: "#2563eb",
        fillOpacity: 0.07,
        weight: 1,
        dashArray: "4 5",
        interactive: false,
      }).addTo(map);
    };

    // ── Error ─────────────────────────────────────────────────────────
    const onLocationError = (e) => {
      // Leaflet error codes mirror the GeolocationPositionError codes:
      // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
      const messages = {
        1: "Location access was denied. To enable it, go to your browser Settings → Site permissions → Location → Allow.",
        2: "Location is currently unavailable. Check that your device GPS or network is on.",
        3: "Location request timed out. Make sure GPS is enabled and try again.",
      };
      const msg =
        messages[e.code] ?? "Could not get your location. Please try again.";
      setLocationError(msg);
    };

    map.on("locationfound", onLocationFound);
    map.on("locationerror", onLocationError);

    return () => {
      map.off("locationfound", onLocationFound);
      map.off("locationerror", onLocationError);
      // Stop any active watch and clean up map layers on unmount
      if (watchActiveRef.current) {
        map.stopLocate();
        watchActiveRef.current = false;
      }
      if (markerRef.current) {
        try {
          map.removeLayer(markerRef.current);
        } catch {}
      }
      if (circleRef.current) {
        try {
          map.removeLayer(circleRef.current);
        } catch {}
      }
    };
  }, [map, setUserLocation, setLocationError]);

  return { locate };
}

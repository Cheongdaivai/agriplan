import { useUserLocation } from "../hooks/useUserLocation.js";
import useFarmStore from "../store/useFarmStore.js";

/**
 * LocateButton
 *
 * A Leaflet-native control button rendered inside <MapContainer>.
 * Uses `useUserLocation` (which calls useMap()) so it must be a child of
 * <MapContainer>.
 *
 * Visual states:
 *   idle       → white button with crosshair SVG
 *   requesting → white button with spinning ⟳
 *   located    → blue button with crosshair SVG + accuracy badge below
 *   error      → white button (re-clickable) + red error toast below
 */
export default function LocateButton() {
  const { locate } = useUserLocation();
  const { locationState, locationError, userLocation } = useFarmStore();

  const isRequesting = locationState === "requesting";
  const isLocated = locationState === "located";
  const isError = locationState === "error";

  return (
    /*
     * Use Leaflet's own CSS classes so the button appears inside the map chrome
     * at the correct z-index (above tiles, below draw toolbar).
     * Position: top-right, offset below the zoom controls (70px).
     */
    <div
      className="leaflet-top leaflet-right"
      style={{ marginTop: 70, pointerEvents: "auto" }}
    >
      <div className="leaflet-control leaflet-bar" style={{ border: "none" }}>

        {/* ── Main locate button ─────────────────────────────────────────── */}
        <button
          onClick={locate}
          disabled={isRequesting}
          title={
            isLocated
              ? `Located — ±${Math.round(userLocation?.accuracy ?? 0)} m · Click to update`
              : isRequesting
              ? "Locating…"
              : isError
              ? "Try again"
              : "Go to my location"
          }
          style={{
            width: 34,
            height: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isLocated ? "#2563eb" : "#1f2937",
            color: isLocated ? "#ffffff" : "#d1d5db",
            border: isError
              ? "1.5px solid #f87171"
              : isLocated
              ? "1.5px solid #3b82f6"
              : "1.5px solid #374151",
            borderRadius: 6,
            cursor: isRequesting ? "not-allowed" : "pointer",
            boxShadow: "0 1px 5px rgba(0,0,0,0.4)",
            transition: "background 0.2s, color 0.2s, border-color 0.2s",
            padding: 0,
          }}
        >
          {isRequesting ? (
            /* Spinning indicator */
            <span
              style={{
                display: "inline-block",
                fontSize: 18,
                lineHeight: 1,
                animation: "agri-spin 1s linear infinite",
              }}
            >
              ⟳
            </span>
          ) : (
            /* Crosshair icon */
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <line x1="12" y1="2"  x2="12" y2="7"  />
              <line x1="12" y1="17" x2="12" y2="22" />
              <line x1="2"  y1="12" x2="7"  y2="12" />
              <line x1="17" y1="12" x2="22" y2="12" />
            </svg>
          )}
        </button>

        {/* ── Accuracy badge (located state) ────────────────────────────── */}
        {isLocated && userLocation && (
          <div
            style={{
              marginTop: 6,
              background: "#1f2937",
              color: "#93c5fd",
              border: "1px solid #1d4ed8",
              padding: "3px 8px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: "nowrap",
              textAlign: "center",
              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
            }}
          >
            ±{Math.round(userLocation.accuracy)} m
          </div>
        )}

        {/* ── Error toast (error state) ──────────────────────────────────── */}
        {isError && locationError && (
          <div
            style={{
              marginTop: 6,
              background: "#450a0a",
              color: "#fca5a5",
              border: "1px solid #7f1d1d",
              padding: "8px 10px",
              borderRadius: 6,
              fontSize: 11,
              lineHeight: 1.5,
              maxWidth: 220,
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            }}
          >
            {locationError}
          </div>
        )}

      </div>

      {/* ── Spin keyframe (scoped to avoid conflicts) ──────────────────────── */}
      <style>{`
        @keyframes agri-spin {
          from { transform: rotate(0deg);   }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuid } from "uuid";

/**
 * Generate a random pastel hex colour.
 * Pastel = high lightness, low-ish saturation HSL converted to hex.
 */
function randomPastelColor() {
  const hue = Math.floor(Math.random() * 360);
  const sat = 50 + Math.floor(Math.random() * 20);
  const lit = 70 + Math.floor(Math.random() * 15);
  const s = sat / 100;
  const l = lit / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + hue / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Hardcoded fallback crop list matching backend seed data.
 * Used when the API is unreachable.
 */
export const FALLBACK_CROPS = [
  {
    id: "crop-001",
    _id: "crop-001",
    name: "Rice",
    avgYieldPerSqm: 0.45,
    marketPrice: 0.8,
    waterNeeds: "high",
    growthDurationDays: 120,
    suitableSeason: ["rainy"],
    color: "#f59e0b",
  },
  {
    id: "crop-002",
    _id: "crop-002",
    name: "Maize",
    avgYieldPerSqm: 0.6,
    marketPrice: 0.5,
    waterNeeds: "medium",
    growthDurationDays: 90,
    suitableSeason: ["rainy", "dry"],
    color: "#eab308",
  },
  {
    id: "crop-003",
    _id: "crop-003",
    name: "Wheat",
    avgYieldPerSqm: 0.35,
    marketPrice: 0.6,
    waterNeeds: "medium",
    growthDurationDays: 110,
    suitableSeason: ["dry"],
    color: "#d97706",
  },
  {
    id: "crop-004",
    _id: "crop-004",
    name: "Sorghum",
    avgYieldPerSqm: 0.4,
    marketPrice: 0.45,
    waterNeeds: "low",
    growthDurationDays: 100,
    suitableSeason: ["dry"],
    color: "#dc2626",
  },
  {
    id: "crop-005",
    _id: "crop-005",
    name: "Cassava",
    avgYieldPerSqm: 1.2,
    marketPrice: 0.3,
    waterNeeds: "low",
    growthDurationDays: 270,
    suitableSeason: ["dry", "rainy"],
    color: "#7c3aed",
  },
  {
    id: "crop-006",
    _id: "crop-006",
    name: "Tomato",
    avgYieldPerSqm: 2.5,
    marketPrice: 1.2,
    waterNeeds: "high",
    growthDurationDays: 75,
    suitableSeason: ["dry"],
    color: "#ef4444",
  },
  {
    id: "crop-007",
    _id: "crop-007",
    name: "Pepper",
    avgYieldPerSqm: 1.8,
    marketPrice: 1.5,
    waterNeeds: "medium",
    growthDurationDays: 90,
    suitableSeason: ["dry", "rainy"],
    color: "#f97316",
  },
  {
    id: "crop-008",
    _id: "crop-008",
    name: "Groundnut",
    avgYieldPerSqm: 0.3,
    marketPrice: 1.1,
    waterNeeds: "low",
    growthDurationDays: 120,
    suitableSeason: ["rainy"],
    color: "#84cc16",
  },
];

const useFarmStore = create(
  persist(
    (set, get) => ({
      // ── Drawing mode ──────────────────────────────────────────────────────────
      mode: "boundary", // "boundary" | "zone" | "select"

      // ── Geometry (geographic coordinates) ─────────────────────────────────────
      boundary: [], // [{lat, lng}]  — finalised farm boundary
      currentPoints: [], // [{lat, lng}]  — in-progress drawing (NOT persisted)
      zones: [], // Zone[]  — each has { id, name, coordinates:[{lat,lng}], cropId, color }
      selectedZoneId: null,

      // ── Farm metadata ─────────────────────────────────────────────────────────
      farmName: "My Farm",
      season: "dry",
      soilType: "loam",

      // ── Backend sync ──────────────────────────────────────────────────────────
      savedFarmId: null,

      // ── Crops (loaded from API, falls back to FALLBACK_CROPS) ─────────────────
      crops: [],

      // ── Map view state ────────────────────────────────────────────────────────
      // Default: Phnom Penh, Cambodia (agricultural region)
      mapCenter: [11.5624, 104.9282],
      mapZoom: 15,

      // ── User location state machine ───────────────────────────────────────────
      // 'idle' → 'requesting' → 'located' | 'error'
      locationState: "idle", // 'idle' | 'requesting' | 'located' | 'error'
      userLocation: null, // { lat, lng, accuracy } when located
      locationError: null, // string error message when in 'error' state

      // ═══════════════════════════════════════════════════════════════════════════
      // Actions
      // ═══════════════════════════════════════════════════════════════════════════

      /** Switch drawing/interaction mode. Clears in-progress points. */
      setMode: (mode) => set({ mode, currentPoints: [] }),

      /** Update the map viewport (used by locate-me and programmatic navigation). */
      setMapView: (center, zoom) => set({ mapCenter: center, mapZoom: zoom }),

      // ── Location actions ──────────────────────────────────────────────────────

      /** Mark that a geolocation request is in-flight. */
      setLocationRequesting: () =>
        set({ locationState: "requesting", locationError: null }),

      /** Store the resolved location and transition to 'located'. */
      setUserLocation: (loc) =>
        set({ userLocation: loc, locationState: "located", locationError: null }),

      /** Store the error message and transition to 'error'. */
      setLocationError: (msg) =>
        set({ locationError: msg, locationState: "error" }),

      /** Reset location state back to idle (allows re-requesting). */
      resetLocation: () =>
        set({ locationState: "idle", userLocation: null, locationError: null }),

      // ── Boundary actions ──────────────────────────────────────────────────────

      /** Append a {lat, lng} point to the in-progress boundary. */
      addBoundaryPoint: (latlng) =>
        set((state) => ({ currentPoints: [...state.currentPoints, latlng] })),

      /**
       * Finalise the boundary: move currentPoints → boundary.
       * Requires at least 3 points to form a valid polygon.
       * Auto-advances mode to "zone".
       */
      closeBoundary: () =>
        set((state) => {
          if (state.currentPoints.length < 3) return {};
          return {
            boundary: [...state.currentPoints],
            currentPoints: [],
            mode: "zone",
          };
        }),

      /** Discard the boundary and all zones (full geometry reset). */
      clearBoundary: () =>
        set({ boundary: [], currentPoints: [], zones: [], selectedZoneId: null }),

      // ── Zone actions ──────────────────────────────────────────────────────────

      /** Append a {lat, lng} point to the in-progress zone polygon. */
      addZonePoint: (latlng) =>
        set((state) => ({ currentPoints: [...state.currentPoints, latlng] })),

      /**
       * Finalise the zone: create a Zone object from currentPoints.
       * Requires at least 3 points.
       */
      closeZone: () =>
        set((state) => {
          if (state.currentPoints.length < 3) return {};
          const newZone = {
            id: uuid(),
            name: `Zone ${state.zones.length + 1}`,
            coordinates: [...state.currentPoints], // [{lat, lng}]
            cropId: null,
            color: randomPastelColor(),
          };
          return { zones: [...state.zones, newZone], currentPoints: [] };
        }),

      /** Select a zone by id (pass null to deselect). */
      selectZone: (id) => set({ selectedZoneId: id }),

      /**
       * Assign a crop to a zone.
       * @param {string} zoneId
       * @param {string|null} cropId
       */
      assignCrop: (zoneId, cropId) =>
        set((state) => ({
          zones: state.zones.map((z) => (z.id === zoneId ? { ...z, cropId } : z)),
        })),

      /** Remove a zone by id. */
      deleteZone: (id) =>
        set((state) => ({
          zones: state.zones.filter((z) => z.id !== id),
          selectedZoneId: state.selectedZoneId === id ? null : state.selectedZoneId,
        })),

      // ── Crops ─────────────────────────────────────────────────────────────────

      /** Store crops fetched from the API (or fallback list). */
      setCrops: (crops) => set({ crops }),

      // ── Farm metadata ─────────────────────────────────────────────────────────

      /**
       * Update farm-level metadata fields (partial update supported).
       * @param {{ farmName?: string, season?: string, soilType?: string }} meta
       */
      setFarmMeta: ({ farmName, season, soilType }) =>
        set((state) => ({
          farmName: farmName ?? state.farmName,
          season: season ?? state.season,
          soilType: soilType ?? state.soilType,
        })),

      // ── Backend ───────────────────────────────────────────────────────────────

      /** Store the MongoDB id returned after a successful save. */
      setSavedFarmId: (id) => set({ savedFarmId: id }),

      // ── Reset ─────────────────────────────────────────────────────────────────

      /** Reset everything back to initial state (preserve loaded crops). */
      resetAll: () =>
        set((state) => ({
          mode: "boundary",
          boundary: [],
          currentPoints: [],
          zones: [],
          selectedZoneId: null,
          farmName: "My Farm",
          season: "dry",
          soilType: "loam",
          savedFarmId: null,
          crops: state.crops, // preserve loaded crops
        })),
    }),
    {
      name: "agriplan-farm-editor", // localStorage key
      // Only persist geometry and metadata — skip volatile UI state
      partialize: (state) => ({
        boundary: state.boundary,
        zones: state.zones,
        farmName: state.farmName,
        season: state.season,
        soilType: state.soilType,
        savedFarmId: state.savedFarmId,
        mapCenter: state.mapCenter,
        mapZoom: state.mapZoom,
        mode: state.mode,
        crops: state.crops,
      }),
    },
  ),
);

export default useFarmStore;

import axios from "axios";

// In production (Netlify) set VITE_API_URL to your deployed backend URL,
// e.g. https://my-agriplan-api.onrender.com/api
// In local dev the Vite proxy rewrites /api → http://localhost:5000 so the
// fallback "/api" keeps working without any changes.
const BASE = import.meta.env.VITE_API_URL ?? "/api";

// Shared axios instance with sensible defaults
const http = axios.create({
  baseURL: BASE,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// Response interceptor — unwrap .data automatically
http.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message ||
      "An unexpected error occurred";
    return Promise.reject(new Error(message));
  },
);

export const farmsApi = {
  /**
   * Create a new farm.
   * @param {{ name: string, soilType: string, season: string, boundary: Array<{x,y}> }} data
   */
  create: (data) => http.post("/farms", data),

  /**
   * Fetch a farm by its MongoDB ID.
   * @param {string} id
   */
  getById: (id) => http.get(`/farms/${id}`),
};

export const zonesApi = {
  /**
   * Create a new zone record.
   * @param {{ farmId: string, name: string, coordinates: Array<{x,y}>, cropId: string|null, area: number, color: string }} data
   */
  create: (data) => http.post("/zones", data),

  /**
   * Get all zones belonging to a farm.
   * @param {string} farmId
   */
  getByFarm: (farmId) => http.get(`/zones/farm/${farmId}`),

  /**
   * Update a zone (e.g. reassign crop).
   * @param {string} id
   * @param {object} data
   */
  update: (id, data) => http.put(`/zones/${id}`, data),

  /**
   * Delete a zone.
   * @param {string} id
   */
  delete: (id) => http.delete(`/zones/${id}`),
};

export const cropsApi = {
  /** Fetch all available crop definitions. */
  getAll: () => http.get("/crops"),
};

export const layoutsApi = {
  create: (data) => http.post("/layouts", data),
  getAll: (params) => http.get("/layouts", { params }),
  getById: (id) => http.get(`/layouts/${id}`),
  update: (id, data) => http.put(`/layouts/${id}`, data),
  delete: (id) => http.delete(`/layouts/${id}`),
  updateZoneRowPlan: (layoutId, zoneId, rowPlan) =>
    http.patch(`/layouts/${layoutId}/zones/${zoneId}/rowplan`, { rowPlan }),
};

export const sensorsApi = {
  ingest: (data) => http.post("/sensors/readings", data),
  getLatest: (farmId) => http.get(`/sensors/latest/${farmId}`),
  getZoneReadings: (farmId, zoneId, params) =>
    http.get(`/sensors/zone/${farmId}/${zoneId}`, { params }),
  getDevices: (farmId) => http.get(`/sensors/devices/farm/${farmId}`),
  registerDevice: (data) => http.post("/sensors/devices", data),
  updateDevice: (deviceId, data) =>
    http.put(`/sensors/devices/${deviceId}`, data),
};

import * as turf from "@turf/turf";
import { latlngsToGeoJSON } from "./geometry.js";

// Litres of water needed per square metre, keyed by crop waterNeeds level
const waterFactors = { low: 5, medium: 10, high: 20 };

/**
 * Calculate geodesic area in m² for a {lat,lng} polygon using Turf.js.
 * Uses WGS84 ellipsoid — accurate for real geographic coordinates.
 * @param {Array<{lat: number, lng: number}>} latlngs
 * @returns {number} area in m²
 */
export function calculateAreaSqm(latlngs) {
  if (!latlngs || latlngs.length < 3) return 0;
  const geojson = latlngsToGeoJSON(latlngs);
  if (!geojson) return 0;
  return turf.area(geojson); // returns m² directly, WGS84 geodesic
}

/**
 * Calculate stats for a single zone/crop pairing.
 * @param {{ coordinates: Array<{lat: number, lng: number}> }} zone
 * @param {{ avgYieldPerSqm: number, marketPrice: number, waterNeeds: string } | null} crop
 * @returns {{ areaSqm: number, yieldKg: number, revenue: number, waterL: number }}
 */
export function calculateZoneStats(zone, crop) {
  const areaSqm = calculateAreaSqm(zone.coordinates);

  if (!crop) {
    return {
      areaSqm: Math.round(areaSqm * 100) / 100,
      yieldKg: 0,
      revenue: 0,
      waterL: 0,
    };
  }

  const yieldKg = areaSqm * (crop.avgYieldPerSqm ?? 0);
  const revenue = yieldKg * (crop.marketPrice ?? 0);
  const waterL =
    areaSqm * (waterFactors[crop.waterNeeds] ?? waterFactors.medium);

  return {
    areaSqm: Math.round(areaSqm * 100) / 100,
    yieldKg: Math.round(yieldKg * 100) / 100,
    revenue: Math.round(revenue * 100) / 100,
    waterL: Math.round(waterL * 100) / 100,
  };
}

/**
 * Aggregate stats across all farm zones.
 * @param {Array} zones   — zone objects from the store
 * @param {Array} crops   — crop objects from the store
 * @returns {{
 *   totalArea: number,
 *   totalYield: number,
 *   totalRevenue: number,
 *   totalWater: number,
 *   zoneStats: Array<{ zone, crop, areaSqm, yieldKg, revenue, waterL }>
 * }}
 */
export function calculateFarmStats(zones, crops) {
  let totalArea = 0;
  let totalYield = 0;
  let totalRevenue = 0;
  let totalWater = 0;

  const zoneStats = zones.map((zone) => {
    const crop =
      crops.find((c) => c._id === zone.cropId || c.id === zone.cropId) ?? null;
    const stats = calculateZoneStats(zone, crop);

    totalArea += stats.areaSqm;
    totalYield += stats.yieldKg;
    totalRevenue += stats.revenue;
    totalWater += stats.waterL;

    return { zone, crop, ...stats };
  });

  return {
    totalArea: Math.round(totalArea * 100) / 100,
    totalYield: Math.round(totalYield * 100) / 100,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalWater: Math.round(totalWater * 100) / 100,
    zoneStats,
  };
}

/**
 * Point-in-polygon using ray-casting for {lat, lng} coords.
 * @param {{lat: number, lng: number}} point
 * @param {Array<{lat: number, lng: number}>} polygon
 * @returns {boolean}
 */
export function isPointInPolygon(point, polygon) {
  if (!polygon || polygon.length < 3) return false;
  const { lat: y, lng: x } = point;
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Get centroid of a {lat, lng} polygon (arithmetic mean — sufficient for UI purposes).
 * @param {Array<{lat: number, lng: number}>} points
 * @returns {{lat: number, lng: number}}
 */
export function getPolygonCentroid(points) {
  if (!points || points.length === 0) return { lat: 0, lng: 0 };
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

/**
 * Convert an array of {lat, lng} to a GeoJSON Polygon Feature for Turf.js.
 * Turf requires [lng, lat] coordinate order and a closed ring (first === last).
 * @param {Array<{lat: number, lng: number}>} latlngs
 * @returns {object|null} GeoJSON Feature<Polygon>
 */
export function latlngsToGeoJSON(latlngs) {
  if (!latlngs || latlngs.length < 3) return null;
  // Build ring in [lng, lat] order
  const coords = latlngs.map((p) => [p.lng, p.lat]);
  // Close the ring by repeating the first point
  coords.push(coords[0]);
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [coords],
    },
  };
}

/**
 * Check if all vertices of a zone polygon are inside the boundary polygon.
 * @param {Array<{lat: number, lng: number}>} zonePoints
 * @param {Array<{lat: number, lng: number}>} boundaryPoints
 * @returns {boolean}
 */
export function isZoneInsideBoundary(zonePoints, boundaryPoints) {
  if (!boundaryPoints || boundaryPoints.length < 3) return true; // no boundary yet
  if (!zonePoints || zonePoints.length < 3) return false;
  return zonePoints.every((pt) => isPointInPolygon(pt, boundaryPoints));
}

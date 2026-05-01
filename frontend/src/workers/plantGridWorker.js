/**
 * Plant Grid Web Worker
 *
 * Computes grid points inside a polygon using ray-casting.
 * Runs off the main thread so the UI stays responsive for large grids.
 *
 * Input message:  { coords: [{lat,lng}], rows: number, columns: number }
 * Output messages:
 *   { type: 'progress', value: 0-100 }
 *   { type: 'done', points: Float32Array } -- transferred (zero-copy)
 */

/** Ray-casting point-in-polygon test. */
function isInside(lat, lng, coords) {
  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i].lat, yi = coords[i].lng;
    const xj = coords[j].lat, yj = coords[j].lng;
    if (((yi > lng) !== (yj > lng)) &&
        (lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

self.onmessage = function (e) {
  const { coords, rows, columns } = e.data;

  // Bounding box
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  for (const { lat, lng } of coords) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  const latRange = maxLat - minLat;
  const lngRange = maxLng - minLng;

  // Pre-alloc result buffer (worst case = rows*columns*2 floats)
  // We grow dynamically via a normal array then copy at the end
  const result = [];

  // Report progress roughly 200 times across the row loop
  const reportEvery = Math.max(1, Math.floor(rows / 200));

  for (let r = 0; r < rows; r++) {
    const lat = minLat + ((r + 0.5) / rows) * latRange;
    for (let c = 0; c < columns; c++) {
      const lng = minLng + ((c + 0.5) / columns) * lngRange;
      if (isInside(lat, lng, coords)) {
        result.push(lat, lng);
      }
    }

    if (r % reportEvery === 0 || r === rows - 1) {
      self.postMessage({
        type: 'progress',
        value: Math.round(((r + 1) / rows) * 100),
      });
    }
  }

  // Transfer as Float32Array — zero-copy via Transferable
  const arr = new Float32Array(result);
  self.postMessage({ type: 'done', points: arr }, [arr.buffer]);
};

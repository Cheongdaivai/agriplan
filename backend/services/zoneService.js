const Zone = require("../models/Zone");
const Farm = require("../models/Farm");
const turf = require("@turf/turf");

/**
 * Calculates the geodesic area of a polygon defined by {lat, lng} vertices
 * using Turf.js (spherical excess formula on the WGS84 ellipsoid).
 * Returns area in square metres. Returns 0 for degenerate/empty polygons.
 *
 * @param {Array<{lat: number, lng: number}>} points
 * @returns {number} Area in m²
 */
const calculatePolygonArea = (points) => {
  if (!Array.isArray(points) || points.length < 3) return 0;
  try {
    // GeoJSON uses [lng, lat] order; close the ring by repeating first point
    const coords = points.map((p) => [p.lng, p.lat]);
    coords.push(coords[0]);
    const polygon = turf.polygon([coords]);
    return turf.area(polygon); // returns m²
  } catch {
    return 0;
  }
};

/**
 * Creates a new zone for a farm.
 * Validates that the referenced farm exists.
 * Automatically calculates the polygon area from coordinates.
 *
 * @param {Object} data - Validated zone payload.
 * @returns {Promise<Zone>}
 */
const createZone = async (data) => {
  // Verify parent farm exists
  const farmExists = await Farm.exists({ _id: data.farmId });
  if (!farmExists) {
    const err = new Error(`Farm not found with id: ${data.farmId}`);
    err.statusCode = 404;
    throw err;
  }

  // Auto-calculate area if coordinates supplied and area not provided
  if (
    data.coordinates &&
    data.coordinates.length >= 3 &&
    data.area === undefined
  ) {
    data.area = calculatePolygonArea(data.coordinates);
  }

  const zone = await Zone.create(data);
  return zone.populate("cropId");
};

/**
 * Returns all zones for a specific farm, including crop details.
 * Validates that the referenced farm exists first.
 *
 * @param {string} farmId - Farm ObjectId.
 * @returns {Promise<Zone[]>}
 */
const getZonesByFarm = async (farmId) => {
  const farmExists = await Farm.exists({ _id: farmId });
  if (!farmExists) {
    const err = new Error(`Farm not found with id: ${farmId}`);
    err.statusCode = 404;
    throw err;
  }

  const zones = await Zone.find({ farmId })
    .populate(
      "cropId",
      "name avgYieldPerSqm marketPrice waterNeeds growthDurationDays suitableSeason color",
    )
    .sort({ createdAt: -1 })
    .lean();

  return zones;
};

/**
 * Returns a single zone by ID with crop details populated.
 * Throws 404 if not found.
 *
 * @param {string} id - Zone ObjectId.
 * @returns {Promise<Zone>}
 */
const getZoneById = async (id) => {
  const zone = await Zone.findById(id)
    .populate(
      "cropId",
      "name avgYieldPerSqm marketPrice waterNeeds growthDurationDays suitableSeason color",
    )
    .lean();

  if (!zone) {
    const err = new Error(`Zone not found with id: ${id}`);
    err.statusCode = 404;
    throw err;
  }
  return zone;
};

/**
 * Updates a zone by ID.
 * Recalculates area automatically when coordinates are updated.
 * Throws 404 if not found.
 *
 * @param {string} id - Zone ObjectId.
 * @param {Object} data - Fields to update.
 * @returns {Promise<Zone>}
 */
const updateZone = async (id, data) => {
  // If coordinates are being updated, recalculate area unless caller specified it
  if (
    data.coordinates &&
    data.coordinates.length >= 3 &&
    data.area === undefined
  ) {
    data.area = calculatePolygonArea(data.coordinates);
  }

  // Allow unsetting cropId by passing null
  if (data.cropId === null || data.cropId === "") {
    data.cropId = null;
  }

  const zone = await Zone.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true },
  ).populate(
    "cropId",
    "name avgYieldPerSqm marketPrice waterNeeds growthDurationDays suitableSeason color",
  );

  if (!zone) {
    const err = new Error(`Zone not found with id: ${id}`);
    err.statusCode = 404;
    throw err;
  }
  return zone;
};

/**
 * Deletes a zone by ID.
 * Throws 404 if not found.
 *
 * @param {string} id - Zone ObjectId.
 * @returns {Promise<Zone>}
 */
const deleteZone = async (id) => {
  const zone = await Zone.findByIdAndDelete(id).lean();
  if (!zone) {
    const err = new Error(`Zone not found with id: ${id}`);
    err.statusCode = 404;
    throw err;
  }
  return zone;
};

/**
 * Computes a yield/revenue summary for a zone that has a crop assigned.
 *
 * @param {string} id - Zone ObjectId.
 * @returns {Promise<Object>}
 */
const getZoneYieldSummary = async (id) => {
  const zone = await Zone.findById(id)
    .populate(
      "cropId",
      "name avgYieldPerSqm marketPrice waterNeeds growthDurationDays suitableSeason color",
    )
    .lean();

  if (!zone) {
    const err = new Error(`Zone not found with id: ${id}`);
    err.statusCode = 404;
    throw err;
  }

  if (!zone.cropId) {
    return {
      zoneId: zone._id,
      zoneName: zone.name,
      area: zone.area,
      crop: null,
      estimatedYieldKg: 0,
      estimatedRevenueUSD: 0,
    };
  }

  const crop = zone.cropId;
  const estimatedYieldKg = parseFloat(
    (zone.area * crop.avgYieldPerSqm).toFixed(4),
  );
  const estimatedRevenueUSD = parseFloat(
    (estimatedYieldKg * crop.marketPrice).toFixed(4),
  );

  return {
    zoneId: zone._id,
    zoneName: zone.name,
    area: zone.area,
    crop: {
      id: crop._id,
      name: crop.name,
      avgYieldPerSqm: crop.avgYieldPerSqm,
      marketPrice: crop.marketPrice,
      waterNeeds: crop.waterNeeds,
      growthDurationDays: crop.growthDurationDays,
      suitableSeason: crop.suitableSeason,
      color: crop.color,
    },
    estimatedYieldKg,
    estimatedRevenueUSD,
  };
};

module.exports = {
  calculatePolygonArea,
  createZone,
  getZonesByFarm,
  getZoneById,
  updateZone,
  deleteZone,
  getZoneYieldSummary,
};

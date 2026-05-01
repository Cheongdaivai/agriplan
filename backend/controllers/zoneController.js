const asyncHandler = require('../middleware/asyncHandler');
const zoneService = require('../services/zoneService');

/**
 * POST /api/zones
 * Creates a new zone.  Area is auto-calculated from coordinates if not supplied.
 */
const createZone = asyncHandler(async (req, res) => {
  const zone = await zoneService.createZone(req.body);
  return res.status(201).json({
    success: true,
    data: zone,
    error: null,
  });
});

/**
 * GET /api/zones/farm/:farmId
 * Returns all zones belonging to a farm, with crop details populated.
 */
const getZonesByFarm = asyncHandler(async (req, res) => {
  const zones = await zoneService.getZonesByFarm(req.params.farmId);
  return res.status(200).json({
    success: true,
    data: zones,
    error: null,
  });
});

/**
 * GET /api/zones/:id
 * Returns a single zone with crop details populated.
 */
const getZoneById = asyncHandler(async (req, res) => {
  const zone = await zoneService.getZoneById(req.params.id);
  return res.status(200).json({
    success: true,
    data: zone,
    error: null,
  });
});

/**
 * PUT /api/zones/:id
 * Updates a zone.  Area is recalculated automatically when coordinates change.
 */
const updateZone = asyncHandler(async (req, res) => {
  const zone = await zoneService.updateZone(req.params.id, req.body);
  return res.status(200).json({
    success: true,
    data: zone,
    error: null,
  });
});

/**
 * DELETE /api/zones/:id
 * Deletes a single zone.
 */
const deleteZone = asyncHandler(async (req, res) => {
  const zone = await zoneService.deleteZone(req.params.id);
  return res.status(200).json({
    success: true,
    data: { deleted: zone },
    error: null,
  });
});

/**
 * GET /api/zones/:id/yield
 * Returns estimated yield (kg) and revenue (USD) for a zone based on
 * its area and assigned crop.
 */
const getZoneYieldSummary = asyncHandler(async (req, res) => {
  const summary = await zoneService.getZoneYieldSummary(req.params.id);
  return res.status(200).json({
    success: true,
    data: summary,
    error: null,
  });
});

module.exports = {
  createZone,
  getZonesByFarm,
  getZoneById,
  updateZone,
  deleteZone,
  getZoneYieldSummary,
};

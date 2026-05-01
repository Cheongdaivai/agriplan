const asyncHandler = require('../middleware/asyncHandler');
const farmService = require('../services/farmService');

/**
 * POST /api/farms
 * Creates a new farm.
 */
const createFarm = asyncHandler(async (req, res) => {
  const farm = await farmService.createFarm(req.body);
  return res.status(201).json({
    success: true,
    data: farm,
    error: null,
  });
});

/**
 * GET /api/farms
 * Returns all farms sorted by creation date (newest first).
 */
const getAllFarms = asyncHandler(async (req, res) => {
  const farms = await farmService.getAllFarms();
  return res.status(200).json({
    success: true,
    data: farms,
    error: null,
  });
});

/**
 * GET /api/farms/:id
 * Returns a single farm by its ID.
 */
const getFarmById = asyncHandler(async (req, res) => {
  const farm = await farmService.getFarmById(req.params.id);
  return res.status(200).json({
    success: true,
    data: farm,
    error: null,
  });
});

/**
 * PUT /api/farms/:id
 * Updates a farm's fields.
 */
const updateFarm = asyncHandler(async (req, res) => {
  const farm = await farmService.updateFarm(req.params.id, req.body);
  return res.status(200).json({
    success: true,
    data: farm,
    error: null,
  });
});

/**
 * DELETE /api/farms/:id
 * Deletes a farm and all its child zones.
 */
const deleteFarm = asyncHandler(async (req, res) => {
  const result = await farmService.deleteFarm(req.params.id);
  return res.status(200).json({
    success: true,
    data: {
      deleted: result.farm,
      deletedZoneCount: result.deletedZoneCount,
    },
    error: null,
  });
});

module.exports = {
  createFarm,
  getAllFarms,
  getFarmById,
  updateFarm,
  deleteFarm,
};

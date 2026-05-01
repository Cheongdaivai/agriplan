const asyncHandler = require('../middleware/asyncHandler');
const cropService = require('../services/cropService');

/**
 * GET /api/crops
 * Returns all crops.
 * Supports ?season=dry|rainy and ?waterNeeds=low|medium|high query filters.
 */
const getAllCrops = asyncHandler(async (req, res) => {
  const { season, waterNeeds } = req.query;
  const crops = await cropService.getAllCrops({ season, waterNeeds });
  return res.status(200).json({
    success: true,
    data: crops,
    error: null,
  });
});

/**
 * GET /api/crops/:id
 * Returns a single crop by ID.
 */
const getCropById = asyncHandler(async (req, res) => {
  const crop = await cropService.getCropById(req.params.id);
  return res.status(200).json({
    success: true,
    data: crop,
    error: null,
  });
});

/**
 * POST /api/crops
 * Creates a new crop (admin / seed route).
 * Returns 200 if the crop already exists (idempotent), 201 if newly created.
 */
const createCrop = asyncHandler(async (req, res) => {
  const { crop, created } = await cropService.createCrop(req.body);
  return res.status(created ? 201 : 200).json({
    success: true,
    data: crop,
    error: null,
  });
});

module.exports = {
  getAllCrops,
  getCropById,
  createCrop,
};

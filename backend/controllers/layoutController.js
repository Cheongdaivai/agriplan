const asyncHandler = require('../middleware/asyncHandler');
const layoutService = require('../services/layoutService');

/**
 * POST /api/layouts
 * Creates a new FarmLayout from the editor state payload.
 */
const createLayout = asyncHandler(async (req, res) => {
  const layout = await layoutService.createLayout(req.body);
  return res.status(201).json({
    success: true,
    data:    layout,
    error:   null,
  });
});

/**
 * GET /api/layouts
 * Returns all layouts, optionally filtered by ?farmId= and/or ?isTemplate=
 */
const getAllLayouts = asyncHandler(async (req, res) => {
  const filters = {
    farmId:     req.query.farmId,
    isTemplate: req.query.isTemplate,
  };
  const layouts = await layoutService.getAllLayouts(filters);
  return res.status(200).json({
    success: true,
    data:    layouts,
    error:   null,
  });
});

/**
 * GET /api/layouts/:id
 * Returns a single layout by MongoDB ObjectId.
 */
const getLayoutById = asyncHandler(async (req, res) => {
  const layout = await layoutService.getLayoutById(req.params.id);
  return res.status(200).json({
    success: true,
    data:    layout,
    error:   null,
  });
});

/**
 * PUT /api/layouts/:id
 * Updates a layout's name, description, metadata, zones, tags, etc.
 */
const updateLayout = asyncHandler(async (req, res) => {
  const layout = await layoutService.updateLayout(req.params.id, req.body);
  return res.status(200).json({
    success: true,
    data:    layout,
    error:   null,
  });
});

/**
 * DELETE /api/layouts/:id
 * Permanently deletes a layout.
 */
const deleteLayout = asyncHandler(async (req, res) => {
  const deleted = await layoutService.deleteLayout(req.params.id);
  return res.status(200).json({
    success: true,
    data:    { deleted },
    error:   null,
  });
});

/**
 * PATCH /api/layouts/:id/zones/:zoneId/rowplan
 * Updates the rowPlan of a single embedded zone within a layout.
 * Body: { rowPlan: { rows, columns, spacingM, orientation } }
 */
const updateZoneRowPlan = asyncHandler(async (req, res) => {
  const { id, zoneId } = req.params;
  // Accept rowPlan nested under a key or flat in body
  const rowPlan = req.body.rowPlan ?? req.body;
  const layout = await layoutService.updateZoneRowPlan(id, zoneId, rowPlan);
  return res.status(200).json({
    success: true,
    data:    layout,
    error:   null,
  });
});

module.exports = {
  createLayout,
  getAllLayouts,
  getLayoutById,
  updateLayout,
  deleteLayout,
  updateZoneRowPlan,
};

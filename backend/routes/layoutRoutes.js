const express = require('express');
const router = express.Router();

const layoutController = require('../controllers/layoutController');
const { mongoIdParam, handleValidationErrors } = require('../middleware/validate');

// POST /api/layouts — create a layout from editor state
router.post('/', layoutController.createLayout);

// GET /api/layouts — list all (optional ?farmId= / ?isTemplate= filters)
router.get('/', layoutController.getAllLayouts);

// GET /api/layouts/:id — fetch a single layout
router.get(
  '/:id',
  mongoIdParam('id'),
  handleValidationErrors,
  layoutController.getLayoutById
);

// PUT /api/layouts/:id — update a layout
router.put(
  '/:id',
  mongoIdParam('id'),
  handleValidationErrors,
  layoutController.updateLayout
);

// DELETE /api/layouts/:id — remove a layout
router.delete(
  '/:id',
  mongoIdParam('id'),
  handleValidationErrors,
  layoutController.deleteLayout
);

// PATCH /api/layouts/:id/zones/:zoneId/rowplan — update one zone's rowPlan
router.patch(
  '/:id/zones/:zoneId/rowplan',
  mongoIdParam('id'),
  handleValidationErrors,
  layoutController.updateZoneRowPlan
);

module.exports = router;

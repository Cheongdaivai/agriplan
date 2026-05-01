const express = require('express');
const router = express.Router();

const zoneController = require('../controllers/zoneController');
const {
  zoneValidationRules,
  mongoIdParam,
  handleValidationErrors,
} = require('../middleware/validate');

// POST /api/zones — create a zone
router.post(
  '/',
  zoneValidationRules,
  handleValidationErrors,
  zoneController.createZone
);

// GET /api/zones/farm/:farmId — all zones for a farm
// NOTE: this route must come BEFORE /:id to avoid "farm" being parsed as an id
router.get(
  '/farm/:farmId',
  mongoIdParam('farmId'),
  handleValidationErrors,
  zoneController.getZonesByFarm
);

// GET /api/zones/:id/yield — yield summary for a zone
router.get(
  '/:id/yield',
  mongoIdParam('id'),
  handleValidationErrors,
  zoneController.getZoneYieldSummary
);

// GET /api/zones/:id — get one zone
router.get(
  '/:id',
  mongoIdParam('id'),
  handleValidationErrors,
  zoneController.getZoneById
);

// PUT /api/zones/:id — update a zone
router.put(
  '/:id',
  mongoIdParam('id'),
  zoneValidationRules,
  handleValidationErrors,
  zoneController.updateZone
);

// DELETE /api/zones/:id — delete a zone
router.delete(
  '/:id',
  mongoIdParam('id'),
  handleValidationErrors,
  zoneController.deleteZone
);

module.exports = router;

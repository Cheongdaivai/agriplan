const express = require('express');
const router = express.Router();

const farmController = require('../controllers/farmController');
const {
  farmValidationRules,
  mongoIdParam,
  handleValidationErrors,
} = require('../middleware/validate');

// POST /api/farms — create a farm
router.post(
  '/',
  farmValidationRules,
  handleValidationErrors,
  farmController.createFarm
);

// GET /api/farms — list all farms
router.get('/', farmController.getAllFarms);

// GET /api/farms/:id — get one farm
router.get(
  '/:id',
  mongoIdParam('id'),
  handleValidationErrors,
  farmController.getFarmById
);

// PUT /api/farms/:id — update a farm
router.put(
  '/:id',
  mongoIdParam('id'),
  farmValidationRules,
  handleValidationErrors,
  farmController.updateFarm
);

// DELETE /api/farms/:id — delete a farm (cascades to zones)
router.delete(
  '/:id',
  mongoIdParam('id'),
  handleValidationErrors,
  farmController.deleteFarm
);

module.exports = router;

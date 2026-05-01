const express = require('express');
const router = express.Router();

const cropController = require('../controllers/cropController');
const {
  cropValidationRules,
  mongoIdParam,
  handleValidationErrors,
} = require('../middleware/validate');

// GET /api/crops — list all crops (supports ?season= and ?waterNeeds= filters)
router.get('/', cropController.getAllCrops);

// GET /api/crops/:id — get one crop
router.get(
  '/:id',
  mongoIdParam('id'),
  handleValidationErrors,
  cropController.getCropById
);

// POST /api/crops — admin/seed route: create a crop
router.post(
  '/',
  cropValidationRules,
  handleValidationErrors,
  cropController.createCrop
);

module.exports = router;

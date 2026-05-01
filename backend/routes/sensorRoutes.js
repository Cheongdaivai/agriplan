const express = require('express');
const router = express.Router();

const sensorController = require('../controllers/sensorController');
const { mongoIdParam, handleValidationErrors } = require('../middleware/validate');

// ---------------------------------------------------------------------------
// Sensor reading routes
// ---------------------------------------------------------------------------

// POST /api/sensors/readings — ingest a single reading
router.post('/readings', sensorController.ingestReading);

// GET /api/sensors/latest/:farmId — latest reading per (zone, sensorType)
router.get(
  '/latest/:farmId',
  mongoIdParam('farmId'),
  handleValidationErrors,
  sensorController.getLatestByFarm
);

// GET /api/sensors/zone/:farmId/:zoneId — time-series for a zone
//   ?sensorType=soil_moisture  (optional filter)
//   ?limit=100                 (default 100, max 1000)
router.get(
  '/zone/:farmId/:zoneId',
  mongoIdParam('farmId'),
  handleValidationErrors,
  sensorController.getReadingsByZone
);

// ---------------------------------------------------------------------------
// Device routes
// NOTE: /devices/farm/:farmId MUST be registered before /devices/:farmId
//       to prevent Express matching 'farm' as the :farmId segment.
// ---------------------------------------------------------------------------

// GET /api/sensors/devices/farm/:farmId — list all devices for a farm (no enrichment)
router.get(
  '/devices/farm/:farmId',
  mongoIdParam('farmId'),
  handleValidationErrors,
  sensorController.getDevicesByFarm
);

// GET /api/sensors/devices/:farmId — devices enriched with latest readings
router.get(
  '/devices/:farmId',
  mongoIdParam('farmId'),
  handleValidationErrors,
  sensorController.getDeviceStatus
);

// POST /api/sensors/devices — register a new device
router.post('/devices', sensorController.registerDevice);

// PUT /api/sensors/devices/:deviceId — update a device record
router.put('/devices/:deviceId', sensorController.updateDevice);

module.exports = router;

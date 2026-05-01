const asyncHandler = require('../middleware/asyncHandler');
const sensorService = require('../services/sensorService');
const deviceService = require('../services/deviceService');

// ---------------------------------------------------------------------------
// Sensor reading endpoints
// ---------------------------------------------------------------------------

/**
 * POST /api/sensors/readings
 * Ingests a single sensor reading from a device.
 * Body: { farmId, deviceId, sensorType, value, unit?, zoneId?, layoutId?,
 *         deviceType?, location?, recordedAt? }
 */
const ingestReading = asyncHandler(async (req, res) => {
  const reading = await sensorService.ingestReading(req.body);
  return res.status(201).json({
    success: true,
    data:    reading,
    error:   null,
  });
});

/**
 * GET /api/sensors/latest/:farmId
 * Returns the latest reading per (zone, sensorType) combination for a farm.
 */
const getLatestByFarm = asyncHandler(async (req, res) => {
  const readings = await sensorService.getLatestByFarm(req.params.farmId);
  return res.status(200).json({
    success: true,
    data:    readings,
    error:   null,
  });
});

/**
 * GET /api/sensors/zone/:farmId/:zoneId
 * Returns time-series readings for a specific zone.
 * Query params: ?sensorType= (optional), ?limit= (default 100, max 1000)
 */
const getReadingsByZone = asyncHandler(async (req, res) => {
  const { farmId, zoneId } = req.params;
  const { sensorType, limit } = req.query;
  const readings = await sensorService.getReadingsByZone(farmId, zoneId, sensorType, limit);
  return res.status(200).json({
    success: true,
    data:    readings,
    error:   null,
  });
});

/**
 * GET /api/sensors/devices/:farmId
 * Returns all devices for a farm enriched with their latest readings per sensor type.
 */
const getDeviceStatus = asyncHandler(async (req, res) => {
  const enriched = await sensorService.getDeviceStatus(req.params.farmId);
  return res.status(200).json({
    success: true,
    data:    enriched,
    error:   null,
  });
});

// ---------------------------------------------------------------------------
// Device management endpoints
// ---------------------------------------------------------------------------

/**
 * POST /api/sensors/devices
 * Registers a new device for a farm.
 * Body: { farmId, deviceId, name, deviceType, zoneId?, config?, batteryPct? }
 */
const registerDevice = asyncHandler(async (req, res) => {
  const device = await deviceService.registerDevice(req.body);
  return res.status(201).json({
    success: true,
    data:    device,
    error:   null,
  });
});

/**
 * PUT /api/sensors/devices/:deviceId
 * Updates a registered device's fields.
 */
const updateDevice = asyncHandler(async (req, res) => {
  const device = await deviceService.updateDevice(req.params.deviceId, req.body);
  return res.status(200).json({
    success: true,
    data:    device,
    error:   null,
  });
});

/**
 * GET /api/sensors/devices/farm/:farmId
 * Returns all devices registered to a specific farm (without reading enrichment).
 */
const getDevicesByFarm = asyncHandler(async (req, res) => {
  const devices = await deviceService.getDevicesByFarm(req.params.farmId);
  return res.status(200).json({
    success: true,
    data:    devices,
    error:   null,
  });
});

module.exports = {
  ingestReading,
  getLatestByFarm,
  getReadingsByZone,
  getDeviceStatus,
  registerDevice,
  updateDevice,
  getDevicesByFarm,
};

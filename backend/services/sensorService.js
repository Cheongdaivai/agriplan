const mongoose = require('mongoose');
const SensorReading = require('../models/SensorReading');
const deviceService = require('./deviceService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const badRequest = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Valid sensor types
const VALID_SENSOR_TYPES = ['soil_moisture', 'temperature', 'humidity', 'ph', 'npk', 'light'];

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Ingests a single sensor reading and persists it to the database.
 * Also updates the originating device's `lastSeen` and `status` to 'online'.
 *
 * Required fields: farmId, deviceId, sensorType, value.
 *
 * @param {Object} data - Sensor reading payload.
 * @returns {Promise<SensorReading>} The saved reading document.
 */
const ingestReading = async (data) => {
  if (!data.farmId) {
    throw badRequest('farmId is required.');
  }
  if (!isValidId(data.farmId)) {
    throw badRequest(`farmId '${data.farmId}' is not a valid MongoDB ObjectId.`);
  }
  if (!data.deviceId || !String(data.deviceId).trim()) {
    throw badRequest('deviceId is required.');
  }
  if (!data.sensorType) {
    throw badRequest('sensorType is required.');
  }
  if (data.value === undefined || data.value === null) {
    throw badRequest('value is required.');
  }
  if (typeof data.value !== 'number' || isNaN(data.value)) {
    throw badRequest('value must be a number.');
  }

  // Build the reading document
  const reading = await SensorReading.create({
    farmId:     data.farmId,
    layoutId:   data.layoutId && isValidId(data.layoutId) ? data.layoutId : null,
    zoneId:     data.zoneId    || null,
    deviceId:   String(data.deviceId).trim(),
    deviceType: data.deviceType || 'esp32',
    sensorType: data.sensorType,
    value:      data.value,
    unit:       data.unit      || '',
    location: {
      lat: data.location?.lat ?? null,
      lng: data.location?.lng ?? null,
    },
    recordedAt: data.recordedAt ? new Date(data.recordedAt) : new Date(),
  });

  // Fire-and-forget: mark the device as online (best-effort, don't fail ingest)
  deviceService.updateDeviceStatus(String(data.deviceId).trim(), 'online').catch(() => {});

  return reading.toObject();
};

/**
 * Returns the most recent reading for every (zoneId, sensorType) pair
 * belonging to a farm.  Uses a $group aggregation so that even farms with
 * many sensors only return one document per combination.
 *
 * @param {string} farmId
 * @returns {Promise<Array<Object>>}
 */
const getLatestByFarm = async (farmId) => {
  if (!isValidId(farmId)) {
    throw badRequest(`farmId '${farmId}' is not a valid MongoDB ObjectId.`);
  }

  const results = await SensorReading.aggregate([
    { $match: { farmId: new mongoose.Types.ObjectId(farmId) } },
    { $sort:  { recordedAt: -1 } },
    {
      $group: {
        _id: { zoneId: '$zoneId', sensorType: '$sensorType' },
        latestReading: { $first: '$$ROOT' },
      },
    },
    { $replaceRoot: { newRoot: '$latestReading' } },
    { $sort: { zoneId: 1, sensorType: 1 } },
  ]);

  return results;
};

/**
 * Returns a time-series of readings for a specific zone and (optionally)
 * sensor type, ordered newest-first, capped at `limit` documents.
 *
 * @param {string}  farmId
 * @param {string}  zoneId     - Zone UUID string.
 * @param {string}  [sensorType] - Optional filter on sensor type.
 * @param {number}  [limit=100]  - Maximum number of readings to return.
 * @returns {Promise<SensorReading[]>}
 */
const getReadingsByZone = async (farmId, zoneId, sensorType, limit = 100) => {
  if (!isValidId(farmId)) {
    throw badRequest(`farmId '${farmId}' is not a valid MongoDB ObjectId.`);
  }
  if (!zoneId || typeof zoneId !== 'string') {
    throw badRequest('zoneId must be a non-empty string.');
  }

  const parsedLimit = parseInt(limit, 10);
  if (isNaN(parsedLimit) || parsedLimit < 1) {
    throw badRequest('limit must be a positive integer.');
  }
  const safeLimit = Math.min(parsedLimit, 1000); // cap at 1000 to avoid abuse

  const query = { farmId, zoneId };
  if (sensorType) {
    query.sensorType = sensorType;
  }

  const readings = await SensorReading.find(query)
    .sort({ recordedAt: -1 })
    .limit(safeLimit)
    .lean();

  return readings;
};

/**
 * Returns the status of every device registered to a farm, enriched with
 * its most recent reading per sensor type.
 *
 * @param {string} farmId
 * @returns {Promise<Array<Object>>}
 */
const getDeviceStatus = async (farmId) => {
  if (!isValidId(farmId)) {
    throw badRequest(`farmId '${farmId}' is not a valid MongoDB ObjectId.`);
  }

  // Fetch all devices for this farm
  const devices = await deviceService.getDevicesByFarm(farmId);

  // For each device, grab the latest reading per sensorType
  const deviceIds = devices.map((d) => d.deviceId);

  const latestReadings = await SensorReading.aggregate([
    {
      $match: {
        farmId:   new mongoose.Types.ObjectId(farmId),
        deviceId: { $in: deviceIds },
      },
    },
    { $sort: { recordedAt: -1 } },
    {
      $group: {
        _id: { deviceId: '$deviceId', sensorType: '$sensorType' },
        latestReading: { $first: '$$ROOT' },
      },
    },
    { $replaceRoot: { newRoot: '$latestReading' } },
  ]);

  // Index readings by deviceId for fast lookup
  const readingsByDevice = {};
  for (const r of latestReadings) {
    if (!readingsByDevice[r.deviceId]) readingsByDevice[r.deviceId] = [];
    readingsByDevice[r.deviceId].push(r);
  }

  // Merge into device documents
  const enriched = devices.map((device) => ({
    ...device,
    latestReadings: readingsByDevice[device.deviceId] || [],
  }));

  return enriched;
};

module.exports = {
  ingestReading,
  getLatestByFarm,
  getReadingsByZone,
  getDeviceStatus,
};

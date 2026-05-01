const mongoose = require('mongoose');
const Device = require('../models/Device');
const Farm = require('../models/Farm');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const notFound = (message) => {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
};

const badRequest = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Registers a new device for a farm.
 * Validates that:
 *   - required fields are present
 *   - farmId is a valid ObjectId and the farm actually exists
 *   - deviceId is unique (Mongoose will throw a 11000 duplicate-key error
 *     which is caught by the global error handler)
 *
 * @param {Object} data - Device payload.
 * @returns {Promise<Device>}
 */
const registerDevice = async (data) => {
  if (!data.farmId) {
    throw badRequest('farmId is required.');
  }
  if (!isValidId(data.farmId)) {
    throw badRequest(`farmId '${data.farmId}' is not a valid MongoDB ObjectId.`);
  }
  if (!data.deviceId || !String(data.deviceId).trim()) {
    throw badRequest('deviceId is required.');
  }
  if (!data.name || !String(data.name).trim()) {
    throw badRequest('Device name is required.');
  }
  if (!data.deviceType) {
    throw badRequest('deviceType is required.');
  }

  const farmExists = await Farm.exists({ _id: data.farmId });
  if (!farmExists) {
    throw notFound(`Farm not found with id: ${data.farmId}`);
  }

  const device = await Device.create({
    farmId:     data.farmId,
    deviceId:   String(data.deviceId).trim(),
    name:       String(data.name).trim(),
    deviceType: data.deviceType,
    zoneId:     data.zoneId || null,
    status:     data.status || 'offline',
    lastSeen:   data.lastSeen || null,
    location:   data.location || { lat: null, lng: null },
    config: {
      reportIntervalSec: data.config?.reportIntervalSec ?? 60,
      sensors:           Array.isArray(data.config?.sensors) ? data.config.sensors : [],
    },
    batteryPct: data.batteryPct !== undefined ? data.batteryPct : null,
  });

  return device.toObject();
};

/**
 * Returns all devices registered for a given farm.
 *
 * @param {string} farmId - Farm ObjectId.
 * @returns {Promise<Device[]>}
 */
const getDevicesByFarm = async (farmId) => {
  if (!isValidId(farmId)) {
    throw badRequest(`farmId '${farmId}' is not a valid MongoDB ObjectId.`);
  }

  const devices = await Device.find({ farmId }).sort({ createdAt: -1 }).lean();
  return devices;
};

/**
 * Updates a device document by its `deviceId` string field (not _id).
 * Throws 404 if no device matches.
 *
 * @param {string} deviceId - The human-readable device identifier, e.g. "ESP32-001".
 * @param {Object} data     - Fields to update.
 * @returns {Promise<Device>}
 */
const updateDevice = async (deviceId, data) => {
  if (!deviceId) {
    throw badRequest('deviceId is required.');
  }

  // Disallow changing farmId to an invalid value
  if (data.farmId !== undefined && data.farmId !== null) {
    if (!isValidId(data.farmId)) {
      throw badRequest(`farmId '${data.farmId}' is not a valid MongoDB ObjectId.`);
    }
  }

  // Build $set payload — only allow safe fields to be updated
  const update = {};
  const topLevel = ['name', 'deviceType', 'zoneId', 'status', 'lastSeen', 'location', 'batteryPct'];
  for (const key of topLevel) {
    if (data[key] !== undefined) update[key] = data[key];
  }

  if (data.config) {
    if (data.config.reportIntervalSec !== undefined) {
      update['config.reportIntervalSec'] = data.config.reportIntervalSec;
    }
    if (data.config.sensors !== undefined) {
      update['config.sensors'] = data.config.sensors;
    }
  }

  if (data.farmId !== undefined) update.farmId = data.farmId;

  const device = await Device.findOneAndUpdate(
    { deviceId },
    { $set: update },
    { new: true, runValidators: true }
  ).lean();

  if (!device) {
    throw notFound(`Device not found with deviceId: ${deviceId}`);
  }
  return device;
};

/**
 * Updates only the `status` and `lastSeen` fields of a device.
 * Called internally by `ingestReading` whenever a new reading arrives.
 *
 * @param {string} deviceId - The human-readable device identifier.
 * @param {string} status   - New status ('online' | 'offline' | 'error' | 'idle').
 * @returns {Promise<void>}
 */
const updateDeviceStatus = async (deviceId, status) => {
  const validStatuses = ['online', 'offline', 'error', 'idle'];
  if (!validStatuses.includes(status)) {
    throw badRequest(`status must be one of: ${validStatuses.join(', ')}`);
  }

  // Upsert-style: if the device isn't registered yet we still track lastSeen
  await Device.findOneAndUpdate(
    { deviceId },
    {
      $set: {
        status,
        lastSeen: new Date(),
      },
    },
    { new: true }
  );
  // Not throwing if the device doesn't exist — ingest flow is best-effort
};

module.exports = {
  registerDevice,
  getDevicesByFarm,
  updateDevice,
  updateDeviceStatus,
};

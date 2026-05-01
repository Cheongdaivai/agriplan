const Farm = require('../models/Farm');
const Zone = require('../models/Zone');

/**
 * Creates a new farm document.
 * @param {Object} data - Validated farm payload.
 * @returns {Promise<Farm>}
 */
const createFarm = async (data) => {
  const farm = await Farm.create(data);
  return farm;
};

/**
 * Returns all farms, most recently created first.
 * @returns {Promise<Farm[]>}
 */
const getAllFarms = async () => {
  const farms = await Farm.find().sort({ createdAt: -1 }).lean();
  return farms;
};

/**
 * Returns a single farm by ID.
 * Throws a 404-tagged error if not found.
 * @param {string} id - Farm ObjectId.
 * @returns {Promise<Farm>}
 */
const getFarmById = async (id) => {
  const farm = await Farm.findById(id).lean();
  if (!farm) {
    const err = new Error(`Farm not found with id: ${id}`);
    err.statusCode = 404;
    throw err;
  }
  return farm;
};

/**
 * Updates a farm by ID with the provided fields.
 * Throws 404 if no farm matches the given id.
 * @param {string} id - Farm ObjectId.
 * @param {Object} data - Fields to update.
 * @returns {Promise<Farm>}
 */
const updateFarm = async (id, data) => {
  const farm = await Farm.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true }
  ).lean();

  if (!farm) {
    const err = new Error(`Farm not found with id: ${id}`);
    err.statusCode = 404;
    throw err;
  }
  return farm;
};

/**
 * Deletes a farm and all its associated zones.
 * Throws 404 if no farm matches the given id.
 * @param {string} id - Farm ObjectId.
 * @returns {Promise<{ farm: Farm, deletedZoneCount: number }>}
 */
const deleteFarm = async (id) => {
  const farm = await Farm.findByIdAndDelete(id).lean();
  if (!farm) {
    const err = new Error(`Farm not found with id: ${id}`);
    err.statusCode = 404;
    throw err;
  }

  // Cascade-delete all zones belonging to this farm
  const { deletedCount } = await Zone.deleteMany({ farmId: id });

  return { farm, deletedZoneCount: deletedCount };
};

module.exports = {
  createFarm,
  getAllFarms,
  getFarmById,
  updateFarm,
  deleteFarm,
};

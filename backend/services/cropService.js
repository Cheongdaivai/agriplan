const Crop = require('../models/Crop');

/**
 * Returns all crops.
 * Supports optional filtering by season and/or waterNeeds via query params.
 *
 * @param {Object} filters - Optional filter object { season?, waterNeeds? }
 * @returns {Promise<Crop[]>}
 */
const getAllCrops = async (filters = {}) => {
  const query = {};

  if (filters.season) {
    query.suitableSeason = filters.season; // Mongoose matches if array contains value
  }

  if (filters.waterNeeds) {
    query.waterNeeds = filters.waterNeeds;
  }

  const crops = await Crop.find(query).sort({ name: 1 }).lean();
  return crops;
};

/**
 * Returns a single crop by ID.
 * Throws a 404-tagged error if not found.
 *
 * @param {string} id - Crop ObjectId.
 * @returns {Promise<Crop>}
 */
const getCropById = async (id) => {
  const crop = await Crop.findById(id).lean();
  if (!crop) {
    const err = new Error(`Crop not found with id: ${id}`);
    err.statusCode = 404;
    throw err;
  }
  return crop;
};

/**
 * Creates a new crop.
 * Returns the existing crop document (without error) if a crop with the same
 * name already exists — useful for idempotent seed operations.
 *
 * @param {Object} data - Validated crop payload.
 * @returns {Promise<{ crop: Crop, created: boolean }>}
 */
const createCrop = async (data) => {
  const existing = await Crop.findOne({ name: data.name }).lean();
  if (existing) {
    return { crop: existing, created: false };
  }
  const crop = await Crop.create(data);
  return { crop, created: true };
};

/**
 * Updates a crop by ID.
 * Throws 404 if not found.
 *
 * @param {string} id - Crop ObjectId.
 * @param {Object} data - Fields to update.
 * @returns {Promise<Crop>}
 */
const updateCrop = async (id, data) => {
  const crop = await Crop.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true }
  ).lean();

  if (!crop) {
    const err = new Error(`Crop not found with id: ${id}`);
    err.statusCode = 404;
    throw err;
  }
  return crop;
};

/**
 * Deletes a crop by ID.
 * Throws 404 if not found.
 *
 * @param {string} id - Crop ObjectId.
 * @returns {Promise<Crop>}
 */
const deleteCrop = async (id) => {
  const crop = await Crop.findByIdAndDelete(id).lean();
  if (!crop) {
    const err = new Error(`Crop not found with id: ${id}`);
    err.statusCode = 404;
    throw err;
  }
  return crop;
};

module.exports = {
  getAllCrops,
  getCropById,
  createCrop,
  updateCrop,
  deleteCrop,
};

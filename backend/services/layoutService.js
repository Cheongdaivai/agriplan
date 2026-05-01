const mongoose = require('mongoose');
const FarmLayout = require('../models/FarmLayout');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a tagged 404 error.
 * @param {string} message
 * @returns {Error}
 */
const notFound = (message) => {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
};

/**
 * Build a tagged 400 error.
 * @param {string} message
 * @returns {Error}
 */
const badRequest = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

/**
 * Validate that a string is a usable MongoDB ObjectId.
 * @param {string} id
 * @returns {boolean}
 */
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Creates a new FarmLayout document from the editor payload.
 * The frontend has already computed all geometry/financials — stored as-is.
 * `metadata.zoneCount` is always derived from the zones array length.
 *
 * @param {Object} data - Full layout payload from the frontend editor.
 * @returns {Promise<FarmLayout>}
 */
const createLayout = async (data) => {
  if (!data || !data.name || !data.name.trim()) {
    throw badRequest('Layout name is required.');
  }

  // Normalise optional farmId
  if (data.farmId && !isValidId(data.farmId)) {
    throw badRequest(`farmId '${data.farmId}' is not a valid MongoDB ObjectId.`);
  }
  if (!data.farmId) {
    data.farmId = null;
  }

  // Always derive zoneCount from the actual zones array
  const zones = Array.isArray(data.zones) ? data.zones : [];
  const metadata = {
    totalAreaSqm: 0,
    totalYieldKg: 0,
    totalRevenue: 0,
    totalWaterL: 0,
    season: 'dry',
    soilType: 'loam',
    zoneCount: zones.length,
    ...(data.metadata || {}),
    // Override zoneCount after spreading caller's metadata
    zoneCount: zones.length,
  };

  const layout = await FarmLayout.create({
    name:        data.name.trim(),
    description: data.description || '',
    farmId:      data.farmId,
    boundary:    Array.isArray(data.boundary) ? data.boundary : [],
    zones,
    metadata,
    tags:        Array.isArray(data.tags) ? data.tags : [],
    isTemplate:  Boolean(data.isTemplate),
  });

  return layout.toObject();
};

/**
 * Returns a list of layouts, optionally filtered by farmId and/or isTemplate.
 * Results are sorted by creation date descending.
 *
 * @param {{ farmId?: string, isTemplate?: string|boolean }} filters
 * @returns {Promise<FarmLayout[]>}
 */
const getAllLayouts = async (filters = {}) => {
  const query = {};

  if (filters.farmId !== undefined && filters.farmId !== '') {
    if (!isValidId(filters.farmId)) {
      throw badRequest(`farmId '${filters.farmId}' is not a valid MongoDB ObjectId.`);
    }
    query.farmId = filters.farmId;
  }

  if (filters.isTemplate !== undefined && filters.isTemplate !== '') {
    // Accept boolean or the strings 'true'/'false' from query params
    query.isTemplate = filters.isTemplate === true || filters.isTemplate === 'true';
  }

  const layouts = await FarmLayout.find(query).sort({ createdAt: -1 }).lean();
  return layouts;
};

/**
 * Returns a single FarmLayout by its MongoDB ObjectId.
 * Throws 404 if not found, 400 if id is malformed.
 *
 * @param {string} id
 * @returns {Promise<FarmLayout>}
 */
const getLayoutById = async (id) => {
  if (!isValidId(id)) {
    throw badRequest(`'${id}' is not a valid MongoDB ObjectId.`);
  }

  const layout = await FarmLayout.findById(id).lean();
  if (!layout) {
    throw notFound(`FarmLayout not found with id: ${id}`);
  }
  return layout;
};

/**
 * Updates an existing FarmLayout's top-level fields (name, description,
 * boundary, metadata, tags, isTemplate).
 * Does NOT replace the entire zones array unless caller passes zones explicitly.
 * Always re-derives `metadata.zoneCount` when zones are touched.
 *
 * @param {string} id
 * @param {Object} data - Fields to update.
 * @returns {Promise<FarmLayout>}
 */
const updateLayout = async (id, data) => {
  if (!isValidId(id)) {
    throw badRequest(`'${id}' is not a valid MongoDB ObjectId.`);
  }

  // Prevent overwriting with an invalid farmId
  if (data.farmId !== undefined && data.farmId !== null && data.farmId !== '') {
    if (!isValidId(data.farmId)) {
      throw badRequest(`farmId '${data.farmId}' is not a valid MongoDB ObjectId.`);
    }
  }

  // Build the $set payload
  const update = {};

  if (data.name !== undefined)        update.name        = String(data.name).trim();
  if (data.description !== undefined) update.description = data.description;
  if (data.farmId !== undefined)      update.farmId      = data.farmId || null;
  if (data.boundary !== undefined)    update.boundary    = data.boundary;
  if (data.tags !== undefined)        update.tags        = data.tags;
  if (data.isTemplate !== undefined)  update.isTemplate  = Boolean(data.isTemplate);

  if (data.zones !== undefined) {
    update.zones = data.zones;
    // Keep zoneCount in sync
    const zoneCount = Array.isArray(data.zones) ? data.zones.length : 0;
    update['metadata.zoneCount'] = zoneCount;
  }

  // Merge any metadata fields provided (except zoneCount if zones weren't sent)
  if (data.metadata) {
    const allowed = ['totalAreaSqm', 'totalYieldKg', 'totalRevenue', 'totalWaterL', 'season', 'soilType'];
    for (const key of allowed) {
      if (data.metadata[key] !== undefined) {
        update[`metadata.${key}`] = data.metadata[key];
      }
    }
    // Allow caller to update zoneCount only if they didn't also send zones
    if (data.metadata.zoneCount !== undefined && data.zones === undefined) {
      update['metadata.zoneCount'] = data.metadata.zoneCount;
    }
  }

  const layout = await FarmLayout.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, runValidators: true }
  ).lean();

  if (!layout) {
    throw notFound(`FarmLayout not found with id: ${id}`);
  }
  return layout;
};

/**
 * Deletes a FarmLayout by id.
 * Throws 404 if not found.
 *
 * @param {string} id
 * @returns {Promise<FarmLayout>} The deleted document.
 */
const deleteLayout = async (id) => {
  if (!isValidId(id)) {
    throw badRequest(`'${id}' is not a valid MongoDB ObjectId.`);
  }

  const layout = await FarmLayout.findByIdAndDelete(id).lean();
  if (!layout) {
    throw notFound(`FarmLayout not found with id: ${id}`);
  }
  return layout;
};

/**
 * Updates the rowPlan of a single embedded zone inside a FarmLayout.
 * Matches on both the layout _id and the zone's zoneId string field.
 *
 * @param {string} layoutId - FarmLayout ObjectId.
 * @param {string} zoneId   - Zone UUID string (not ObjectId).
 * @param {Object} rowPlan  - New rowPlan fields { rows, columns, spacingM, orientation }.
 * @returns {Promise<FarmLayout>} The updated layout.
 */
const updateZoneRowPlan = async (layoutId, zoneId, rowPlan) => {
  if (!isValidId(layoutId)) {
    throw badRequest(`'${layoutId}' is not a valid MongoDB ObjectId.`);
  }
  if (!zoneId || typeof zoneId !== 'string') {
    throw badRequest('zoneId must be a non-empty string.');
  }
  if (!rowPlan || typeof rowPlan !== 'object') {
    throw badRequest('rowPlan must be a non-null object.');
  }

  // Validate orientation if provided
  if (rowPlan.orientation !== undefined &&
      !['horizontal', 'vertical'].includes(rowPlan.orientation)) {
    throw badRequest("rowPlan.orientation must be 'horizontal' or 'vertical'.");
  }

  // Build a positional $set using the array filter operator
  const update = {};
  const allowedKeys = ['rows', 'columns', 'spacingM', 'orientation'];
  for (const key of allowedKeys) {
    if (rowPlan[key] !== undefined) {
      update[`zones.$[zone].rowPlan.${key}`] = rowPlan[key];
    }
  }

  if (Object.keys(update).length === 0) {
    throw badRequest('No valid rowPlan fields provided (allowed: rows, columns, spacingM, orientation).');
  }

  const layout = await FarmLayout.findByIdAndUpdate(
    layoutId,
    { $set: update },
    {
      new: true,
      runValidators: true,
      arrayFilters: [{ 'zone.zoneId': zoneId }],
    }
  ).lean();

  if (!layout) {
    throw notFound(`FarmLayout not found with id: ${layoutId}`);
  }

  // Verify the zone actually existed in this layout
  const zoneExists = layout.zones.some((z) => z.zoneId === zoneId);
  if (!zoneExists) {
    throw notFound(`Zone '${zoneId}' not found in layout '${layoutId}'.`);
  }

  return layout;
};

module.exports = {
  createLayout,
  getAllLayouts,
  getLayoutById,
  updateLayout,
  deleteLayout,
  updateZoneRowPlan,
};

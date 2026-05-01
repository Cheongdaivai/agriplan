const { body, param, validationResult } = require("express-validator");
const mongoose = require("mongoose");

/**
 * Runs express-validator's accumulated errors and short-circuits with a 422
 * response if any are present.  Mount this AFTER the rule arrays.
 *
 * Example:
 *   router.post('/', farmValidationRules, handleValidationErrors, controller);
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      data: null,
      error: {
        message: "Validation failed",
        details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      },
    });
  }
  next();
};

// ---------------------------------------------------------------------------
// Farm validation rules
// ---------------------------------------------------------------------------
const farmValidationRules = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Farm name is required")
    .isLength({ max: 120 })
    .withMessage("Farm name must be 120 characters or fewer"),

  body("season")
    .notEmpty()
    .withMessage("Season is required")
    .isIn(["dry", "rainy"])
    .withMessage("Season must be 'dry' or 'rainy'"),

  body("soilType")
    .optional()
    .isIn(["clay", "sandy", "loam", "silt", "peaty"])
    .withMessage("soilType must be one of: clay, sandy, loam, silt, peaty"),

  body("boundary")
    .optional()
    .isArray()
    .withMessage("boundary must be an array of {lat, lng} points"),

  body("boundary.*.lat")
    .if(body("boundary").exists())
    .isNumeric()
    .withMessage("Each boundary point must have a numeric lat value"),

  body("boundary.*.lng")
    .if(body("boundary").exists())
    .isNumeric()
    .withMessage("Each boundary point must have a numeric lng value"),
];

// ---------------------------------------------------------------------------
// Zone validation rules
// ---------------------------------------------------------------------------
const zoneValidationRules = [
  body("farmId")
    .notEmpty()
    .withMessage("farmId is required")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("farmId must be a valid MongoDB ObjectId");
      }
      return true;
    }),

  body("name")
    .trim()
    .notEmpty()
    .withMessage("Zone name is required")
    .isLength({ max: 120 })
    .withMessage("Zone name must be 120 characters or fewer"),

  body("cropId")
    .optional({ nullable: true })
    .custom((value) => {
      if (value !== null && value !== undefined && value !== "") {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new Error("cropId must be a valid MongoDB ObjectId or null");
        }
      }
      return true;
    }),

  body("coordinates")
    .optional()
    .isArray()
    .withMessage("coordinates must be an array of {lat, lng} points"),

  body("coordinates.*.lat")
    .if(body("coordinates").exists())
    .isNumeric()
    .withMessage("Each coordinate must have a numeric lat value"),

  body("coordinates.*.lng")
    .if(body("coordinates").exists())
    .isNumeric()
    .withMessage("Each coordinate must have a numeric lng value"),

  body("area")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("area must be a non-negative number"),
];

// ---------------------------------------------------------------------------
// Crop validation rules (for admin seed/create route)
// ---------------------------------------------------------------------------
const cropValidationRules = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Crop name is required")
    .isLength({ max: 80 })
    .withMessage("Crop name must be 80 characters or fewer"),

  body("avgYieldPerSqm")
    .notEmpty()
    .withMessage("avgYieldPerSqm is required")
    .isFloat({ min: 0 })
    .withMessage("avgYieldPerSqm must be a non-negative number"),

  body("marketPrice")
    .notEmpty()
    .withMessage("marketPrice is required")
    .isFloat({ min: 0 })
    .withMessage("marketPrice must be a non-negative number"),

  body("waterNeeds")
    .optional()
    .isIn(["low", "medium", "high"])
    .withMessage("waterNeeds must be 'low', 'medium', or 'high'"),

  body("growthDurationDays")
    .optional()
    .isInt({ min: 1 })
    .withMessage("growthDurationDays must be an integer >= 1"),

  body("suitableSeason")
    .optional()
    .isArray()
    .withMessage("suitableSeason must be an array"),

  body("suitableSeason.*")
    .if(body("suitableSeason").exists())
    .isIn(["dry", "rainy"])
    .withMessage("Each suitableSeason value must be 'dry' or 'rainy'"),

  body("color")
    .optional()
    .matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    .withMessage("color must be a valid hex color code (e.g. #f59e0b)"),
];

// ---------------------------------------------------------------------------
// Param validators
// ---------------------------------------------------------------------------
const mongoIdParam = (paramName = "id") => [
  param(paramName).custom((value) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error(`${paramName} must be a valid MongoDB ObjectId`);
    }
    return true;
  }),
];

module.exports = {
  handleValidationErrors,
  farmValidationRules,
  zoneValidationRules,
  cropValidationRules,
  mongoIdParam,
};

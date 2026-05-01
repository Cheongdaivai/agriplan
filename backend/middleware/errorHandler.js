const mongoose = require('mongoose');

/**
 * Centralised Express error-handling middleware.
 * Must be mounted LAST (after all routes) with four parameters so Express
 * recognises it as an error handler.
 *
 * All responses follow the envelope:
 *   { success: false, data: null, error: { message, code?, details? } }
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Default status / message
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = undefined;

  // --- Mongoose validation error ---
  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 422;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // --- Mongoose cast error (bad ObjectId) ---
  if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid value for field '${err.path}': ${err.value}`;
  }

  // --- Mongoose duplicate key error ---
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    message = `Duplicate value: '${value}' already exists for ${field}`;
  }

  // Log stack in development only
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[Error] ${statusCode} ${message}`);
    if (err.stack) console.error(err.stack);
  }

  const body = {
    success: false,
    data: null,
    error: {
      message,
      ...(details && { details }),
    },
  };

  return res.status(statusCode).json(body);
};

module.exports = errorHandler;

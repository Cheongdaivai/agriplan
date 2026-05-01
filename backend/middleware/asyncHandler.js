/**
 * asyncHandler
 * Wraps an async Express route handler so that any rejected promise or thrown
 * error is forwarded to Express's next(err) error pipeline instead of
 * crashing the process.
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => { ... }));
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;

// src/middleware/validate.js
// Middleware factory: validates query params or request body with a Zod schema.
// Returns 400 for query/path errors, 422 for body validation errors.
// REQ-VALIDATION-001, REQ-ERROR-001, REQ-ERROR-003

'use strict';

const { ZodError } = require('zod');
const { errorResponse } = require('../lib/response');

/**
 * validateQuery(schema) — validates req.query against schema.
 * Unknown / invalid params → 400.
 */
function validateQuery(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return _res.status(400).json(
        errorResponse('BAD_REQUEST', formatZodError(result.error)),
      );
    }
    req.validQuery = result.data;
    next();
  };
}

/**
 * validateBody(schema) — validates req.body against schema.
 * Missing required field or semantic error → 422.
 */
function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return _res.status(422).json(
        errorResponse('VALIDATION_ERROR', formatZodError(result.error)),
      );
    }
    req.validBody = result.data;
    next();
  };
}

function formatZodError(zodError) {
  const issues = zodError.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  return issues.join('; ');
}

module.exports = { validateQuery, validateBody };

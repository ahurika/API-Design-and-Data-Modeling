// src/middleware/rateLimit.js
// IP-based rate limiting (REQ-RATE-001).
// Limits are read from configuration, not hard-coded (REQ-RATE-002).
// On exceed, returns 429 with Retry-After and the standard error envelope
// (REQ-RATE-003, REQ-API-008).

'use strict';

const rateLimit = require('express-rate-limit');
const { errorResponse } = require('../lib/response');

const windowSeconds = Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 60);
const maxRequests   = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100);

// It is important to compute the window AFTER Number() coercion so the
// Retry-After header always reports the real configured window.
const limiter = rateLimit({
  windowMs: windowSeconds * 1000,
  limit: maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.set('Retry-After', String(Math.ceil(windowSeconds)));
    res.status(429).json(
      errorResponse('RATE_LIMITED', `Too many requests. Limit is ${maxRequests} per ${windowSeconds}s. Retry after the Retry-After period.`),
    );
  },
});

module.exports = { rateLimiter: limiter };
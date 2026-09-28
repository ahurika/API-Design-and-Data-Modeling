// src/lib/response.js
// Consistent success and error envelopes (REQ-API-007, REQ-API-008)
// REQ-ERROR-005: never return HTTP 200 for an error

'use strict';

/**
 * Wrap a collection result in the paginated success envelope.
 * @param {Array}  data
 * @param {number} total
 * @param {number} limit
 * @param {string|null} nextCursor
 * @returns {object}
 */
function collectionResponse(data, total, limit, nextCursor) {
  return {
    data,
    meta: {
      total,
      limit,
      hasMore: nextCursor !== null,
      nextCursor: nextCursor ?? null,
    },
  };
}

/**
 * Wrap a single item or mutation result.
 * @param {object} data
 * @returns {object}
 */
function itemResponse(data) {
  return { data };
}

/**
 * Standard error envelope.
 * @param {string} code   — machine-readable error code
 * @param {string} message — human-readable description
 * @returns {object}
 */
function errorResponse(code, message) {
  return {
    error: {
      code,
      message,
    },
  };
}

module.exports = { collectionResponse, itemResponse, errorResponse };

// src/lib/cursor.js
// Opaque cursor pagination helpers.
// Cursor = base64(JSON({id, sortValue}))
// REQ-API-003, REQ-API-004

'use strict';

function encodeCursor(id, sortValue) {
  return Buffer.from(JSON.stringify({ id, sortValue })).toString('base64url');
}

function decodeCursor(cursor) {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

module.exports = { encodeCursor, decodeCursor };

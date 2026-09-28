// src/middleware/cors.js
// Minimal CORS so the browser consumer (REQ-CONSUMER-001) can read the
// public API. Reads are unauthenticated by design (AGENTS.md constraint).

'use strict';

module.exports = function cors(_req, res, next) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') {
    return res.status(204).send();
  }
  next();
};
// src/db/pool.js
// Central PostgreSQL connection pool (REQ-DEPLOY-002)

'use strict';

const { Pool, types } = require('pg');
require('dotenv').config();

// Preserve full timestamp precision so opaque cursor pagination is exact.
// node-postgres parses TIMESTAMPTZ to a JS Date (millisecond precision), which
// silently truncates stored microseconds; a cursor whose sort value was a
// truncated timestamp then fails the `= <sort>` tie-break and pages go missing.
// This parser returns RFC 3339 strings with the original fraction, so encoded
// sort values round-trip exactly (REQ-API-003, REQ-API-004).
const TIMESTAMPTZ_OID = 1184;
const TIMESTAMP_OID   = 1114;

function parseTimestamptz(value) {
  if (value === null) return null;
  const fracMatch = /\.(\d{1,6})/.exec(value);
  const frac = fracMatch ? fracMatch[1].padEnd(6, '0') : '000000';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return (
    `${parsed.getUTCFullYear()}-${p(parsed.getUTCMonth() + 1)}-${p(parsed.getUTCDate())}` +
    `T${p(parsed.getUTCHours())}:${p(parsed.getUTCMinutes())}:${p(parsed.getUTCSeconds())}.${frac}Z`
  );
}

types.setTypeParser(TIMESTAMPTZ_OID, parseTimestamptz);
types.setTypeParser(TIMESTAMP_OID, parseTimestamptz);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Only enable TLS when the provider mandates it (e.g. Neon URLs include
  // sslmode=require) or in production. Local plaintext-DB development without
  // an sslmode in DATABASE_URL keeps ssl disabled.
  ssl: /sslmode=(require|verify-ca|verify-full)/.test(process.env.DATABASE_URL || '') ||
       process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error', err);
});

module.exports = pool;

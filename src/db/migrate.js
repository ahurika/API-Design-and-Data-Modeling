// src/db/migrate.js
// Runs the schema.sql migration against the configured PostgreSQL database.
// Idempotent: uses IF NOT EXISTS / DO $$ … $$ pattern throughout.

'use strict';

const fs   = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = require('./pool');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const client = await pool.connect();
  try {
    console.log('Running migration …');
    await client.query(sql);
    console.log('Migration complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});

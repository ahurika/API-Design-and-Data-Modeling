// src/db/pool.js
// Central PostgreSQL connection pool (REQ-DEPLOY-002)

'use strict';

const { Pool } = require('pg');
require('dotenv').config();

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

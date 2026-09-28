'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await pool.connect();
  try {
    const rows = [];
    for (let i = 1; i <= 200; i++) rows.push(['Seller Y' + i, 'sellery' + i + '@example.com']);
    const placeholders = [];
    const params = [];
    let n = 0;
    for (const row of rows) {
      const p = [];
      for (const val of row) { n += 1; p.push('$' + n); params.push(val); }
      placeholders.push('(' + p.join(', ') + ')');
    }
    const text = 'INSERT INTO sellers (name, email) VALUES ' + placeholders.join(', ')
      + ' ON CONFLICT (email) DO NOTHING RETURNING id';
    console.log('param count:', n);
    const r = await client.query(text, params);
    console.log('200-row insert OK rows', r.rowCount);
  } catch (e) {
    console.log('ERR', JSON.stringify({ message: e.message, code: e.code, position: e.position }));
  } finally {
    client.release();
    await pool.end();
  }
})();
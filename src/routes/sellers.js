// src/routes/sellers.js
// GET /api/v1/sellers       — list sellers
// GET /api/v1/sellers/:id   — get single seller

'use strict';

const express = require('express');
const pool    = require('../db/pool');
const { sellerListQuery } = require('../schemas');
const { validateQuery }   = require('../middleware/validate');
const { collectionResponse, itemResponse, errorResponse } = require('../lib/response');
const { encodeCursor, decodeCursor } = require('../lib/cursor');

const router = express.Router();

router.get('/', validateQuery(sellerListQuery), async (req, res, next) => {
  try {
    const { limit, cursor, sort = 'created_at', order, email, createdAt } = req.validQuery;
    const direction = order === 'asc' ? 'ASC' : 'DESC';
    const operator  = order === 'asc' ? '>'  : '<';

    const params  = [];
    const filters = ['deleted_at IS NULL'];

    if (email) {
      params.push(email);
      filters.push(`email = $${params.length}`);
    }
    if (createdAt) {
      params.push(createdAt);
      filters.push(`created_at >= $${params.length}`);
    }

    let cursorClause = '';
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (!decoded) {
        return res.status(400).json(errorResponse('BAD_REQUEST', 'Malformed cursor'));
      }
      params.push(decoded.sortValue, decoded.id);
      cursorClause = `(${sort} ${operator} $${params.length - 1} OR (${sort} = $${params.length - 1} AND id ${operator} $${params.length}))`;
    }

    const whereClause = `WHERE ${filters.join(' AND ')}${cursorClause ? ' AND ' + cursorClause : ''}`;

    const filterParamCount = params.length - (cursor ? 2 : 0);
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM sellers WHERE ${filters.join(' AND ')}`,
      params.slice(0, filterParamCount),
    );
    const total = parseInt(countRows[0].count, 10);

    params.push(limit + 1);
    const { rows } = await pool.query(
      `SELECT id, name, email, created_at, updated_at
       FROM sellers
       ${whereClause}
       ORDER BY ${sort} ${direction}, id ${direction}
       LIMIT $${params.length}`,
      params,
    );

    const hasMore    = rows.length > limit;
    const data       = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? encodeCursor(data[data.length - 1].id, data[data.length - 1][sort])
      : null;

    return res.json(collectionResponse(data.map(formatSeller), total, limit, nextCursor));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, created_at, updated_at
       FROM sellers
       WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id],
    );
    if (!rows[0]) {
      return res.status(404).json(errorResponse('NOT_FOUND', 'Seller not found'));
    }
    return res.json(itemResponse(formatSeller(rows[0])));
  } catch (err) {
    next(err);
  }
});

function formatSeller(row) {
  return {
    id:        row.id,
    name:      row.name,
    email:     row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = router;

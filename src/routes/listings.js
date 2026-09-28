// src/routes/listings.js
// Action 1: Buyer discovers listings  — GET /api/v1/listings
// Action 2: Buyer views a listing     — GET /api/v1/listings/:id
// Action 4: Seller manages a listing  — POST /PATCH/DELETE /api/v1/listings/:id
//
// State machine enforcement (REQ-LISTING-003):
//   DRAFT → ACTIVE
//   ACTIVE → SOLD_OUT
//   ACTIVE → ARCHIVED
//   SOLD_OUT → ARCHIVED
//   All other transitions → 422

'use strict';

const express = require('express');
const pool    = require('../db/pool');
const { listingListQuery, listingCreate, listingUpdate } = require('../schemas');
const { validateQuery, validateBody } = require('../middleware/validate');
const { collectionResponse, itemResponse, errorResponse } = require('../lib/response');
const { encodeCursor, decodeCursor } = require('../lib/cursor');

const router = express.Router();

// Allowed listing state transitions (REQ-LISTING-003)
const LISTING_TRANSITIONS = {
  DRAFT:    ['ACTIVE'],
  ACTIVE:   ['SOLD_OUT', 'ARCHIVED'],
  SOLD_OUT: ['ARCHIVED'],
  ARCHIVED: [],
};

// ─── GET /api/v1/listings ────────────────────────────────────────────────────
// Action 1: buyer discovers available listings
// Indexes used: idx_listings_status_created_at, idx_listings_status_currency_price
// REQ-BUYER-001, REQ-LISTING-001, REQ-INDEX-002
router.get('/', validateQuery(listingListQuery), async (req, res, next) => {
  try {
    const {
      limit, cursor,
      sort = 'created_at', order,
      sellerId, status, currency,
    } = req.validQuery;

    const direction = order === 'asc' ? 'ASC' : 'DESC';
    const operator  = order === 'asc' ? '>'  : '<';

    const params = [];
    const where  = ['deleted_at IS NULL'];

    if (sellerId) {
      params.push(sellerId);
      where.push(`seller_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    if (currency) {
      params.push(currency);
      where.push(`currency = $${params.length}`);
    }

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (!decoded) {
        return res.status(400).json(errorResponse('BAD_REQUEST', 'Malformed cursor'));
      }
      params.push(decoded.sortValue, decoded.id);
      where.push(
        `(${sort} ${operator} $${params.length - 1} OR (${sort} = $${params.length - 1} AND id ${operator} $${params.length}))`,
      );
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;

    // Count without cursor (REQ-API-004: total)
    const filterParamCount = params.length - (cursor ? 2 : 0);
    const countWhere       = where.slice(0, Math.max(1, where.length - (cursor ? 1 : 0)));
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM listings WHERE ${countWhere.join(' AND ')}`,
      params.slice(0, filterParamCount),
    );
    const total = parseInt(countRows[0].count, 10);

    params.push(limit + 1);
    const { rows } = await pool.query(
      `SELECT id, seller_id, title, description, price_minor, currency, status, created_at, updated_at
       FROM listings
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

    return res.json(collectionResponse(data.map(formatListing), total, limit, nextCursor));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/listings/:id ────────────────────────────────────────────────
// Action 2: buyer views a single listing
// Index: PRIMARY KEY (id) — O(log n) lookup (REQ-LISTING-002)
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.id, l.seller_id, l.title, l.description,
              l.price_minor, l.currency, l.status, l.created_at, l.updated_at,
              s.name AS seller_name, s.email AS seller_email
       FROM listings l
       JOIN sellers s ON s.id = l.seller_id
       WHERE l.id = $1 AND l.deleted_at IS NULL`,
      [req.params.id],
    );
    if (!rows[0]) {
      return res.status(404).json(errorResponse('NOT_FOUND', 'Listing not found'));
    }
    return res.json(itemResponse(formatListingDetail(rows[0])));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/listings ───────────────────────────────────────────────────
// Action 4: seller creates a listing (REQ-SELLER-001)
router.post('/', validateBody(listingCreate), async (req, res, next) => {
  try {
    const { sellerId, title, description, priceMinor, currency, status } = req.validBody;

    // Confirm seller exists (REQ-CONSTRAINT-002)
    const { rows: sellerRows } = await pool.query(
      `SELECT id FROM sellers WHERE id = $1 AND deleted_at IS NULL`,
      [sellerId],
    );
    if (!sellerRows[0]) {
      return res.status(422).json(errorResponse('VALIDATION_ERROR', `sellerId: seller '${sellerId}' not found`));
    }

    const { rows } = await pool.query(
      `INSERT INTO listings (seller_id, title, description, price_minor, currency, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [sellerId, title, description, priceMinor, currency, status],
    );

    return res.status(201).json(itemResponse(formatListing(rows[0])));
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/v1/listings/:id ─────────────────────────────────────────────
// Action 4: seller updates a listing (REQ-SELLER-002)
// Enforces listing state machine (REQ-LISTING-003)
router.patch('/:id', validateBody(listingUpdate), async (req, res, next) => {
  try {
    const { rows: existing } = await pool.query(
      `SELECT * FROM listings WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id],
    );
    if (!existing[0]) {
      return res.status(404).json(errorResponse('NOT_FOUND', 'Listing not found'));
    }

    const current = existing[0];
    const updates = req.validBody;

    // Validate state transition if status is being changed
    if (updates.status && updates.status !== current.status) {
      const allowed = LISTING_TRANSITIONS[current.status] || [];
      if (!allowed.includes(updates.status)) {
        return res.status(422).json(
          errorResponse(
            'INVALID_TRANSITION',
            `Listing cannot transition from ${current.status} to ${updates.status}. Allowed: ${allowed.join(', ') || 'none'}`,
          ),
        );
      }
    }

    const setClauses = [];
    const params     = [];

    if (updates.title !== undefined) {
      params.push(updates.title);
      setClauses.push(`title = $${params.length}`);
    }
    if (updates.description !== undefined) {
      params.push(updates.description);
      setClauses.push(`description = $${params.length}`);
    }
    if (updates.priceMinor !== undefined) {
      params.push(updates.priceMinor);
      setClauses.push(`price_minor = $${params.length}`);
    }
    if (updates.currency !== undefined) {
      params.push(updates.currency);
      setClauses.push(`currency = $${params.length}`);
    }
    if (updates.status !== undefined) {
      params.push(updates.status);
      setClauses.push(`status = $${params.length}`);
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const { rows } = await pool.query(
      `UPDATE listings SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );

    return res.json(itemResponse(formatListing(rows[0])));
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/v1/listings/:id ────────────────────────────────────────────
// Soft delete (REQ-TIME-003 — deletedAt marks inactive)
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE listings SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [req.params.id],
    );
    if (!rows[0]) {
      return res.status(404).json(errorResponse('NOT_FOUND', 'Listing not found'));
    }
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatListing(row) {
  return {
    id:          row.id,
    sellerId:    row.seller_id,
    title:       row.title,
    description: row.description,
    priceMinor:  Number(row.price_minor),
    currency:    row.currency,
    status:      row.status,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

function formatListingDetail(row) {
  return {
    ...formatListing(row),
    seller: {
      id:    row.seller_id,
      name:  row.seller_name,
      email: row.seller_email,
    },
  };
}

module.exports = router;

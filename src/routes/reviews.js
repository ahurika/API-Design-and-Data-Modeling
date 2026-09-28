// src/routes/reviews.js
// Action 5: Buyer reviews a completed order (REQ-BUYER-004, REQ-REVIEW-001)
// GET /api/v1/reviews        — list reviews (paginated, filtered, sorted)
// GET /api/v1/reviews/:id    — single review
// POST /api/v1/reviews       — create review (REQ-REVIEW-002 invariants)
// PATCH /api/v1/reviews/:id  — update rating/comment
// DELETE /api/v1/reviews/:id — 422: reviews are permanent records (ERD §29)
//
// Business rules enforced here (ERD §33):
//   1. Review requires a COMPLETED order
//   2. Review.buyerId must match order.buyerId
//   3. Review.listingId must match order.listingId
//   4. One review per order (UNIQUE(order_id) is also enforced at DB level)

'use strict';

const express = require('express');
const pool    = require('../db/pool');
const { reviewListQuery, reviewCreate, reviewUpdate } = require('../schemas');
const { validateQuery, validateBody } = require('../middleware/validate');
const { collectionResponse, itemResponse, errorResponse } = require('../lib/response');
const { encodeCursor, decodeCursor } = require('../lib/cursor');

const router = express.Router();

// ─── GET /api/v1/reviews ─────────────────────────────────────────────────────
// Index used: idx_reviews_listing_id_created_at (REQ-INDEX-005)
router.get('/', validateQuery(reviewListQuery), async (req, res, next) => {
  try {
    const {
      limit, cursor, sort = 'created_at', order,
      buyerId, listingId, rating,
    } = req.validQuery;

    const direction = order === 'asc' ? 'ASC' : 'DESC';
    const operator  = order === 'asc' ? '>'  : '<';

    const params = [];
    const where  = [];

    if (buyerId) {
      params.push(buyerId);
      where.push(`buyer_id = $${params.length}`);
    }
    if (listingId) {
      params.push(listingId);
      where.push(`listing_id = $${params.length}`);
    }
    if (rating) {
      params.push(rating);
      where.push(`rating = $${params.length}`);
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

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Total count ignores cursor but honours active filters (REQ-API-004)
    const filterParamCount = params.length - (cursor ? 2 : 0);
    const cursorClause     = cursor ? where.pop() : null;
    const countWhere       = where.join(' AND ');
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM reviews ${countWhere ? `WHERE ${countWhere}` : ''}`,
      params.slice(0, filterParamCount),
    );
    const total = parseInt(countRows[0].count, 10);
    if (cursorClause) where.push(cursorClause);

    params.push(limit + 1);
    const { rows } = await pool.query(
      `SELECT id, buyer_id, listing_id, order_id, rating, comment, created_at, updated_at
       FROM reviews
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

    return res.json(collectionResponse(data.map(formatReview), total, limit, nextCursor));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/reviews/:id ─────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, buyer_id, listing_id, order_id, rating, comment, created_at, updated_at
       FROM reviews WHERE id = $1`,
      [req.params.id],
    );
    if (!rows[0]) {
      return res.status(404).json(errorResponse('NOT_FOUND', 'Review not found'));
    }
    return res.json(itemResponse(formatReview(rows[0])));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/reviews ────────────────────────────────────────────────────
// Action 5: buyer reviews a completed order (REQ-BUYER-004, REQ-REVIEW-002)
// Runs inside one transaction (ERD §43).
router.post('/', validateBody(reviewCreate), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { buyerId, listingId, orderId, rating, comment } = req.validBody;

    // 1. Order must exist (REQ-CONSTRAINT-004)
    const { rows: orderRows } = await client.query(
      `SELECT buyer_id, listing_id, status FROM orders WHERE id = $1`,
      [orderId],
    );
    if (!orderRows[0]) {
      await client.query('ROLLBACK');
      return res.status(422).json(errorResponse('VALIDATION_ERROR', `orderId: order '${orderId}' not found`));
    }

    // 2. Order must be COMPLETED (business rule #1 — ERD §20/§33)
    if (orderRows[0].status !== 'COMPLETED') {
      await client.query('ROLLBACK');
      return res.status(422).json(
        errorResponse('VALIDATION_ERROR', `orderId: only COMPLETED orders can be reviewed (current status: ${orderRows[0].status})`),
      );
    }

    // 3. Review buyer must match the order buyer (business rule #2)
    if (orderRows[0].buyer_id !== buyerId) {
      await client.query('ROLLBACK');
      return res.status(422).json(
        errorResponse('VALIDATION_ERROR', `buyerId: buyer '${buyerId}' does not own order '${orderId}'`),
      );
    }

    // 4. Review listing must match the order listing (business rule #3)
    if (orderRows[0].listing_id !== listingId) {
      await client.query('ROLLBACK');
      return res.status(422).json(
        errorResponse('VALIDATION_ERROR', `listingId: listing '${listingId}' is not the listing purchased by order '${orderId}'`),
      );
    }

    // 5. One review per order (REQ-CONSTRAINT-004 / REQ-REL-006)
    const { rows: dupRows } = await client.query(
      `SELECT id FROM reviews WHERE order_id = $1`,
      [orderId],
    );
    if (dupRows[0]) {
      await client.query('ROLLBACK');
      return res.status(422).json(
        errorResponse('VALIDATION_ERROR', `orderId: order '${orderId}' already has a review`),
      );
    }

    // 6. Create review
    const { rows } = await client.query(
      `INSERT INTO reviews (buyer_id, listing_id, order_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [buyerId, listingId, orderId, rating, comment],
    );

    await client.query('COMMIT');
    return res.status(201).json(itemResponse(formatReview(rows[0])));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── PATCH /api/v1/reviews/:id ───────────────────────────────────────────────
// Editing a review only changes rating/comment; the purchase relationship is invariant.
router.patch('/:id', validateBody(reviewUpdate), async (req, res, next) => {
  try {
    const { rows: existing } = await pool.query(
      `SELECT id FROM reviews WHERE id = $1`,
      [req.params.id],
    );
    if (!existing[0]) {
      return res.status(404).json(errorResponse('NOT_FOUND', 'Review not found'));
    }

    const setClauses = [];
    const params     = [];

    if (req.validBody.rating !== undefined) {
      params.push(req.validBody.rating);
      setClauses.push(`rating = $${params.length}`);
    }
    if (req.validBody.comment !== undefined) {
      params.push(req.validBody.comment);
      setClauses.push(`comment = $${params.length}`);
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const { rows } = await pool.query(
      `UPDATE reviews SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );

    return res.json(itemResponse(formatReview(rows[0])));
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/v1/reviews/:id ──────────────────────────────────────────────
// Deletion policy (ERD §29): reviews are permanent records with no deletedAt
// column and are never deleted through normal product operations.
// Return a meaningful 422 rather than a fake success.
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id FROM reviews WHERE id = $1`,
      [req.params.id],
    );
    if (!rows[0]) {
      return res.status(404).json(errorResponse('NOT_FOUND', 'Review not found'));
    }
    return res.status(422).json(
      errorResponse('INVALID_OPERATION', 'Reviews are permanent records and cannot be deleted'),
    );
  } catch (err) {
    next(err);
  }
});

// ─── Formatter ───────────────────────────────────────────────────────────────

function formatReview(row) {
  return {
    id:        row.id,
    buyerId:   row.buyer_id,
    listingId: row.listing_id,
    orderId:   row.order_id,
    rating:    row.rating,
    comment:   row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = router;
// src/routes/orders.js
// Action 3: Buyer places an order — POST /api/v1/orders
// Order lifecycle management     — PATCH /api/v1/orders/:id
//
// Order state machine (REQ-ORDER-002):
//   PENDING → CONFIRMED
//   PENDING → CANCELLED
//   CONFIRMED → COMPLETED
//   CONFIRMED → CANCELLED
//   COMPLETED and CANCELLED are terminal — no further transitions allowed

'use strict';

const express = require('express');
const pool    = require('../db/pool');
const { orderListQuery, orderCreate, orderStatusUpdate } = require('../schemas');
const { validateQuery, validateBody } = require('../middleware/validate');
const { collectionResponse, itemResponse, errorResponse } = require('../lib/response');
const { encodeCursor, decodeCursor } = require('../lib/cursor');

const router = express.Router();

// Allowed order state transitions (REQ-ORDER-002)
const ORDER_TRANSITIONS = {
  PENDING:   ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

// ─── GET /api/v1/orders ──────────────────────────────────────────────────────
// Index used: idx_orders_buyer_id_created_at (REQ-INDEX-003)
router.get('/', validateQuery(orderListQuery), async (req, res, next) => {
  try {
    const {
      limit, cursor,
      sort = 'created_at', order,
      buyerId, listingId, status,
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
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
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

    // Count for total
    const filterParamCount = params.length - (cursor ? 2 : 0);
    const filterParams     = params.slice(0, filterParamCount);
    const countWhere       = where.filter((c) => !c.includes(operator)).join(' AND ');
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM orders ${countWhere ? `WHERE ${countWhere}` : ''}`,
      filterParams,
    );
    const total = parseInt(countRows[0].count, 10);

    params.push(limit + 1);
    const { rows } = await pool.query(
      `SELECT id, buyer_id, listing_id, quantity,
              unit_price_minor, total_amount_minor, currency,
              status, created_at, updated_at
       FROM orders
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

    return res.json(collectionResponse(data.map(formatOrder), total, limit, nextCursor));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/orders/:id ──────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, buyer_id, listing_id, quantity,
              unit_price_minor, total_amount_minor, currency,
              status, created_at, updated_at
       FROM orders WHERE id = $1`,
      [req.params.id],
    );
    if (!rows[0]) {
      return res.status(404).json(errorResponse('NOT_FOUND', 'Order not found'));
    }
    return res.json(itemResponse(formatOrder(rows[0])));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/orders ─────────────────────────────────────────────────────
// Action 3: buyer places an order (REQ-BUYER-003, REQ-ORDER-001)
// Deliberate Denormalisation #1: captures listing price at order time
// Deliberate Denormalisation #2: stores pre-computed total
router.post('/', validateBody(orderCreate), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { buyerId, listingId, quantity } = req.validBody;

    // 1. Validate buyer exists (REQ-CONSTRAINT-003)
    const { rows: buyerRows } = await client.query(
      `SELECT id FROM buyers WHERE id = $1 AND deleted_at IS NULL`,
      [buyerId],
    );
    if (!buyerRows[0]) {
      await client.query('ROLLBACK');
      return res.status(422).json(errorResponse('VALIDATION_ERROR', `buyerId: buyer '${buyerId}' not found`));
    }

    // 2. Validate listing exists and is ACTIVE
    const { rows: listingRows } = await client.query(
      `SELECT id, price_minor, currency, status FROM listings WHERE id = $1 AND deleted_at IS NULL`,
      [listingId],
    );
    if (!listingRows[0]) {
      await client.query('ROLLBACK');
      return res.status(422).json(errorResponse('VALIDATION_ERROR', `listingId: listing '${listingId}' not found`));
    }
    if (listingRows[0].status !== 'ACTIVE') {
      await client.query('ROLLBACK');
      return res.status(422).json(
        errorResponse('VALIDATION_ERROR', `listingId: listing is ${listingRows[0].status} — only ACTIVE listings can be ordered`),
      );
    }

    // 3. Capture price snapshot (Deliberate Denormalisation #1)
    const unitPriceMinor   = Number(listingRows[0].price_minor);
    const currency         = listingRows[0].currency;
    // 4. Calculate total (Deliberate Denormalisation #2)
    const totalAmountMinor = quantity * unitPriceMinor;

    // 5. Create order
    const { rows } = await client.query(
      `INSERT INTO orders
         (buyer_id, listing_id, quantity, unit_price_minor, total_amount_minor, currency, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
       RETURNING *`,
      [buyerId, listingId, quantity, unitPriceMinor, totalAmountMinor, currency],
    );

    await client.query('COMMIT');
    return res.status(201).json(itemResponse(formatOrder(rows[0])));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── PATCH /api/v1/orders/:id ────────────────────────────────────────────────
// Order status transitions only (REQ-ORDER-002 state machine)
router.patch('/:id', validateBody(orderStatusUpdate), async (req, res, next) => {
  try {
    const { rows: existing } = await pool.query(
      `SELECT * FROM orders WHERE id = $1`,
      [req.params.id],
    );
    if (!existing[0]) {
      return res.status(404).json(errorResponse('NOT_FOUND', 'Order not found'));
    }

    const current    = existing[0];
    const newStatus  = req.validBody.status;

    if (newStatus === current.status) {
      return res.json(itemResponse(formatOrder(current)));
    }

    const allowed = ORDER_TRANSITIONS[current.status] || [];
    if (!allowed.includes(newStatus)) {
      return res.status(422).json(
        errorResponse(
          'INVALID_TRANSITION',
          `Order cannot transition from ${current.status} to ${newStatus}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
        ),
      );
    }

    const { rows } = await pool.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newStatus, req.params.id],
    );

    return res.json(itemResponse(formatOrder(rows[0])));
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/v1/orders/:id ───────────────────────────────────────────────
// Orders are retained as historical records. Only PENDING orders may be cancelled.
// We treat DELETE as a soft-cancel rather than a physical delete.
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows: existing } = await pool.query(
      `SELECT status FROM orders WHERE id = $1`,
      [req.params.id],
    );
    if (!existing[0]) {
      return res.status(404).json(errorResponse('NOT_FOUND', 'Order not found'));
    }
    if (!['PENDING'].includes(existing[0].status)) {
      return res.status(422).json(
        errorResponse('INVALID_TRANSITION', 'Only PENDING orders can be cancelled via DELETE. Use PATCH to change status.'),
      );
    }
    await pool.query(
      `UPDATE orders SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
      [req.params.id],
    );
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Formatter ───────────────────────────────────────────────────────────────

function formatOrder(row) {
  return {
    id:               row.id,
    buyerId:          row.buyer_id,
    listingId:        row.listing_id,
    quantity:         row.quantity,
    unitPriceMinor:   Number(row.unit_price_minor),
    totalAmountMinor: Number(row.total_amount_minor),
    currency:         row.currency,
    status:           row.status,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  };
}

module.exports = router;

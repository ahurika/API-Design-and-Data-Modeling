// src/schemas/index.js
// Centralised Zod validation schemas (REQ-VALIDATION-001).
// Every request body and every set of query parameters is validated here
// so handlers contain no duplicated validation logic.

'use strict';

const { z } = require('zod');

// ─── Common building blocks ──────────────────────────────────────────────────

// cursor pagination list query (REQ-API-003, REQ-API-004)
// limit is CLAMPED to 100, never rejected (matrix: `limit=5000` → 200, 100 rows).
// list queries are strict: unknown filter params → 400 (matrix: unknown filter → 400).
const LIST_LIMIT = z.coerce.number().int().min(1).transform((v) => Math.min(v, 100));

const listQuery = z.object({
  limit:  LIST_LIMIT.default(20),
  cursor: z.string().optional(),
  sort:   z.string().optional(),
  order:  z.enum(['asc', 'desc']).default('desc'),
}).strict();

// ─── Buyers ─────────────────────────────────────────────────────────────────

const BUYER_SORT_FIELDS = ['created_at'];

const buyerListQuery = listQuery.extend({
  email:     z.string().email().optional(),
  createdAt: z.string().datetime({ offset: true }).optional(),
}).superRefine((data, ctx) => {
  if (data.sort && !BUYER_SORT_FIELDS.includes(data.sort)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sort'],
      message: `Unknown sort field '${data.sort}'. Allowed: ${BUYER_SORT_FIELDS.join(', ')}`,
    });
  }
});

// ─── Sellers ─────────────────────────────────────────────────────────────────

const SELLER_SORT_FIELDS = ['created_at'];

const sellerListQuery = listQuery.extend({
  email:     z.string().email().optional(),
  createdAt: z.string().datetime({ offset: true }).optional(),
}).superRefine((data, ctx) => {
  if (data.sort && !SELLER_SORT_FIELDS.includes(data.sort)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sort'],
      message: `Unknown sort field '${data.sort}'. Allowed: ${SELLER_SORT_FIELDS.join(', ')}`,
    });
  }
});

// ─── Listings ────────────────────────────────────────────────────────────────

const LISTING_STATUS_VALUES = ['DRAFT', 'ACTIVE', 'SOLD_OUT', 'ARCHIVED'];
const LISTING_SORT_FIELDS   = ['created_at', 'price_minor', 'title'];

const listingListQuery = listQuery.extend({
  sellerId: z.string().optional(),
  status:   z.enum(LISTING_STATUS_VALUES).optional(),
  currency: z.string().length(3).optional(),
}).superRefine((data, ctx) => {
  if (data.sort && !LISTING_SORT_FIELDS.includes(data.sort)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sort'],
      message: `Unknown sort field '${data.sort}'. Allowed: ${LISTING_SORT_FIELDS.join(', ')}`,
    });
  }
});

const listingCreate = z.object({
  sellerId:    z.string().min(1),
  title:       z.string().min(1).max(255),
  description: z.string().min(1),
  priceMinor:  z.number().int().min(0),
  currency:    z.string().length(3),
  status:      z.enum(LISTING_STATUS_VALUES).default('DRAFT'),
});

const listingUpdate = z.object({
  title:       z.string().min(1).max(255).optional(),
  description: z.string().min(1).optional(),
  priceMinor:  z.number().int().min(0).optional(),
  currency:    z.string().length(3).optional(),
  status:      z.enum(LISTING_STATUS_VALUES).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

// ─── Orders ──────────────────────────────────────────────────────────────────

const ORDER_STATUS_VALUES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
const ORDER_SORT_FIELDS   = ['created_at', 'total_amount_minor'];

const orderListQuery = listQuery.extend({
  buyerId:   z.string().optional(),
  listingId: z.string().optional(),
  status:    z.enum(ORDER_STATUS_VALUES).optional(),
}).superRefine((data, ctx) => {
  if (data.sort && !ORDER_SORT_FIELDS.includes(data.sort)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sort'],
      message: `Unknown sort field '${data.sort}'. Allowed: ${ORDER_SORT_FIELDS.join(', ')}`,
    });
  }
});

const orderCreate = z.object({
  buyerId:   z.string().min(1),
  listingId: z.string().min(1),
  quantity:  z.number().int().min(1),
});

const orderStatusUpdate = z.object({
  status: z.enum(ORDER_STATUS_VALUES),
});

// ─── Reviews ─────────────────────────────────────────────────────────────────

const REVIEW_SORT_FIELDS = ['created_at', 'rating'];

const reviewListQuery = listQuery.extend({
  buyerId:   z.string().optional(),
  listingId: z.string().optional(),
  rating:    z.coerce.number().int().min(1).max(5).optional(),
}).superRefine((data, ctx) => {
  if (data.sort && !REVIEW_SORT_FIELDS.includes(data.sort)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sort'],
      message: `Unknown sort field '${data.sort}'. Allowed: ${REVIEW_SORT_FIELDS.join(', ')}`,
    });
  }
});

const reviewCreate = z.object({
  buyerId:   z.string().min(1),
  listingId: z.string().min(1),
  orderId:   z.string().min(1),
  rating:    z.number().int().min(1).max(5),
  comment:   z.string().min(1),
});

const reviewUpdate = z.object({
  rating:  z.number().int().min(1).max(5).optional(),
  comment: z.string().min(1).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  listQuery,
  buyerListQuery,
  sellerListQuery,
  listingListQuery,
  listingCreate,
  listingUpdate,
  orderListQuery,
  orderCreate,
  orderStatusUpdate,
  reviewListQuery,
  reviewCreate,
  reviewUpdate,
  LISTING_STATUS_VALUES,
  ORDER_STATUS_VALUES,
};

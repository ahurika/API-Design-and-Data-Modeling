-- =============================================================================
-- Marketplace API — Database Migration
-- Implements the approved ERD from DATA_MODEL_ERD_SPECIFICATION.md
-- All decisions trace back to requirements in PRD.md
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
-- pgcrypto gives us gen_random_uuid() for generated, non-sequential IDs
-- REQ-ID-001: generated non-sequential identifiers prevent enumeration attacks
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ---------------------------------------------------------------------------
-- 1. ENUM types
-- REQ-LISTING-003 (listing lifecycle), REQ-ORDER-002 (order lifecycle)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE listing_status AS ENUM (
    'DRAFT',
    'ACTIVE',
    'SOLD_OUT',
    'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'PENDING',
    'CONFIRMED',
    'COMPLETED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ---------------------------------------------------------------------------
-- 2. BUYERS table
-- REQ-BUYER-001 – REQ-BUYER-004
-- Soft-delete: historical orders and reviews must retain their buyer identity
-- REQ-TIME-003 (deletedAt)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS buyers (
  id          TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ,

  CONSTRAINT buyers_pkey           PRIMARY KEY (id),
  CONSTRAINT buyers_email_unique   UNIQUE      (email)
);

COMMENT ON TABLE  buyers          IS 'REQ-BUYER-001 – REQ-BUYER-004. Soft-delete preserves historical order/review relationships.';
COMMENT ON COLUMN buyers.id       IS 'REQ-ID-001: generated non-sequential identifier.';
COMMENT ON COLUMN buyers.email    IS 'UNIQUE: one buyer record per email address.';
COMMENT ON COLUMN buyers.deleted_at IS 'REQ-TIME-003: soft-delete timestamp. NULL = active.';


-- ---------------------------------------------------------------------------
-- 3. SELLERS table
-- REQ-SELLER-001 – REQ-SELLER-003
-- Soft-delete: historical listings and orders must retain their seller identity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sellers (
  id          TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ,

  CONSTRAINT sellers_pkey          PRIMARY KEY (id),
  CONSTRAINT sellers_email_unique  UNIQUE      (email)
);

COMMENT ON TABLE  sellers          IS 'REQ-SELLER-001 – REQ-SELLER-003. Soft-delete preserves listing/order history.';
COMMENT ON COLUMN sellers.id       IS 'REQ-ID-001: generated non-sequential identifier.';
COMMENT ON COLUMN sellers.deleted_at IS 'REQ-TIME-003: soft-delete. NULL = active.';


-- ---------------------------------------------------------------------------
-- 4. LISTINGS table
-- REQ-LISTING-001 – REQ-LISTING-003, REQ-SELLER-003
-- Money: REQ-MONEY-001 (minor units), REQ-MONEY-002 (adjacent currency column)
-- Soft-delete: historical orders and reviews reference listing rows
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS listings (
  id           TEXT            NOT NULL DEFAULT gen_random_uuid()::TEXT,
  seller_id    TEXT            NOT NULL,
  title        TEXT            NOT NULL,
  description  TEXT            NOT NULL,
  price_minor  BIGINT          NOT NULL,   -- whole-number minor units (REQ-MONEY-001)
  currency     TEXT            NOT NULL,   -- ISO 4217 code (REQ-MONEY-002)
  status       listing_status  NOT NULL DEFAULT 'DRAFT',
  created_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,

  CONSTRAINT listings_pkey              PRIMARY KEY (id),
  CONSTRAINT listings_seller_fk         FOREIGN KEY (seller_id) REFERENCES sellers(id),
  CONSTRAINT listings_price_nonneg      CHECK       (price_minor >= 0)
  -- NOTE: currency length check is intentionally left to application layer
  -- to allow flexible ISO-4217 codes without hard-coding a list here.
);

COMMENT ON TABLE  listings             IS 'REQ-LISTING-001 – REQ-LISTING-003. Soft-delete retains order/review history.';
COMMENT ON COLUMN listings.seller_id   IS 'REQ-SELLER-003, REQ-CONSTRAINT-002: FK to sellers.id. A listing cannot exist without a valid seller.';
COMMENT ON COLUMN listings.price_minor IS 'REQ-MONEY-001: integer minor units (e.g. 250000 = NGN 2,500.00 at 100 kobo/naira).';
COMMENT ON COLUMN listings.currency    IS 'REQ-MONEY-002: ISO 4217 currency code always alongside the monetary amount.';
COMMENT ON COLUMN listings.status      IS 'REQ-LISTING-003: enum enforces only known lifecycle values.';


-- ---------------------------------------------------------------------------
-- 5. ORDERS table
-- REQ-ORDER-001 – REQ-ORDER-003, REQ-BUYER-003
-- Money snapshot: Deliberate Denormalisation #1 (unitPriceMinor) and #2 (totalAmountMinor)
-- No soft-delete: orders are historical transaction records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                  TEXT          NOT NULL DEFAULT gen_random_uuid()::TEXT,
  buyer_id            TEXT          NOT NULL,
  listing_id          TEXT          NOT NULL,
  quantity            INTEGER       NOT NULL,
  unit_price_minor    BIGINT        NOT NULL,   -- snapshot of listing price at order time
  total_amount_minor  BIGINT        NOT NULL,   -- = quantity * unit_price_minor (stored for read convenience)
  currency            TEXT          NOT NULL,
  status              order_status  NOT NULL DEFAULT 'PENDING',
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT orders_pkey                  PRIMARY KEY (id),
  CONSTRAINT orders_buyer_fk              FOREIGN KEY (buyer_id)   REFERENCES buyers(id),
  CONSTRAINT orders_listing_fk            FOREIGN KEY (listing_id) REFERENCES listings(id),
  CONSTRAINT orders_quantity_positive     CHECK (quantity > 0),
  CONSTRAINT orders_unit_price_nonneg     CHECK (unit_price_minor >= 0),
  CONSTRAINT orders_total_amount_nonneg   CHECK (total_amount_minor >= 0)
);

COMMENT ON TABLE  orders                    IS 'REQ-ORDER-001 – REQ-ORDER-003. No deletion policy — historical record.';
COMMENT ON COLUMN orders.unit_price_minor   IS 'Deliberate Denormalisation #1: price captured at order time so history is stable even if listing.price_minor changes later.';
COMMENT ON COLUMN orders.total_amount_minor IS 'Deliberate Denormalisation #2: quantity × unit_price_minor stored explicitly for fast reads without re-computation.';
COMMENT ON COLUMN orders.status             IS 'REQ-ORDER-002: enum enforces only known lifecycle states; transitions enforced in application layer.';


-- ---------------------------------------------------------------------------
-- 6. REVIEWS table
-- REQ-REVIEW-001 – REQ-REVIEW-002, REQ-CONSTRAINT-004
-- No soft-delete: reviews are permanent user-generated content records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id          TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  buyer_id    TEXT        NOT NULL,
  listing_id  TEXT        NOT NULL,
  order_id    TEXT        NOT NULL,
  rating      SMALLINT    NOT NULL,
  comment     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT reviews_pkey              PRIMARY KEY (id),
  CONSTRAINT reviews_buyer_fk          FOREIGN KEY (buyer_id)   REFERENCES buyers(id),
  CONSTRAINT reviews_listing_fk        FOREIGN KEY (listing_id) REFERENCES listings(id),
  CONSTRAINT reviews_order_fk          FOREIGN KEY (order_id)   REFERENCES orders(id),
  CONSTRAINT reviews_order_unique      UNIQUE      (order_id),           -- REQ-REL-006, REQ-CONSTRAINT-004: one review per order
  CONSTRAINT reviews_rating_range      CHECK       (rating >= 1 AND rating <= 5)
);

COMMENT ON TABLE  reviews              IS 'REQ-REVIEW-001 – REQ-REVIEW-002. No deletion — permanent review record.';
COMMENT ON COLUMN reviews.order_id     IS 'UNIQUE: REQ-REL-006 enforces 0..1 review per order. Also FK: review cannot reference non-existent order.';
COMMENT ON COLUMN reviews.rating       IS 'CHECK (1–5): invalid ratings are impossible at database level.';


-- =============================================================================
-- INDEXES — derived from the five important user actions (REQ-INDEX-001)
-- =============================================================================

-- Action 1 — Buyer discovers listings: WHERE status = 'ACTIVE' ORDER BY created_at DESC
-- Also supports currency filter (REQ-INDEX-002, REQ-API-005)
CREATE INDEX IF NOT EXISTS idx_listings_status_created_at
  ON listings (status, created_at DESC);

-- Action 1 — Filter by status + currency, sort by price (REQ-INDEX-002, REQ-API-005, REQ-API-006)
CREATE INDEX IF NOT EXISTS idx_listings_status_currency_price
  ON listings (status, currency, price_minor);

-- Action 4 — Seller manages listings: WHERE seller_id = ? ORDER BY created_at DESC (REQ-INDEX-004)
CREATE INDEX IF NOT EXISTS idx_listings_seller_id_created_at
  ON listings (seller_id, created_at DESC);

-- Action 3 — Buyer views orders: WHERE buyer_id = ? ORDER BY created_at DESC (REQ-INDEX-003)
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id_created_at
  ON orders (buyer_id, created_at DESC);

-- Support filtering orders by listing and status
CREATE INDEX IF NOT EXISTS idx_orders_listing_id
  ON orders (listing_id);

-- Action 5 — Reviews on a listing: WHERE listing_id = ? ORDER BY created_at DESC (REQ-INDEX-005)
CREATE INDEX IF NOT EXISTS idx_reviews_listing_id_created_at
  ON reviews (listing_id, created_at DESC);

-- Support filtering reviews by buyer
CREATE INDEX IF NOT EXISTS idx_reviews_buyer_id
  ON reviews (buyer_id);

# Task 3: Data Model / ERD Specification

## Purpose
This is the approved physical data model for the Marketplace API. It defines every entity, column, type, identifier and cardinality, and is the single source of truth the schema in `src/db/schema.sql` implements. Any change to this document and the schema must stay in lock-step (check ``ERD matches schema`` in the checklist).

## Resources
Five entities: **Buyer**, **Seller**, **Listing**, **Order**, **Review**.

All primary identifiers are generated, non-sequential UUIDs (REQ-ID-001). Sequential integer IDs would let anyone enumerate the dataset, which is explicitly prohibited by the bootcamp brief and the PRD.

---

## 1. Buyers

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | TEXT (UUID v4) | No | `gen_random_uuid()` | Generated identifier (REQ-ID-001) |
| `name` | TEXT | No | — | |
| `email` | TEXT | No | — | UNIQUE: one buyer per email |
| `created_at` | TIMESTAMPTZ | No | `NOW()` | (REQ-TIME-001) |
| `updated_at` | TIMESTAMPTZ | No | `NOW()` | (REQ-TIME-002) |
| `deleted_at` | TIMESTAMPTZ | Yes | NULL | Soft delete (REQ-TIME-003) |

**Cardinalities**
- Buyers `1 ──<` Orders (`buyer_id`) — one buyer may have many orders (REQ-REL-001)
- Buyers `1 ──<` Reviews (`buyer_id`) — one buyer may create many reviews (REQ-REL-004)

**Deletion policy (REQ-TIME-003):** soft delete. A buyer's historical orders and reviews must remain resolvable, so the row is kept and flagged with `deleted_at`.

---

## 2. Sellers

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | TEXT (UUID v4) | No | `gen_random_uuid()` | Generated identifier (REQ-ID-001) |
| `name` | TEXT | No | — | |
| `email` | TEXT | No | — | UNIQUE: one seller per email |
| `created_at` | TIMESTAMPTZ | No | `NOW()` | (REQ-TIME-001) |
| `updated_at` | TIMESTAMPTZ | No | `NOW()` | (REQ-TIME-002) |
| `deleted_at` | TIMESTAMPTZ | Yes | NULL | Soft delete (REQ-TIME-003) |

**Cardinalities**
- Sellers `1 ──<` Listings (`seller_id`) — each listing belongs to exactly one seller (REQ-REL-002, REQ-SELLER-003)

**Deletion policy:** soft delete, to keep listing and order history resolvable.

---

## 3. Listings

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | TEXT (UUID v4) | No | `gen_random_uuid()` | Generated identifier (REQ-ID-001) |
| `seller_id` | TEXT (UUID v4) | No | — | FK → sellers.id (REQ-CONSTRAINT-002) |
| `title` | TEXT | No | — | |
| `description` | TEXT | No | — | |
| `price_minor` | BIGINT | No | — | Whole-number minor units (REQ-MONEY-001) |
| `currency` | TEXT | No | — | ISO 4217 code beside the amount (REQ-MONEY-002) |
| `status` | listing_status ENUM | No | `DRAFT` | Lifecycle enum (REQ-LISTING-003) |
| `created_at` | TIMESTAMPTZ | No | `NOW()` | (REQ-TIME-001) |
| `updated_at` | TIMESTAMPTZ | No | `NOW()` | (REQ-TIME-002) |
| `deleted_at` | TIMESTAMPTZ | Yes | NULL | Soft delete (REQ-TIME-003) |

**Cardinalities**
- Listings `1 ──<` Orders (`listing_id`) — one listing may be ordered many times (REQ-REL-003)
- Listings `1 ──<` Reviews (`listing_id`) — one listing may receive many reviews (REQ-REL-005)

**Deletion policy:** soft delete. Historical orders and reviews reference the listing row.

### Listing lifecycle (REQ-LISTING-003)
```
DRAFT ──► ACTIVE ──► SOLD_OUT
             │          │
             └──────────┴──► ARCHIVED
```
Allowed transitions:
| From | To |
|---|---|
| `DRAFT` | `ACTIVE` |
| `ACTIVE` | `SOLD_OUT`, `ARCHIVED` |
| `SOLD_OUT` | `ARCHIVED` |
| `ARCHIVED` | — (terminal) |

Every other transition is forbidden and rejected by the application layer with `422` (matrix: rejected lifecycle transitions). The enum makes unknown states impossible at the database level.

---

## 4. Orders

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | TEXT (UUID v4) | No | `gen_random_uuid()` | Generated identifier (REQ-ID-001) |
| `buyer_id` | TEXT (UUID v4) | No | — | FK → buyers.id (REQ-CONSTRAINT-003) |
| `listing_id` | TEXT (UUID v4) | No | — | FK → listings.id (REQ-CONSTRAINT-003) |
| `quantity` | INTEGER | No | — | CHECK > 0 |
| `unit_price_minor` | BIGINT | No | — | Price snapshot at order time — Denormalisation #1 (REQ-MONEY-001) |
| `total_amount_minor` | BIGINT | No | — | `quantity × unit_price_minor` stored — Denormalisation #2 (REQ-MONEY-001) |
| `currency` | TEXT | No | — | ISO 4217 (REQ-MONEY-002) |
| `status` | order_status ENUM | No | `PENDING` | Lifecycle enum (REQ-ORDER-002) |
| `created_at` | TIMESTAMPTZ | No | `NOW()` | (REQ-TIME-001) |
| `updated_at` | TIMESTAMPTZ | No | `NOW()` | (REQ-TIME-002) |

**Cardinalities**
- Orders `1 ── 0..1` Reviews (`order_id`) — at most one review per order (REQ-REL-006)

**Deletion policy:** **never deleted**. Orders are historical transaction records; no `deleted_at` column exists.

### Order lifecycle (REQ-ORDER-002)
```
PENDING ──► CONFIRMED ──► COMPLETED
    │            │
    └──► CANCELLED  ◄──┘   (cancel from PENDING or CONFIRMED)
```
Allowed transitions:
| From | To |
|---|---|
| `PENDING` | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | `COMPLETED`, `CANCELLED` |
| `COMPLETED` | — (terminal — a completed order cannot go backward) |
| `CANCELLED` | — (terminal) |

Forbidden transitions: `CANCELLED ─► CONFIRMED/COMPLETED`, `COMPLETED ─► anything`. Enforced in the application layer with `422`; the enum enforces value validity at the database level.

A review is only valid when its order is `COMPLETED` (REQ-REVIEW-002). This is enforced both at the API boundary (review creation checks the order status) and makes the review/order relationship impossible outside a completed purchase.

---

## 5. Reviews

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | TEXT (UUID v4) | No | `gen_random_uuid()` | Generated identifier (REQ-ID-001) |
| `buyer_id` | TEXT (UUID v4) | No | — | FK → buyers.id (REQ-CHECK-004) |
| `listing_id` | TEXT (UUID v4) | No | — | FK → listings.id (REQ-CHECK-004) |
| `order_id` | TEXT (UUID v4) | No | — | FK → orders.id (REQ-CHECK-004) |
| `rating` | SMALLINT | No | — | CHECK 1–5 |
| `comment` | TEXT | No | — | |
| `created_at` | TIMESTAMPTZ | No | `NOW()` | (REQ-TIME-001) |
| `updated_at` | TIMESTAMPTZ | No | `NOW()` | (REQ-TIME-002) |

**Cardinalities**
- Reviews belong to exactly one buyer, one listing and one order.
- UNIQUE on `order_id` enforces **one review per order** (REQ-REL-006).

**Deletion policy:** **never deleted**. Reviews are permanent user-generated content.

---

## 6. ERD

```
            ┌───────────────┐
            │    Seller     │
            └──────┬────────┘
                   │ 1
                   │
                   │ N
            ┌──────▼────────┐
            │    Listing    │
            │  seller_id FK │
            └──────┬────────┘
                   │ 1
          ┌────────┼────────┐
          │N              1│
┌─────────▼────────┐  ┌─────▼────────┐
│      Order       │  │    Review    │
│ buyer_id FK      │  │ listing_id FK│
│ listing_id FK    │  │   order_id FK│
└──┬──────────┬────┘  │  buyer_id FK │
   │ 1        │1       └─────────────┘
   │          └───0..1 Review
   │
   │ N
┌──▼──────────┐
│   Buyer     │
└─────────────┘

Buyer, Seller, Listing, Order, Review
Cardinalities:
  Seller 1 ─ N Listing        (REQ-REL-002)
  Listing 1 ─ N Order         (REQ-REL-003)
  Buyer 1 ─ N Order           (REQ-REL-001)
  Buyer 1 ─ N Review          (REQ-REL-004)
  Listing 1 ─ N Review        (REQ-REL-005)
  Order 1 ─ 0..1 Review       (REQ-REL-006) — enforced by UNIQUE(order_id)
```

A matching diagram is committed as evidence (``evidence/ERD-diagram.png``, source SVG embedded in ``evidence/ERD-diagram-source.html``).

---

## 7. Constraints and integrity

| Table | Constraint | Purpose |
|---|---|---|
| buyers | `buyers_pkey` PRIMARY KEY | identity |
| buyers | `buyers_email_unique` UNIQUE | one buyer per email |
| sellers | `sellers_pkey` PRIMARY KEY | identity |
| sellers | `sellers_email_unique` UNIQUE | one seller per email |
| listings | `listings_pkey` PRIMARY KEY | identity |
| listings | `listings_seller_fk` FK → sellers | a listing cannot exist without seller (REQ-CONSTRAINT-002) |
| listings | `listings_price_nonneg` CHECK >= 0 | no negative prices (REQ-MONEY-001) |
| orders | `orders_pkey` PRIMARY KEY | identity |
| orders | `orders_buyer_fk` FK → buyers | order needs a buyer (REQ-CONSTRAINT-003) |
| orders | `orders_listing_fk` FK → listings | order needs a listing (REQ-CONSTRAINT-003) |
| orders | `orders_quantity_positive` CHECK > 0 | no zero/negative quantity |
| orders | `orders_unit_price_nonneg` / `orders_total_amount_nonneg` CHECK >= 0 | money sanity |
| reviews | `reviews_pkey` PRIMARY KEY | identity |
| reviews | `reviews_buyer_fk` / `reviews_listing_fk` / `reviews_order_fk` | review cannot exist without buyer/listing/order (REQ-CONSTRAINT-004) |
| reviews | `reviews_order_unique` UNIQUE | one review per order (REQ-REL-006) |
| reviews | `reviews_rating_range` CHECK 1..5 | invalid rating impossible |

**Invalid-state analysis (REQ-CONSTRAINT-005).** Which invalid states are made impossible by the database:
1. Foreign keys make an orphan listing, order or review impossible.
2. The unique email constraints make duplicate buyers/sellers impossible.
3. CHECK constraints make negative prices, bad quantities and out-of-range ratings impossible.
4. ENUM types make unknown status values impossible at the column level.
5. App-layer state validation (listing + order lifecycle) prevents backward/illegal transitions the database enum alone cannot express.

---

## 8. Indexes — mapped to the five important actions (REQ-INDEX-001)

| Index | Table | Columns | Serves |
|---|---|---|---|
| `idx_listings_status_created_at` | listings | `status, created_at DESC` | Action 1 — discover listings (status + recency sort) |
| `idx_listings_status_currency_price` | listings | `status, currency, price_minor` | Action 1 — filter status/currency, sort by price |
| `idx_listings_seller_id_created_at` | listings | `seller_id, created_at DESC` | Action 4 — seller manages own listings (REQ-INDEX-004) |
| `idx_orders_buyer_id_created_at` | orders | `buyer_id, created_at DESC` | Action 3 — buyer views their orders (REQ-INDEX-003) |
| `idx_orders_listing_id` | orders | `listing_id` | filter orders by listing |
| `idx_reviews_listing_id_created_at` | reviews | `listing_id, created_at DESC` | Action 5 — reviews on a listing (REQ-INDEX-005) |
| `idx_reviews_buyer_id` | reviews | `buyer_id` | filter reviews by buyer |
| PRIMARY KEY | all | `id` | item lookups — Action 2 |

---

## 9. Two deliberate denormalisations (REQ-NORMAL-002)

**Denormalisation 1 — order price snapshot.** `orders.unit_price_minor` copies the listing price at order time.
1. Duplicated: a monetary value also stored on `listings.price_minor`.
2. Why: the purchase history must not silently change if the seller later reprices the listing.
3. Authoritative source: `orders.unit_price_minor` for the order; the listing price remains authoritative only for future orders.
4. Consistency risk: stored snapshot can diverge from current listing price — intended and documented.
5. Controlled by: values are written once at order creation and never updated by the API.

**Denormalisation 2 — order total.** `orders.total_amount_minor` stores `quantity × unit_price_minor`.
1. Duplicated: a derived value.
2. Why: fast reads of the order total without per-read recomputation.
3. Authoritative source: `quantity` and `unit_price_minor` (the total is calculable).
4. Consistency risk: total could drift from quantity × unit price.
5. Controlled by: the CREATE handler computes both fields in the same insert; no PATCH handler modifies quantity or unit price independently of a full-state update.

---

## 10. Seven hard questions — answered in writing

**Q1. How do we represent money?**
Whole-number minor units in a BIGINT column (e.g. `price_minor = 250000`) with an ISO 4217 `currency` column always adjacent (REQ-MONEY-001/002). No floating point. `total_amount_minor` is the only place a product/derived amount is ever stored or returned.

**Q2. What identifiers do we use?**
Generated UUID v4 text identifiers (`gen_random_uuid()` from `pgcrypto`) for every public primary key (REQ-ID-001). Sequential integer IDs would let clients enumerate the dataset, which the brief forbids.

**Q3. What is each entity's deletion policy?**
Buyers, sellers and listings are soft-deleted (`deleted_at`) so historical orders/reviews stay resolvable. Orders and reviews are never deleted — orders are transaction history and reviews are permanent user content (REQ-TIME-003). The list endpoints filter out soft-deleted rows (`WHERE deleted_at IS NULL`).

**Q4. How do we make invalid states impossible?**
By layering database and application enforcement: FKs, unique constraints, CHECK constraints and ENUMs make orphan/duplicate/out-of-range/unknown-value states impossible in the database, while the listing and order lifecycle transitions are validated in the application layer (REQ-CONSTRAINT-005, REQ-LISTING-003, REQ-ORDER-002).

**Q5. How do we prevent a review on a non-completed order?**
At the API boundary the review-create handler verifies the referenced order is in `COMPLETED` state before insert; the FK + `UNIQUE(order_id)` constraints ensure a review can only reference a real order and that an order gets at most one review (REQ-REVIEW-002, REQ-REL-006, REQ-CONSTRAINT-004).

**Q6. How do we keep history stable while prices change?**
Orders snapshot `unit_price_minor` at creation (denormalisation #1) and store `total_amount_minor` (denormalisation #2). Repricing a listing after an order never rewrites that order (REQ-NORMAL-002, REQ-ORDER-003).

**Q7. Which indexes serve which action?**
Each of the five important user actions maps directly to a composite index (see table in §8): status+created for discovery, status+currency+price for filtered discovery, seller+created for seller management, buyer+created for order history, listing+created for reviews (REQ-INDEX-001..005).

---

## 11. Over-fetching and real-time analyses

**Over-fetching analysis.** The list endpoint selects all visible listing columns (`description` included) even though card-style consumers may not need the description until they open an item. This is a deliberate trade-off that keeps one query shape for the collection, at the cost of returning a heavier payload for minimal clients. The item detail endpoint adds a `JOIN` to sellers to include the seller name/email — a second, purpose-shaped payload that avoids over-fetching for list use. The count query runs as a lightweight `COUNT(*)` alongside the page query and is never joined to other tables, so pagination metadata does not multiply rows fetched.

**Real-time analysis.** All reads execute against the live PostgreSQL database with no application-level cache. A new listing, updated status or new review is visible on the very next list/detail request. The cursor is derived from real row values (`created_at`, `id`) rather than a wall-clock offset, so a page boundary that changes between requests either still resolves to the same snapshot or moves forward by one row — never backward, and never duplicates a row already returned. Rate limiting is the only intentionally non-durable state (per-instance, in-memory), which is acceptable for a throttle and is documented as such.

---

## 12. Validation guard checks
- Every `id` is a generated UUID, never sequential.
- Every entity has `created_at` and `updated_at`; soft-deleted entities have `deleted_at`.
- Money fields are BIGINT minor units with an adjacent currency column.
- FK, UNIQUE, CHECK and ENUM constraints match the tables above.
- Indexes in `src/db/schema.sql` match §8 exactly.
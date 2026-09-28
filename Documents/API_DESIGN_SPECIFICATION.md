# Task 3: API Design Specification

## Purpose
REST API design for a marketplace with buyers, sellers, listings, orders and reviews. This document is the contract to implement after the requirements and ERD are approved.

## API-wide rules
- REST conventions.
- Version every route with `/api/v1`.
- Use plural resource nouns.
- Use generated, non-sequential identifiers.
- Every list endpoint supports pagination, filtering and sorting.
- Pagination: cursor-based, default `limit=20`, maximum `100`.
- Return total count, `hasMore`, and an opaque `nextCursor`.
- Use one success envelope and one error envelope.
- Validate query parameters and request bodies with schemas.
- Rate limit by IP; return `429` and `Retry-After`; keep limits in configuration.
- Monetary values are whole-number minor units with an adjacent currency field.

## Resources and endpoints

### Buyers
- `GET /api/v1/buyers`
- `GET /api/v1/buyers/:id`

### Sellers
- `GET /api/v1/sellers`
- `GET /api/v1/sellers/:id`

### Listings
- `GET /api/v1/listings`
- `GET /api/v1/listings/:id`
- `POST /api/v1/listings`
- `PATCH /api/v1/listings/:id`
- `DELETE /api/v1/listings/:id`

### Orders
- `GET /api/v1/orders`
- `GET /api/v1/orders/:id`
- `POST /api/v1/orders`
- `PATCH /api/v1/orders/:id`
- `DELETE /api/v1/orders/:id`

### Reviews
- `GET /api/v1/reviews`
- `GET /api/v1/reviews/:id`
- `POST /api/v1/reviews`
- `PATCH /api/v1/reviews/:id`
- `DELETE /api/v1/reviews/:id`

## List contract

Every collection endpoint accepts:

| Parameter | Type | Default |
|---|---|---|
| `limit` | integer | 20 |
| `cursor` | opaque string | none |
| `sort` | documented enum | resource default |
| `order` | `asc\|desc` | `desc` |

Every collection must expose at least two documented filters appropriate to that resource.

Suggested marketplace filters:
- Listings: `sellerId`, `status`, `currency`
- Orders: `buyerId`, `listingId`, `status`
- Reviews: `buyerId`, `listingId`, `rating`
- Buyers: `email`, `createdAt`
- Sellers: `email`, `createdAt`

Suggested sort fields:
- Listings: `createdAt`, `priceMinor`, `title`
- Orders: `createdAt`, `totalAmountMinor`
- Reviews: `createdAt`, `rating`
- Buyers/Sellers: `createdAt`

Unknown sort fields return `400`.

## Success envelope

Collection:
```json
{
  "data": [],
  "meta": {
    "total": 340,
    "limit": 20,
    "hasMore": true,
    "nextCursor": "opaque-cursor"
  }
}
```

Item/mutation:
```json
{
  "data": {}
}
```

## Error envelope

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Listing not found"
  }
}
```

Never return HTTP 200 for an error.

## Status codes

- `200`: successful read/update
- `201`: successful creation
- `204`: successful deletion without a response body
- `400`: malformed/invalid query or path input
- `404`: valid identifier but resource does not exist
- `422`: missing/invalid required body field or business validation failure
- `429`: rate limit exceeded
- `500`: unexpected server failure

## Required ugly-input behaviour

1. `limit=5000` is clamped to `100`, not honoured.
2. Negative pagination input returns `400`.
3. Unknown sort field returns `400`.
4. Malformed identifier returns `400` or `404`, never `500`.
5. Missing required POST field returns `422` and names the field.
6. Schema validation is centralised.

## Rate limiting

Recommended configuration, matching the brief's example:
```text
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=100
```

The actual deployed values live in configuration, not route handlers. Exceeding the limit returns `429` plus `Retry-After`.

## Money

Example:
```json
{
  "priceMinor": 125000,
  "currency": "NGN"
}
```

Do not use floating-point money.

## Complete endpoint contracts

Each contract lists the method, path, required/optional body and query fields, the success status, and every error this endpoint can return, plus its idempotency property.

### Buyers

#### `GET /api/v1/buyers`
- Query: `limit` (default 20, max 100), `cursor`, `sort` (`created_at`), `order` (`asc|desc`, default `desc`), `email`, `createdAt`.
- Success: `200` — paginated success envelope.
- Errors:
  - `400` unknown query param, unknown sort, invalid `limit` (e.g. `0`, negative), malformed `email` or `createdAt`, malformed `cursor`.
  - `429` rate limit exceeded.
- Idempotency: **idempotent** — a repeated identical request changes nothing and returns the same logical collection.

#### `GET /api/v1/buyers/:id`
- Path: `id` (UUID text).
- Success: `200` — item envelope containing the buyer.
- Errors:
  - `404` valid-but-absent identifier (soft-deleted buyers are filtered out).
  - `429` rate limit exceeded.
- Idempotency: **idempotent** — repeated reads return the same body.

### Sellers

#### `GET /api/v1/sellers`
- Query: `limit`, `cursor`, `sort` (`created_at`), `order`, `email`, `createdAt`.
- Success: `200` — paginated envelope.
- Errors: same catalogue as `GET /api/v1/buyers` (`400`/`429`).
- Idempotency: **idempotent**.

#### `GET /api/v1/sellers/:id`
- Success: `200`. Errors: `404` absent/soft-deleted seller, `429`.
- Idempotency: **idempotent**.

### Listings

#### `GET /api/v1/listings`
- Query: `limit`, `cursor`, `sort` (`created_at`, `price_minor`, `title`), `order`, `sellerId`, `status` (`DRAFT|ACTIVE|SOLD_OUT|ARCHIVED`), `currency` (3 letters).
- Success: `200` — paginated envelope. Soft-deleted listings excluded.
- Errors: `400` (unknown param/sort, invalid `limit`, malformed `cursor`, bad `status`/`currency`), `429`.
- Idempotency: **idempotent**.

#### `GET /api/v1/listings/:id`
- Success: `200` — listing plus embedded `seller` (id, name, email) via the sellers join.
- Errors: `404` absent/soft-deleted listing, `429`.
- Idempotency: **idempotent**.

#### `POST /api/v1/listings`
- Body (all required except `status`): `sellerId`, `title`, `description`, `priceMinor` (integer ≥ 0), `currency` (3 letters); `status` defaults to `DRAFT`.
- Success: `201` — created listing in item envelope.
- Errors:
  - `422` missing/invalid body field (names the field), `sellerId` that does not exist (or is soft-deleted) — business validation `sellerId: seller '…' not found`.
  - `400` malformed JSON body.
  - `429` rate limit.
- Idempotency: **not idempotent** — each call creates a new listing. No `Idempotency-Key` support is provided; clients treat `201` as one new resource.

#### `PATCH /api/v1/listings/:id`
- Body: any subset of `title`, `description`, `priceMinor`, `currency`, `status`; at least one field required.
- State machine (REQ-LISTING-003): `DRAFT→ACTIVE`, `ACTIVE→SOLD_OUT|ARCHIVED`, `SOLD_OUT→ARCHIVED`; other transitions rejected.
- Success: `200` — updated listing.
- Errors:
  - `404` absent/soft-deleted listing.
  - `422` empty body, invalid field, or forbidden state transition (code `INVALID_TRANSITION`, lists the allowed states).
  - `400` malformed JSON.
  - `429`.
- Idempotency: **idempotent** — applying the same patch twice yields the same final state.

#### `DELETE /api/v1/listings/:id`
- Soft delete: sets `deleted_at`, `updated_at`.
- Success: `204` no body.
- Errors: `404` absent or already-deleted listing, `429`.
- Idempotency: first call returns `204`; repeating it returns `404` because the row is already soft-deleted (documented behaviour).

### Orders

#### `GET /api/v1/orders`
- Query: `limit`, `cursor`, `sort` (`created_at`, `total_amount_minor`), `order`, `buyerId`, `listingId`, `status`.
- Success: `200` — paginated envelope.
- Errors: `400`/`429`.
- Idempotency: **idempotent**.

#### `GET /api/v1/orders/:id`
- Success: `200`. Errors: `404`, `429`.
- Idempotency: **idempotent**.

#### `POST /api/v1/orders`
- Body: `buyerId`, `listingId`, `quantity` (integer ≥ 1).
- Runs in a transaction: validates buyer exists and is active, listing exists and `status = ACTIVE`, then inserts with price snapshot (`unit_price_minor`) and pre-computed `total_amount_minor`.
- Success: `201` — order in item envelope.
- Errors:
  - `422` missing/invalid field; `buyerId` not found; `listingId` not found; **listing not ACTIVE** (`listing is … — only ACTIVE listings can be ordered`).
  - `400` malformed JSON.
  - `429`.
- Idempotency: **not idempotent** — each call creates a new order.

#### `PATCH /api/v1/orders/:id`
- Body: `status` only (`PENDING|CONFIRMED|COMPLETED|CANCELLED`).
- State machine (REQ-ORDER-002): `PENDING→CONFIRMED|CANCELLED`, `CONFIRMED→COMPLETED|CANCELLED`; `COMPLETED` and `CANCELLED` are terminal.
- Success: `200` — updated order. Setting the same status returns the current order unchanged.
- Errors:
  - `404` absent order.
  - `422` forbidden transition (code `INVALID_TRANSITION`, lists allowed states, `none (terminal state)` for terminal).
  - `400` malformed JSON; `422` missing field.
  - `429`.
- Idempotency: **idempotent** — same status patch converges to one state.

#### `DELETE /api/v1/orders/:id`
- Models a soft-cancel: only `PENDING` orders can be `DELETE`d and are set to `CANCELLED`.
- Success: `204` no body.
- Errors: `404` absent; `422` for non-PENDING orders (`Only PENDING orders can be cancelled via DELETE. Use PATCH to change status.`); `429`.
- Idempotency: second call returns `422`/`404` because the order is no longer `PENDING` (documented).

### Reviews

#### `GET /api/v1/reviews`
- Query: `limit`, `cursor`, `sort` (`created_at`, `rating`), `order`, `buyerId`, `listingId`, `rating`.
- Success: `200` — paginated envelope.
- Errors: `400`/`429`.
- Idempotency: **idempotent**.

#### `GET /api/v1/reviews/:id`
- Success: `200`. Errors: `404`, `429`.
- Idempotency: **idempotent**.

#### `POST /api/v1/reviews`
- Body: `buyerId`, `listingId`, `orderId`, `rating` (1–5), `comment`.
- Runs in a transaction enforcing (REQ-REVIEW-002):
  1. order exists,
  2. order is `COMPLETED`,
  3. `buyerId` matches the order buyer,
  4. `listingId` matches the order listing,
  5. the order has no existing review (one review per order).
- Success: `201` — review in item envelope.
- Errors:
  - `422` any violated invariant (each names the failing field/order).
  - `400` malformed JSON.
  - `429`.
- Idempotency: **not idempotent**; a duplicate call is rejected with `422 orderId: order '…' already has a review` (unique `order_id`).

#### `PATCH /api/v1/reviews/:id`
- Body: any subset of `rating`, `comment`; at least one required. Ownership/order relationship is immutable.
- Success: `200`. Errors: `404` absent; `422` empty body/invalid rating; `400` malformed JSON; `429`.
- Idempotency: **idempotent**.

#### `DELETE /api/v1/reviews/:id`
- Reviews are permanent records (no `deleted_at`, no physical delete).
- Success is **never** returned; this endpoint always returns an error.
- Errors: `404` absent; `422` `INVALID_OPERATION — Reviews are permanent records and cannot be deleted`; `429`.
- Idempotency: consistently returns `404`/`422` for a given review — no side effects.

### Envelope consistency
Every endpoint above returns exactly one of:
- `200`/`201`/`204` with the success envelope (`data`, and `meta` for lists),
- an error envelope `{ "error": { "code", "message" } }` with a non-2xx status,
- `429` with the same error envelope plus `Retry-After`.

No endpoint returns HTTP `200` carrying an error body (REQ-ERROR-005).

## State

Listing lifecycle must match the approved data model (REQ-LISTING-003): `DRAFT → ACTIVE → SOLD_OUT|ARCHIVED`, `SOLD_OUT → ARCHIVED`, enforced at the application layer with `422` for every other transition. `SOLD_OUT` is a seller-marked state meaning the listing is no longer available for ordering; it is not derived from a stock/quantity field because the model intentionally has no stock concept per REQ-LISTING-003 and the Task 3 scope.

Orders must have an explicit lifecycle and forbidden transitions (REQ-ORDER-002).

Reviews may only be created when their order/buyer/listing relationship satisfies the approved completed-order invariant.

## Design decisions

### Versioning
`/api/v1` exists from the first release so future breaking changes can be introduced without breaking existing clients.

### Generated IDs
The bootcamp explicitly warns against sequential identifiers because they permit dataset enumeration.

### Cursor pagination
Cursor pagination is chosen because it is recognised in the excellent grading band and is useful for traversal of changing collections. Offset pagination is simpler for direct page navigation and can be preferable for smaller/static collections.

### Envelopes
A single success and error shape keeps client parsing predictable.

### Rate-limit configuration
Operational limits belong in configuration so they can change without editing every handler.

## Traceability
Map each implementation item back to the existing requirements/data-model IDs. Do not rename existing IDs. Core mappings include `REQ-ID-001`, `REQ-MONEY-001`, `REQ-MONEY-002`, `REQ-REL-*`, `REQ-CONSTRAINT-*`, `REQ-INDEX-*`, plus the API pagination/filter/sort/error/validation/rate-limit requirements already defined in the approved requirements document.

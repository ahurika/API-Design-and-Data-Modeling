# Marketplace API

A versioned REST API for a marketplace with **buyers**, **sellers**, **listings**, **orders** and **reviews**.

Read from the README alone, a developer can call every endpoint.

---

## Base URL

- Production: `https://<PUBLIC_API_URL>/api/v1`
- Development: `http://localhost:<PORT>/api/v1`

The consumer (`consumer/index.html`) calls **only** the public URL.

---

## API-wide conventions

- Every route is under `/api/v1` (REQ-API-001).
- Resources use plural nouns (REQ-API-002).
- Identifiers are generated UUIDs, never sequential integers (REQ-ID-001).
- Money is a whole number in minor units plus an ISO 4217 currency column (REQ-MONEY-001, REQ-MONEY-002). No floats.
- Every list is cursor-paginated, filtered and sorted. Default `limit=20`, maximum `limit=100` (REQ-API-003, REQ-API-004).
- Every response uses one of two envelopes (REQ-API-007, REQ-API-008).

### Success envelope — collection

```json
{
  "data": [],
  "meta": {
    "total": 340,
    "limit": 20,
    "hasMore": true,
    "nextCursor": "opaque-cursor-string"
  }
}
```

### Success envelope — item / mutation

```json
{
  "data": {}
}
```

### Error envelope

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Listing not found"
  }
}
```

Errors are never returned inside an HTTP 200 (REQ-ERROR-005).

---

## Status codes

| Code | Meaning |
|---|---|
| `200` | Successful read or update |
| `201` | Successful creation |
| `204` | Successful deletion (no body) |
| `400` | Malformed/invalid query or path input |
| `404` | Valid identifier but resource does not exist |
| `422` | Missing/invalid required body field or business validation failure |
| `429` | Rate limit exceeded |
| `500` | Unexpected server failure |

---

## Pagination

All list endpoints accept:

| Parameter | Type | Default | Rules |
|---|---|---|---|
| `limit` | integer | `20` | clamped to max `100` |
| `cursor` | opaque string | none | token from the previous page's `meta.nextCursor` |
| `sort` | documented enum | resource default | unknown value returns `400` |
| `order` | `asc` / `desc` | `desc` | invalid value returns `400` |

Every list accepts at least two filters. The `meta` block always returns `total`, `limit`, `hasMore` and `nextCursor` (REQ-API-004).

---

## Rate limiting

IP-keyed (REQ-RATE-001). Limits live in **configuration**, not handlers (REQ-RATE-002):

```text
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=100
```

When exceeded the API returns `429` with a `Retry-After` header and the standard error envelope (REQ-RATE-003):

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Limit is 100 per 60s. Retry after the Retry-After period."
  }
}
```

---

## Endpoint reference

### Buyers

#### `GET /api/v1/buyers` — list buyers

Filters: `email` (email), `createdAt` (RFC 3339 timestamp).
Sort fields: `created_at`.

```bash
curl "https://<PUBLIC_API_URL>/api/v1/buyers?limit=20&sort=created_at&order=desc"
```

Response `200`:

```json
{
  "data": [
    {
      "id": "e1060aa7-3b9f-4e1b-9b0d-1e2d5c6f7a8b",
      "name": "Buyer 3",
      "email": "buyer3@example.com",
      "createdAt": "2026-09-28T12:00:00.123456Z",
      "updatedAt": "2026-09-28T12:00:00.123456Z"
    }
  ],
  "meta": { "total": 50, "limit": 20, "hasMore": true, "nextCursor": "..." }
}
```

#### `GET /api/v1/buyers/:id` — get single buyer

```bash
curl "https://<PUBLIC_API_URL>/api/v1/buyers/<id>"
```

Response `200` with `{ "data": { ... } }`. Missing buyer → `404`.

---

### Sellers

#### `GET /api/v1/sellers` — list sellers

Filters: `email`, `createdAt`. Sort fields: `created_at`.

```bash
curl "https://<PUBLIC_API_URL>/api/v1/sellers?limit=20"
```

#### `GET /api/v1/sellers/:id` — get single seller

```bash
curl "https://<PUBLIC_API_URL>/api/v1/sellers/<id>"
```

---

### Listings

#### `GET /api/v1/listings` — list listings (Action 1: buyer discovers listings)

Filters: `sellerId`, `status` (`DRAFT|ACTIVE|SOLD_OUT|ARCHIVED`), `currency` (3-letter).
Sort fields: `created_at`, `price_minor`, `title`.

```bash
curl "https://<PUBLIC_API_URL>/api/v1/listings?status=ACTIVE&currency=NGN&sort=price_minor&limit=20&order=asc"
```

Response `200`:

```json
{
  "data": [
    {
      "id": "3f9e1b2a-...",
      "sellerId": "b7c0d...",
      "title": "Vintage Watch",
      "description": "High-quality vintage watch. Ships within 3–5 business days.",
      "priceMinor": 185000,
      "currency": "NGN",
      "status": "ACTIVE",
      "createdAt": "2026-09-28T12:00:00.123456Z",
      "updatedAt": "2026-09-28T12:00:00.123456Z"
    }
  ],
  "meta": { "total": 300, "limit": 20, "hasMore": true, "nextCursor": "..." }
}
```

#### `GET /api/v1/listings/:id` — get single listing with seller

```bash
curl "https://<PUBLIC_API_URL>/api/v1/listings/<id>"
```

Response includes a nested `seller` object (`id`, `name`, `email`) because the listing response must identify its seller (REQ-BUYER-002).

#### `POST /api/v1/listings` — create listing (Action 4: seller creates listing)

Body (all required except `status` which defaults to `DRAFT`):

```json
{
  "sellerId": "b7c0d...",
  "title": "Artisan Lamp",
  "description": "Handmade ceramic table lamp.",
  "priceMinor": 45000,
  "currency": "NGN",
  "status": "ACTIVE"
}
```

```bash
curl -X POST "https://<PUBLIC_API_URL>/api/v1/listings" \
  -H "Content-Type: application/json" \
  -d '{"sellerId":"<SELLER_ID>","title":"Artisan Lamp","description":"Handmade ceramic table lamp.","priceMinor":45000,"currency":"NGN","status":"ACTIVE"}'
```

Response `201` with `{ "data": { ... } }`. Unknown seller → `422`. Missing required field → `422` and names the field.

#### `PATCH /api/v1/listings/:id` — update listing

Body may include any of: `title`, `description`, `priceMinor`, `currency`, `status`.

State machine (REQ-LISTING-003): `DRAFT→ACTIVE`, `ACTIVE→SOLD_OUT`, `ACTIVE→ARCHIVED`, `SOLD_OUT→ARCHIVED`. Any other transition → `422 INVALID_TRANSITION`.

```bash
curl -X PATCH "https://<PUBLIC_API_URL>/api/v1/listings/<id>" \
  -H "Content-Type: application/json" \
  -d '{"status":"ARCHIVED"}'
```

#### `DELETE /api/v1/listings/:id` — soft delete listing

`deletedAt` is set; the row remains for historical order/review relationships (REQ-TIME-003). Response `204`.

```bash
curl -X DELETE "https://<PUBLIC_API_URL>/api/v1/listings/<id>"
```

---

### Orders

#### `GET /api/v1/orders` — list orders

Filters: `buyerId`, `listingId`, `status` (`PENDING|CONFIRMED|COMPLETED|CANCELLED`).
Sort fields: `created_at`, `total_amount_minor`.

```bash
curl "https://<PUBLIC_API_URL>/api/v1/orders?buyerId=<BUYER_ID>&status=COMPLETED&limit=20"
```

#### `GET /api/v1/orders/:id` — get single order

```bash
curl "https://<PUBLIC_API_URL>/api/v1/orders/<id>"
```

#### `POST /api/v1/orders` — place an order (Action 3)

Body:

```json
{
  "buyerId": "9a2c...",
  "listingId": "3f9e...",
  "quantity": 2
}
```

The API validates the buyer exists, the listing exists and is `ACTIVE`, captures the listing price at order time (`unitPriceMinor` — Denormalisation #1), and stores the computed `totalAmountMinor` (quantity × unit price — Denormalisation #2). New orders start `PENDING`.

Response `201` with the created order.

```bash
curl -X POST "https://<PUBLIC_API_URL>/api/v1/orders" \
  -H "Content-Type: application/json" \
  -d '{"buyerId":"<BUYER_ID>","listingId":"<LISTING_ID>","quantity":1}'
```

#### `PATCH /api/v1/orders/:id` — update order status

Body: `{ "status": "<new-status>" }`.

State machine (REQ-ORDER-002): `PENDING→CONFIRMED`, `PENDING→CANCELLED`, `CONFIRMED→COMPLETED`, `CONFIRMED→CANCELLED`. `COMPLETED` and `CANCELLED` are terminal. Invalid transition → `422`.

```bash
curl -X PATCH "https://<PUBLIC_API_URL>/api/v1/orders/<id>" \
  -H "Content-Type: application/json" \
  -d '{"status":"CONFIRMED"}'
```

#### `DELETE /api/v1/orders/:id` — cancel a pending order

Orders are historical records and are never physically deleted. DELETE cancels only a `PENDING` order (→ `CANCELLED`, `204`). Non-pending orders → `422`.

```bash
curl -X DELETE "https://<PUBLIC_API_URL>/api/v1/orders/<id>"
```

---

### Reviews

#### `GET /api/v1/reviews` — list reviews (Action 5)

Filters: `buyerId`, `listingId`, `rating` (1–5). Sort fields: `created_at`, `rating`.

```bash
curl "https://<PUBLIC_API_URL>/api/v1/reviews?listingId=<LISTING_ID>&rating=5&limit=20"
```

#### `GET /api/v1/reviews/:id` — get single review

```bash
curl "https://<PUBLIC_API_URL>/api/v1/reviews/<id>"
```

#### `POST /api/v1/reviews` — create a review (Action 5)

Body:

```json
{
  "buyerId": "9a2c...",
  "listingId": "3f9e...",
  "orderId": "1d5b...",
  "rating": 5,
  "comment": "Excellent, exactly as described."
}
```

Validation in one transaction (REQ-REVIEW-002, ERD §43):
1. the order exists,
2. the order is `COMPLETED`,
3. the review's buyer matches the order's buyer,
4. the review's listing matches the order's listing,
5. the order has no existing review (one review per order).

Any violation → `422` naming the field. Duplicate review for an order is also prevented by `UNIQUE (order_id)` at the database level (REQ-CONSTRAINT-004).

```bash
curl -X POST "https://<PUBLIC_API_URL>/api/v1/reviews" \
  -H "Content-Type: application/json" \
  -d '{"buyerId":"<BUYER_ID>","listingId":"<LISTING_ID>","orderId":"<COMPLETED_ORDER_ID>","rating":5,"comment":"Excellent, exactly as described."}'
```

#### `PATCH /api/v1/reviews/:id` — update rating/comment

Body may include `rating` and/or `comment`. The purchase relationship (`buyerId`, `listingId`, `orderId`) is invariant.

#### `DELETE /api/v1/reviews/:id` — permanently blocked

Reviews are permanent records with no `deletedAt` column (ERD §29). DELETE returns `422 INVALID_OPERATION`, never a fake success.

---

## Ugly-input behaviour (REQ-VALIDATION-001 – 005)

| Request | Response |
|---|---|
| `GET /api/v1/listings?limit=5000` | `200`, limit clamped to `100` |
| `GET /api/v1/listings?limit=-1` | `400 BAD_REQUEST` |
| `GET /api/v1/listings?sort=nope` | `400 BAD_REQUEST` (names the unknown sort) |
| `GET /api/v1/listings?cursor=garbage` | `400 BAD_REQUEST` (malformed cursor) |
| `GET /api/v1/listings/not-a-uuid` | `404` (valid-looking identifier that does not exist) |
| `POST /api/v1/listings` without `title` | `422` and names the field |
| `POST /api/v1/reviews` with a non-completed order | `422` naming the order |

---

## Seed data

```bash
npm install
cp .env.example .env   # set DATABASE_URL
npm run migrate        # idempotent migration (ERD schema)
npm run seed           # repeatable; safe to run multiple times
npm run validate       # local validation: schema, constraints, indexes, volume, invariants
```

Seed volumes (REQ-SEED-002): 200 sellers, 200 buyers, 300 listings, 400 orders, ~200 reviews. Seeding truncates then recreates the seed data inside one transaction so re-running produces the same known state with no duplicates (REQ-SEED-001), and every cross-entity relationship satisfies the constraints (REQ-SEED-003).

---

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Managed PostgreSQL connection string (REQ-DEPLOY-002) |
| `PORT` | HTTP listen port (default `3000`) |
| `RATE_LIMIT_WINDOW_SECONDS` | Rate-limit window in seconds (REQ-RATE-002) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window per IP (REQ-RATE-002) |
| `NODE_ENV` | `development` / `production` |

Secrets live in the deployment environment, never in the repository (REQ-DEPLOY-004).

---

## Consumer

`consumer/index.html` is a single-page consumer that calls the **public** API URL (REQ-CONSUMER-002). It demonstrates a list, a filter control and a next-page button (REQ-CONSUMER-003), with loading, empty and error states. The consumer uses the deployed public URL, never localhost.

---

## Design decisions (REQ-DOC-003)

1. **Why these resources?** The five core resources (buyers, sellers, listings, orders, reviews) map directly to the approved PRD's five user actions and need no additional marketplace furniture (no carts, wishlists, shipping, promotions).
2. **Generated identifiers** (REQ-ID-001): UUIDs via `gen_random_uuid()`. Sequential integers make a dataset trivially enumerable, so IDs are generated and non-sequential.
3. **Cursor pagination** (REQ-API-003): an opaque `nextCursor` (base64 JSON of the last row's `{id, sortValue}`) keeps pagination stable as the collection changes. Offset pagination remains simpler for direct page jumps and static collections, but cursor is chosen here for traversal correctness at the few-hundred-record scale.
4. **Exact timestamps in cursors**: timestamps are parsed at full stored precision (microseconds, RFC 3339) rather than rounded to milliseconds, so a cursor's sort value always matches the stored value and the secondary `id` tie-break fires correctly. Without this, rows sharing the same millisecond would silently fall through between pages.
4. **Envelopes** (REQ-API-007/008): one success shape (`data`/`meta` for lists, `data` for items) and one error shape (`error.code` + `error.message`) keep client parsing predictable and errors honest (REQ-ERROR-005).
5. **Money** (REQ-MONEY-001/002): integers in minor units (e.g. `45000` = 450.00) alongside an explicit ISO 4217 code. No floating point anywhere.
6. **Deliberate denormalisation** (REQ-NORMAL-002): orders snapshot `unitPriceMinor` (price at purchase time) and store `totalAmountMinor` (quantity × unit price) so historical transaction value never depends on a listing's current or future price. The listing remains the authoritative source for *current* pricing; the order is authoritative for its *historical* snapshot.
7. **Rate limiting in configuration** (REQ-RATE-002): the limits live in environment variables read by one middleware, not in route handlers, so operational tuning does not touch code.
8. **Versioning** (REQ-API-001): `/api/v1` exists from the first release so future breaking changes ship as `/api/v2` without breaking existing consumers.
9. **Realistic seed timestamps**: each row gets its own staggered `createdAt`/`updatedAt` spread over the past year instead of a shared `NOW()`, so pagination, sorting and the consumer's list views exercise non-uniform data (REQ-REALISTIC-003).

---

## Deployment

Live public URL: `https://<PUBLIC_API_URL>`

Deploy steps (Render + Neon):
1. Create a managed PostgreSQL project (e.g. Neon) and copy the connection string.
2. Deploy this repo to Render as a web service:
   - Build command: `npm install`
   - Start command: `npm run migrate && npm run seed && npm start`
3. Set environment variables `DATABASE_URL`, `PORT`, `NODE_ENV=production`, `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_MAX_REQUESTS`.
4. Run the production seed (`npm run seed`) with the production `DATABASE_URL` (REQ-DEPLOY-003).
5. Test from outside your machine via the public URL (REQ-DEPLOY-005) and with the consumer.
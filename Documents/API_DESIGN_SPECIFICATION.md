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

## State

Listing lifecycle must match the approved data model. Do not introduce a state such as `SOLD_OUT` unless the model has a quantity/stock concept that makes it enforceable.

Orders must have an explicit lifecycle and forbidden transitions.

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

# Task 3: Validation and Error Matrix

## Query tests
| Case | Expected |
|---|---|
| No limit | 200, maximum 20 records |
| `limit=50` | 200, at most 50 |
| `limit=5000` | 200, clamped to 100 |
| Negative pagination value | 400 |
| Malformed cursor | 400 |
| Unknown sort | 400 |
| Invalid order | 400 |
| Valid filter | 200 |
| Unknown filter | 400 |

## Identifier tests
| Case | Expected |
|---|---|
| Existing ID | 200 |
| Valid but missing ID | 404 |
| Malformed ID | 400 or 404 per documented identifier policy |
| Sequential public IDs required | No |

## Mutation tests
### Listing
Required fields must be taken from the approved data model. Missing required fields return `422` and identify the field.

### Order
Reject missing relationships, invalid quantities and forbidden lifecycle transitions.

### Review
Reject missing rating, invalid rating range, missing/non-existent order, non-completed order, buyer/order mismatch and listing/order mismatch. Enforce any duplicate-review rule through the approved constraint.

## Status rules
- 400 = malformed/invalid request input
- 404 = resource not found
- 422 = semantically invalid or incomplete mutation
- 429 = rate limit exceeded

## Rate-limit proof
Use configured IP limit. Exceed it. Capture:
- HTTP `429`
- `Retry-After`
- standard error envelope

## Evidence mapping
- Pagination: public curl screenshot
- Filtering: curl or consumer screenshot
- Sorting: curl request
- 400: bad query screenshot
- 404: missing resource screenshot
- 422: missing required field screenshot
- 429: required rate-limit screenshot
- Seed volume: seed script and database/terminal proof

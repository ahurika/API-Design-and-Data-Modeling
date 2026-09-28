# Task 3: Implementation and Evidence Checklist

## Design
- [x] Requirements approved (`Documents/PRD.md` — full REQ-* registry)
- [x] Data model/ERD approved (`Documents/DATA_MODEL_ERD_SPECIFICATION.md`)
- [x] API specification approved (`Documents/API_DESIGN_SPECIFICATION.md` — complete contracts w/ errors + idempotency)
- [x] Domain-specific design choices are clearly identified (seven hard questions answered in writing)
- [x] No `ARCHITECTURE.md` required

## Database
- [x] Buyer
- [x] Seller
- [x] Listing
- [x] Order
- [x] Review
- [x] Generated non-sequential IDs (UUID v4, REQ-ID-001)
- [x] `createdAt` and `updatedAt` on every entity
- [x] Approved `deletedAt` policy (soft delete buyers/sellers/listings; orders/reviews never deleted)
- [x] Foreign keys
- [x] Unique constraints
- [x] Check constraints
- [x] Minor-unit money + currency
- [x] Two deliberate denormalisations documented and implemented (price snapshot, order total)
- [x] Indexes mapped to five important actions
- [x] ERD matches schema (`npm run validate` PASS)

## API
- [x] `/api/v1`
- [x] Plural resources
- [x] List + item endpoints
- [x] Pagination on every list
- [x] Default 20
- [x] Maximum 100
- [x] Total + hasMore + nextCursor
- [x] Filtering on every list
- [x] Sorting on every list
- [x] One success envelope
- [x] One error envelope
- [x] 400 / 404 / 422 / 429 are meaningful
- [x] Schema validation
- [x] IP rate limiting in configuration

## Ugly inputs
- [x] 5000 limit clamps
- [x] Negative pagination returns 400
- [x] Unknown sort returns 400
- [x] Malformed ID never returns 500
- [x] Missing POST field returns 422 and names field

## Seed
- [x] Repeatable seed (TRUNCATE + ON CONFLICT DO NOTHING)
- [x] Few hundred records per resource (200/200/300/400/199)
- [x] Valid relationships
- [x] No database dump committed

## Deployment
- [ ] Public URL (Render — exact URL pending from user)
- [x] Managed Postgres (Neon)
- [x] Environment variables (.env / render.yaml)
- [ ] Production migration
- [ ] Production seed
- [ ] Public API tested from outside local machine/mobile data

## Consumer
- [x] One page
- [x] Calls public URL (guard rejects localhost; placeholder to be replaced at deploy)
- [x] Displays list
- [x] Filter control
- [x] Next-page button
- [x] Loading state
- [x] Empty state
- [x] Error state

## Required evidence (evidence/)
- [ ] Live API URL (Render — pending)
- [ ] Curl screenshot showing public paginated response (pending public URL)
- [x] 429 screenshot (`429-rate-limit.txt` — histogram 200×100 / 429×40, Retry-After: 60)
- [x] Consumer screenshot showing live data (`consumer-localhost.png`)
- [x] Seed script + output (`seed-output.txt`)
- [x] ERD diagram (`ERD-diagram.png` + `ERD-diagram-source.html`)
- [x] State-machine drawing (`order-state-machine.png` + `order-state-machine-source.html`)
- [x] Query plans showing index use (`query-plans.txt`)
- [x] Three rejected invalid inserts (`constraint-violations.txt` + `constraint-violations.png`)
- [x] Error-code captures: 400, 404, 422 (named-field + envelope)

## Defence
Be ready to explain:
1. cursor vs offset
2. page beyond available data
3. location of rate-limit configuration
4. generated identifiers
5. minor-unit money
6. deliberate denormalisations
7. constraints preventing invalid states
8. indexes serving the five actions
9. adding fields without breaking clients
10. why the consumer uses the public URL
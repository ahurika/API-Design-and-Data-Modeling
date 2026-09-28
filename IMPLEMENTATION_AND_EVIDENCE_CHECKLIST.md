# Task 3: Implementation and Evidence Checklist

## Design
- [ ] Requirements approved
- [ ] Data model/ERD approved
- [ ] API specification approved
- [ ] Domain-specific design choices are clearly identified
- [ ] No `ARCHITECTURE.md` required

## Database
- [ ] Buyer
- [ ] Seller
- [ ] Listing
- [ ] Order
- [ ] Review
- [ ] Generated non-sequential IDs
- [ ] `createdAt` and `updatedAt` on every entity
- [ ] Approved `deletedAt` policy
- [ ] Foreign keys
- [ ] Unique constraints
- [ ] Check constraints
- [ ] Minor-unit money + currency
- [ ] Two deliberate denormalisations documented and implemented
- [ ] Indexes mapped to five important actions
- [ ] ERD matches schema

## API
- [ ] `/api/v1`
- [ ] Plural resources
- [ ] List + item endpoints
- [ ] Pagination on every list
- [ ] Default 20
- [ ] Maximum 100
- [ ] Total + hasMore + nextCursor
- [ ] Filtering on every list
- [ ] Sorting on every list
- [ ] One success envelope
- [ ] One error envelope
- [ ] 400 / 404 / 422 / 429 are meaningful
- [ ] Schema validation
- [ ] IP rate limiting in configuration

## Ugly inputs
- [ ] 5000 limit clamps
- [ ] Negative pagination returns 400
- [ ] Unknown sort returns 400
- [ ] Malformed ID never returns 500
- [ ] Missing POST field returns 422 and names field

## Seed
- [ ] Repeatable seed
- [ ] Few hundred records per resource
- [ ] Valid relationships
- [ ] No database dump committed

## Deployment
- [ ] Public URL
- [ ] Managed Postgres
- [ ] Environment variables
- [ ] Production migration
- [ ] Production seed
- [ ] Public API tested from outside local machine/mobile data

## Consumer
- [ ] One page
- [ ] Calls public URL
- [ ] Displays list
- [ ] Filter control
- [ ] Next-page button
- [ ] Loading state
- [ ] Empty state
- [ ] Error state

## Required evidence
- [ ] Live API URL
- [ ] Curl screenshot showing public paginated response
- [ ] 429 screenshot
- [ ] Consumer screenshot showing live data
- [ ] Seed script

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

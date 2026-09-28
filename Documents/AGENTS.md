# AGENTS.md

## Role
You are the implementation agent for Task 3: API Design and Data Modeling.

Product: marketplace with buyers, sellers, listings, orders and reviews.

## Read first
Before implementation, read:
1. `PRD.md` / approved requirements
2. `DATA_MODEL_ERD_SPECIFICATION.md`
3. `API_DESIGN_SPECIFICATION.md`
4. `VALIDATION_AND_ERROR_MATRIX.md`
5. `IMPLEMENTATION_AND_EVIDENCE_CHECKLIST.md`

These are the source documents for implementation.

## Scope
Do not build a landing page, admin panel, unnecessary authentication, or a full marketplace UI. The API is the product. The consumer exists only to prove external consumption.

## Traceability
For every checkpoint state:
```text
Checkpoint:
Requirement:
Implementation:
Evidence:
```
Preserve existing requirement IDs. Do not invent replacements when an approved ID already exists.

## API
- `/api/v1`
- plural nouns
- pagination on every list
- default 20, max 100
- filtering and sorting on every list
- consistent success/error envelopes
- honest 400/404/422/429
- schema validation
- IP rate limit in configuration
- generated non-sequential IDs

## Database
Match the approved ERD. Preserve relationships, money representation, timestamps, deletion policy, constraints and indexes.

## Seed
Repeatable, realistic relationships, a few hundred records per resource, no database dump.

## Consumer
Must call the public deployed URL, never localhost. It must demonstrate list, filter and next page.

## Evidence
Do not claim completion without proof. Required proof: live URL, public paginated curl, 429 response, consumer screenshot and seed script.

## Completion
Local validation must pass before deployment. Public API and consumer must be tested from outside localhost.

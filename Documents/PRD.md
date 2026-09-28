# Marketplace API & Data Model

## Product Requirements Document

**Task:** Product Engineering Bootcamp — Task 3
**Task:** API Design and Data Modeling
**Product:** Marketplace
**Primary Resources:** Buyers, Sellers, Listings, Orders, Reviews
**Time Budget:** 10–14 hours
**Document Status:** Ready for design and implementation

---

# 1. Product Overview

## 1.1 Product Name

**Marketplace API**

## 1.2 Product Description

The Marketplace is a product where **buyers discover listings created by sellers, place orders for listings, and leave reviews based on their completed purchases**.

The product is being designed as an API and data-modeling exercise rather than as a full marketplace application.

The primary purpose of this task is to demonstrate that the product's:

* requirements
* entities
* relationships
* database constraints
* state transitions
* indexes
* API resources
* API behavior
* seed data
* and consumer

form one coherent system.

The marketplace contains five core resource types:

1. **Buyer**
2. **Seller**
3. **Listing**
4. **Order**
5. **Review**

The API will expose these resources through versioned REST endpoints.

---

# 2. Product Users

## 2.1 Buyer

A buyer is a marketplace user who:

* discovers available listings
* views listing information
* places orders
* views their orders
* reviews purchased listings

Relevant requirements:

* `REQ-BUYER-001`
* `REQ-BUYER-002`
* `REQ-BUYER-003`
* `REQ-BUYER-004`

---

## 2.2 Seller

A seller is a marketplace user who:

* creates listings
* manages listings
* receives orders for their listings
* has listings that buyers can discover and purchase

Relevant requirements:

* `REQ-SELLER-001`
* `REQ-SELLER-002`
* `REQ-SELLER-003`

---

# 3. Five Most Important User Actions

The Task 3 brief requires five important actions to be identified before the rest of the design is produced. Every subsequent design decision must trace back to these actions.

## Action 1 — Buyer discovers listings

A buyer retrieves a collection of available listings and uses filtering, sorting, and pagination to find relevant listings.

**Traceability**

* `REQ-BUYER-001`
* `REQ-LISTING-001`
* `REQ-API-003`
* `REQ-API-004`
* `REQ-API-005`
* `REQ-API-006`
* `REQ-DB-006`

---

## Action 2 — Buyer views a listing

A buyer retrieves an individual listing and its relevant seller information before deciding whether to purchase it.

**Traceability**

* `REQ-BUYER-002`
* `REQ-LISTING-002`
* `REQ-REL-002`
* `REQ-API-002`
* `REQ-DB-006`

---

## Action 3 — Buyer places an order

A buyer creates an order for a listing.

The order records the listing, buyer, quantity, price information, currency, and lifecycle state.

**Traceability**

* `REQ-BUYER-003`
* `REQ-ORDER-001`
* `REQ-ORDER-002`
* `REQ-MONEY-001`
* `REQ-STATE-002`
* `REQ-CONSTRAINT-003`
* `REQ-DB-006`

---

## Action 4 — Seller manages a listing

A seller creates and updates listings that buyers can discover.

**Traceability**

* `REQ-SELLER-001`
* `REQ-SELLER-002`
* `REQ-LISTING-003`
* `REQ-STATE-001`
* `REQ-CONSTRAINT-002`
* `REQ-DB-006`

---

## Action 5 — Buyer reviews a completed order

A buyer creates a review associated with a purchased listing after the relevant order has been completed.

**Traceability**

* `REQ-BUYER-004`
* `REQ-REVIEW-001`
* `REQ-REVIEW-002`
* `REQ-CONSTRAINT-004`
* `REQ-DB-006`

---

# 4. Functional Requirements

## 4.1 Buyer Requirements

### REQ-BUYER-001 — Browse Listings

The system SHALL allow buyers to retrieve a paginated collection of marketplace listings.

The collection SHALL support:

* pagination
* filtering
* sorting

**Source action:** Buyer discovers listings.

---

### REQ-BUYER-002 — View Listing

The system SHALL allow a buyer to retrieve an individual listing by its generated identifier.

The listing response SHALL provide the information necessary to understand the listing and identify its seller.

**Source action:** Buyer views a listing.

---

### REQ-BUYER-003 — Place Order

The system SHALL allow a buyer to create an order associated with a listing.

An order SHALL identify:

* the buyer
* the listing
* quantity
* purchase price
* currency
* order status

**Source action:** Buyer places an order.

---

### REQ-BUYER-004 — Submit Review

The system SHALL allow a buyer to create a review associated with a listing and an order that establishes the purchase relationship.

A review SHALL NOT exist without its required related records.

**Source action:** Buyer reviews a completed order.

---

# 5. Seller Requirements

### REQ-SELLER-001 — Create Listing

The system SHALL allow a seller to create a marketplace listing.

A listing SHALL identify its seller.

---

### REQ-SELLER-002 — Update Listing

The system SHALL allow an existing listing to be updated.

The listing lifecycle SHALL prevent invalid state transitions.

---

### REQ-SELLER-003 — Seller Ownership

Each listing SHALL belong to exactly one seller.

The database SHALL enforce the relationship between a listing and its seller through a foreign key.

---

# 6. Listing Requirements

### REQ-LISTING-001 — Listing Collection

The API SHALL expose a collection resource for listings.

The collection SHALL support:

* pagination
* filtering
* sorting

---

### REQ-LISTING-002 — Listing Retrieval

The API SHALL expose an item resource for retrieving an individual listing.

---

### REQ-LISTING-003 — Listing Lifecycle

Listings SHALL have an explicit lifecycle.

The lifecycle SHALL define:

* available states
* allowed transitions
* forbidden transitions
* the mechanism responsible for enforcing valid transitions

This requirement exists because Task 3 explicitly requires lifecycle/state-machine design for entities such as orders.

---

# 7. Order Requirements

### REQ-ORDER-001 — Create Order

The API SHALL support creating an order for a listing.

An order SHALL reference:

* one buyer
* one listing

---

### REQ-ORDER-002 — Order Lifecycle

Orders SHALL have explicit states.

The state machine SHALL document:

* every valid state
* every allowed transition
* every forbidden transition

An order SHALL NOT be allowed to transition backwards into an invalid state.

---

### REQ-ORDER-003 — Order Price

The order SHALL preserve the monetary value relevant to the order.

Money SHALL be stored as:

* a whole number in minor units
* a separate currency value

For example:

```text
amountMinor = 150000
currency = "NGN"
```

The system SHALL NOT use floating-point values for monetary fields.

This directly satisfies the Task 3 money requirement.

---

# 8. Review Requirements

### REQ-REVIEW-001 — Review Ownership

A review SHALL identify:

* the buyer who created it
* the listing being reviewed
* the order establishing the purchase relationship

---

### REQ-REVIEW-002 — Completed Order Requirement

A review SHALL only be valid when its associated order has reached the completed state.

The data model SHALL make an invalid review relationship impossible or reject it through database/application constraints.

The Task 3 brief explicitly uses the example that a review cannot exist without a completed order when discussing database constraints.

---

# 9. Resource Requirements

The product SHALL model the following five resources.

| Resource | Purpose                                                |
| -------- | ------------------------------------------------------ |
| Buyer    | Represents a marketplace buyer                         |
| Seller   | Represents a marketplace seller                        |
| Listing  | Represents an item offered by a seller                 |
| Order    | Represents a buyer's purchase of a listing             |
| Review   | Represents a buyer's review associated with a purchase |

**Requirement:** `REQ-RESOURCE-001`

The resources must have meaningful relationships rather than existing as isolated tables.

---

# 10. Relationship Requirements

### REQ-REL-001 — Buyer → Orders

One buyer MAY have many orders.

Each order SHALL belong to one buyer.

**Cardinality:** `Buyer 1 → N Orders`

---

### REQ-REL-002 — Seller → Listings

One seller MAY have many listings.

Each listing SHALL belong to one seller.

**Cardinality:** `Seller 1 → N Listings`

---

### REQ-REL-003 — Listing → Orders

One listing MAY be referenced by many orders.

Each order SHALL reference one listing.

**Cardinality:** `Listing 1 → N Orders`

---

### REQ-REL-004 — Buyer → Reviews

One buyer MAY create many reviews.

Each review SHALL belong to one buyer.

**Cardinality:** `Buyer 1 → N Reviews`

---

### REQ-REL-005 — Listing → Reviews

One listing MAY have many reviews.

Each review SHALL reference one listing.

**Cardinality:** `Listing 1 → N Reviews`

---

### REQ-REL-006 — Order → Review

An order MAY have an associated review.

A review SHALL reference the order establishing the purchase relationship.

**Cardinality:** `Order 1 → 0..1 Review`

The exact uniqueness constraint enforcing this relationship SHALL be documented in the data-model design.

---

# 11. Identifier Requirements

### REQ-ID-001 — Generated Identifiers

Every primary identifier SHALL be generated rather than sequential.

The system SHALL NOT use sequential integer IDs as public identifiers.

The design document SHALL explain the security reason for this decision: sequential identifiers make it easier to enumerate datasets by incrementing identifiers.

This requirement is explicitly emphasized in the bootcamp brief.

---

# 12. Time Requirements

### REQ-TIME-001 — Creation Timestamp

Every entity SHALL contain:

```text
createdAt
```

---

### REQ-TIME-002 — Update Timestamp

Every entity SHALL contain:

```text
updatedAt
```

---

### REQ-TIME-003 — Deletion Timestamp

Entities that support soft deletion SHALL contain:

```text
deletedAt
```

The design document SHALL explicitly state whether each entity is:

* soft deleted
* hard deleted
* never deleted

and explain the decision.

This is required by the Task 3 brief.

---

# 13. Money Requirements

### REQ-MONEY-001 — Minor Units

Every monetary value SHALL be stored as a whole number representing the smallest currency unit.

Example:

```text
priceMinor: 250000
currency: NGN
```

---

### REQ-MONEY-002 — Currency Column

Every monetary field SHALL have its currency represented by a separate field immediately alongside it.

The system SHALL NOT store currency implicitly.

---

# 14. Database Constraint Requirements

### REQ-CONSTRAINT-001 — Foreign Keys

Every required relationship SHALL be represented using foreign keys.

---

### REQ-CONSTRAINT-002 — Listing Ownership

A listing SHALL NOT exist without a valid seller.

**Enforcement:**

```text
Listing.sellerId → Seller.id
```

---

### REQ-CONSTRAINT-003 — Order Relationships

An order SHALL NOT exist without:

* a valid buyer
* a valid listing

**Enforcement:**

```text
Order.buyerId → Buyer.id
Order.listingId → Listing.id
```

---

### REQ-CONSTRAINT-004 — Review Relationships

A review SHALL NOT exist without:

* a valid buyer
* a valid listing
* a valid order

The model SHALL also prevent multiple reviews for the same order where the product relationship is defined as one review per order.

---

### REQ-CONSTRAINT-005 — Invalid State Prevention

The design SHALL identify which invalid states are prevented by:

* foreign keys
* unique constraints
* check constraints
* application-level state validation

The Task 3 brief explicitly requires the designer to identify which invalid states become impossible through constraints.

---

# 15. Normalisation Requirements

### REQ-NORMAL-001 — Single Source of Truth

Each fact SHALL have one canonical location in the relational model unless deliberate denormalisation is justified.

---

### REQ-NORMAL-002 — Deliberate Denormalisation

The design SHALL document at least **two deliberate denormalisations**.

For each denormalisation, the document SHALL explain:

1. what information is duplicated
2. why duplication exists
3. which source remains authoritative
4. what consistency risk exists
5. how that risk is controlled

The Task 3 brief explicitly requires at least two deliberate denormalisations and their justification.

---

# 16. Index Requirements

### REQ-INDEX-001 — Action-Based Indexing

Indexes SHALL be selected based on the actual queries required by the five important user actions.

The design SHALL explicitly map:

```text
User Action
→ Query
→ Table
→ Index
```

---

### REQ-INDEX-002 — Listing Discovery

The listing query used by buyers SHALL have an index strategy supporting the selected filtering and sorting fields.

---

### REQ-INDEX-003 — Buyer Orders

The buyer order query SHALL have an index supporting retrieval of orders belonging to a buyer.

---

### REQ-INDEX-004 — Seller Listings

The seller listing query SHALL have an index supporting retrieval of listings belonging to a seller.

---

### REQ-INDEX-005 — Reviews

The review query SHALL have an index supporting retrieval of reviews associated with a listing and/or order.

---

# 17. API Requirements

The API SHALL use REST conventions.

Resources SHALL use plural nouns and HTTP methods SHALL communicate the operation.

The API SHALL be versioned from the first version using:

```text
/api/v1/
```

This follows the bootcamp API requirements.

---

## REQ-API-001 — Versioned API

All API endpoints SHALL use:

```text
/api/v1/
```

Example:

```text
GET /api/v1/listings
```

---

## REQ-API-002 — Resource Endpoints

The API SHALL expose collection and item endpoints for the marketplace resources required by the design.

Core resources:

```text
/api/v1/buyers
/api/v1/sellers
/api/v1/listings
/api/v1/orders
/api/v1/reviews
```

The exact supported methods SHALL be documented in the API section.

---

## REQ-API-003 — Pagination

Every list endpoint SHALL support pagination.

The API SHALL use either:

* offset pagination
* cursor pagination

The chosen approach SHALL be documented and justified.

---

## REQ-API-004 — Pagination Defaults

The default page size SHALL be:

```text
20
```

The maximum page size SHALL be:

```text
100
```

The API SHALL return:

* total count
* requested limit
* pagination position
* whether another page exists

The bootcamp explicitly requires a default of 20 and maximum of 100.

---

## REQ-API-005 — Filtering

Every list endpoint SHALL support filtering on at least two fields.

The exact filter fields SHALL be selected based on the resource's important queries.

---

## REQ-API-006 — Sorting

Every list endpoint SHALL support sorting using:

```text
sort
order
```

`order` SHALL support ascending and descending behavior, including:

```text
order=desc
```

An unknown sort field SHALL result in a `400` response rather than being silently ignored.

---

## REQ-API-007 — Response Envelope

Successful responses SHALL use a consistent response envelope.

Target structure:

```json
{
  "data": [],
  "meta": {
    "total": 0,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

The final pagination metadata SHALL match the chosen offset or cursor strategy.

The bootcamp explicitly requires a consistent response envelope.

---

## REQ-API-008 — Error Envelope

Every API error SHALL use a consistent error envelope.

Target structure:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Listing not found"
  }
}
```

---

# 18. HTTP Error Requirements

### REQ-ERROR-001 — Bad Request

Invalid query parameters SHALL return:

```text
400 Bad Request
```

Examples:

* negative offset
* unknown sort field
* invalid pagination parameter

---

### REQ-ERROR-002 — Not Found

Requests for resources that do not exist SHALL return:

```text
404 Not Found
```

Malformed identifiers SHALL return `400` or `404`, but SHALL never produce a `500`.

---

### REQ-ERROR-003 — Validation Error

A POST request missing a required field SHALL return:

```text
422 Unprocessable Entity
```

The response SHALL identify the missing field.

---

### REQ-ERROR-004 — Rate Limit

Requests exceeding the configured rate limit SHALL return:

```text
429 Too Many Requests
```

The response SHALL include:

```text
Retry-After
```

---

### REQ-ERROR-005 — No Fake Success

The API SHALL NOT return HTTP `200` with an error represented only inside the response body.

The HTTP status code SHALL accurately represent the outcome.

These error-handling expectations come directly from the bootcamp's API testing requirements.

---

# 19. Input Validation Requirements

### REQ-VALIDATION-001 — Schema Validation

Request bodies and query parameters SHALL be validated through a schema-validation mechanism.

Validation rules SHALL live in a centralized schema rather than being duplicated throughout handlers.

---

### REQ-VALIDATION-002 — Excessive Limit

A request such as:

```text
?limit=5000
```

SHALL NOT return 5,000 records.

The API SHALL enforce the configured maximum.

---

### REQ-VALIDATION-003 — Negative Offset

A request with a negative offset SHALL return:

```text
400 Bad Request
```

with a clear error message.

---

### REQ-VALIDATION-004 — Invalid Sort Field

An unknown sort field SHALL return:

```text
400 Bad Request
```

---

### REQ-VALIDATION-005 — Missing Required POST Field

A POST request missing a required field SHALL return:

```text
422 Unprocessable Entity
```

and identify the field.

---

# 20. Rate Limiting Requirements

### REQ-RATE-001 — IP-Based Rate Limiting

The public API SHALL implement rate limiting keyed by IP.

---

### REQ-RATE-002 — Configurable Rate Limit

The rate-limit number SHALL live in configuration rather than being hard-coded inside request handlers.

The bootcamp gives approximately **100 requests per minute** as the example configuration. The final implementation SHALL document the selected value.

---

### REQ-RATE-003 — Rate Limit Response

When a client exceeds the configured limit, the API SHALL return:

```text
429 Too Many Requests
```

with:

```text
Retry-After
```

---

# 21. Seed Data Requirements

### REQ-SEED-001 — Repeatable Seed

The project SHALL contain a repeatable seed script.

Running the seed script multiple times SHALL NOT create uncontrolled duplicate records.

---

### REQ-SEED-002 — Realistic Volume

The seed data SHALL contain a few hundred records per resource so that the API's pagination behavior can be demonstrated meaningfully.

The bootcamp specifically states that ten records prove little and requires a few hundred per resource.

---

### REQ-SEED-003 — Relationship Integrity

Seed data SHALL create valid relationships between:

```text
Buyers
    ↓
Orders
    ↓
Listings
    ↓
Sellers

Buyers
    ↓
Reviews
    ↓
Listings
```

Seeded records SHALL satisfy all database constraints.

---

# 22. Documentation Requirements

### REQ-DOC-001 — API Documentation

The README SHALL function as the API documentation.

A developer unfamiliar with the project SHALL be able to use the API from the README alone.

---

### REQ-DOC-002 — Endpoint Documentation

Every endpoint SHALL document:

* HTTP method
* path
* query parameters
* parameter types
* defaults
* example request
* curl command
* example response

---

### REQ-DOC-003 — Design Decisions

The documentation SHALL contain a **Design Decisions** section explaining:

* why these resources were selected
* why identifiers are generated
* why offset or cursor pagination was selected
* why the response envelope has its chosen structure

The bootcamp explicitly requires these decisions to be documented.

---

# 23. Public Deployment Requirements

### REQ-DEPLOY-001 — Public URL

The API SHALL be deployed to a publicly accessible URL.

---

### REQ-DEPLOY-002 — Managed PostgreSQL

The deployed API SHALL use a managed PostgreSQL database.

---

### REQ-DEPLOY-003 — Production Seed

The seed script SHALL be executed against the production database.

---

### REQ-DEPLOY-004 — Environment Configuration

Required environment variables SHALL be configured in the deployment environment rather than committed as secrets.

---

### REQ-DEPLOY-005 — External Verification

The deployed API SHALL be tested from outside the development environment.

Acceptable verification includes:

* another machine
* a phone using mobile data

The API must be demonstrated as publicly accessible.

---

# 24. Consumer Requirements

### REQ-CONSUMER-001 — Live API Consumer

A minimal consumer application SHALL consume the deployed API.

---

### REQ-CONSUMER-002 — Public URL Only

The consumer SHALL call the public API URL.

It SHALL NOT use:

```text
localhost
```

---

### REQ-CONSUMER-003 — Minimal Interface

The consumer only needs to prove that the API works externally.

A minimal page containing:

* a list
* a filter control
* a next-page control

is sufficient.

This is directly aligned with the bootcamp's Task 3 proof requirement.

---

# 25. Evidence Requirements

### REQ-EVIDENCE-001 — Live API URL

The submission SHALL include the live API URL.

---

### REQ-EVIDENCE-002 — Paginated API Evidence

The submission SHALL include a screenshot of a curl request against the live API showing a paginated response.

---

### REQ-EVIDENCE-003 — Rate Limit Evidence

The submission SHALL include a screenshot showing the API returning `429` after the configured rate limit is exceeded.

---

### REQ-EVIDENCE-004 — Consumer Evidence

The submission SHALL include a screenshot of the consumer displaying data from the live API.

---

### REQ-EVIDENCE-005 — Seed Script

The seed script SHALL be included in the repository.

These evidence requirements are explicitly listed in the bootcamp brief.

---

# 26. Requirement Traceability Matrix

Every major design artifact must trace back to the requirements above.

| Requirement          | Design Area       | Must Be Demonstrated By         |
| -------------------- | ----------------- | ------------------------------- |
| `REQ-BUYER-001`      | Listing API       | Listing collection query        |
| `REQ-BUYER-002`      | Listing model/API | Listing item endpoint           |
| `REQ-BUYER-003`      | Order model/API   | Create order endpoint           |
| `REQ-BUYER-004`      | Review model/API  | Create review endpoint          |
| `REQ-SELLER-001`     | Listing model/API | Listing creation                |
| `REQ-SELLER-002`     | Listing state     | Listing update                  |
| `REQ-SELLER-003`     | FK constraint     | `Listing.sellerId`              |
| `REQ-LISTING-001`    | Listing API       | Paginated collection            |
| `REQ-LISTING-002`    | Listing API       | Item endpoint                   |
| `REQ-LISTING-003`    | State machine     | Listing transition table        |
| `REQ-ORDER-001`      | Order API         | Order creation                  |
| `REQ-ORDER-002`      | State machine     | Order transition table          |
| `REQ-ORDER-003`      | Database          | Minor-unit money fields         |
| `REQ-REVIEW-001`     | Review model      | Review FKs                      |
| `REQ-REVIEW-002`     | Constraints       | Completed-order validation      |
| `REQ-REL-001`        | ERD               | Buyer → Orders                  |
| `REQ-REL-002`        | ERD               | Seller → Listings               |
| `REQ-REL-003`        | ERD               | Listing → Orders                |
| `REQ-REL-004`        | ERD               | Buyer → Reviews                 |
| `REQ-REL-005`        | ERD               | Listing → Reviews               |
| `REQ-REL-006`        | ERD/constraints   | Order → Review                  |
| `REQ-ID-001`         | Entity model      | Generated IDs                   |
| `REQ-TIME-001`       | Entity model      | `createdAt`                     |
| `REQ-TIME-002`       | Entity model      | `updatedAt`                     |
| `REQ-TIME-003`       | Entity model      | `deletedAt` where applicable    |
| `REQ-MONEY-001`      | Entity model      | Minor-unit monetary fields      |
| `REQ-MONEY-002`      | Entity model      | Currency columns                |
| `REQ-CONSTRAINT-001` | Database          | Foreign keys                    |
| `REQ-CONSTRAINT-002` | Database          | Listing → Seller FK             |
| `REQ-CONSTRAINT-003` | Database          | Order FKs                       |
| `REQ-CONSTRAINT-004` | Database          | Review FKs/unique constraint    |
| `REQ-CONSTRAINT-005` | Database          | Invalid-state analysis          |
| `REQ-NORMAL-001`     | Data model        | Normalisation decisions         |
| `REQ-NORMAL-002`     | Data model        | Two deliberate denormalisations |
| `REQ-INDEX-001`      | Database          | Action → query → index mapping  |
| `REQ-INDEX-002`      | Database          | Listing indexes                 |
| `REQ-INDEX-003`      | Database          | Buyer order indexes             |
| `REQ-INDEX-004`      | Database          | Seller listing indexes          |
| `REQ-INDEX-005`      | Database          | Review indexes                  |
| `REQ-API-001`        | API               | `/api/v1`                       |
| `REQ-API-002`        | API               | Resource endpoints              |
| `REQ-API-003`        | API               | Pagination                      |
| `REQ-API-004`        | API               | Limit defaults                  |
| `REQ-API-005`        | API               | Filters                         |
| `REQ-API-006`        | API               | Sorting                         |
| `REQ-API-007`        | API               | Success envelope                |
| `REQ-API-008`        | API               | Error envelope                  |
| `REQ-ERROR-001`      | API               | `400`                           |
| `REQ-ERROR-002`      | API               | `404`                           |
| `REQ-ERROR-003`      | API               | `422`                           |
| `REQ-ERROR-004`      | API               | `429`                           |
| `REQ-ERROR-005`      | API               | Honest status codes             |
| `REQ-VALIDATION-001` | API               | Schema validation               |
| `REQ-VALIDATION-002` | API               | Maximum limit                   |
| `REQ-VALIDATION-003` | API               | Negative offset                 |
| `REQ-VALIDATION-004` | API               | Unknown sort                    |
| `REQ-VALIDATION-005` | API               | Missing POST field              |
| `REQ-RATE-001`       | API               | IP rate limiting                |
| `REQ-RATE-002`       | Configuration     | Rate-limit config               |
| `REQ-RATE-003`       | API               | `429` + `Retry-After`           |
| `REQ-SEED-001`       | Seed              | Repeatable seed                 |
| `REQ-SEED-002`       | Seed              | Hundreds of records/resource    |
| `REQ-SEED-003`       | Seed              | Valid relationships             |
| `REQ-DOC-001`        | README            | API documentation               |
| `REQ-DOC-002`        | README            | Endpoint docs                   |
| `REQ-DOC-003`        | README            | Design decisions                |
| `REQ-DEPLOY-001`     | Deployment        | Public URL                      |
| `REQ-DEPLOY-002`     | Infrastructure    | Managed PostgreSQL              |
| `REQ-DEPLOY-003`     | Deployment        | Production seed                 |
| `REQ-DEPLOY-004`     | Deployment        | Environment variables           |
| `REQ-DEPLOY-005`     | Evidence          | External API test               |
| `REQ-CONSUMER-001`   | Consumer          | Live API client                 |
| `REQ-CONSUMER-002`   | Consumer          | Public URL                      |
| `REQ-CONSUMER-003`   | Consumer          | List/filter/next page           |
| `REQ-EVIDENCE-001`   | Submission        | Live URL                        |
| `REQ-EVIDENCE-002`   | Submission        | Paginated curl screenshot       |
| `REQ-EVIDENCE-003`   | Submission        | 429 screenshot                  |
| `REQ-EVIDENCE-004`   | Submission        | Consumer screenshot             |
| `REQ-EVIDENCE-005`   | Repository        | Seed script                     |

---

# 27. Design Decision Traceability Rule

Every design decision made after this document SHALL reference at least one requirement ID.

Examples:

```text
Decision:
Use generated UUID-style identifiers.

Trace:
REQ-ID-001
```

```text
Decision:
Index Listing by sellerId.

Trace:
REQ-SELLER-003
REQ-INDEX-004
```

```text
Decision:
Store order price as amountMinor + currency.

Trace:
REQ-ORDER-003
REQ-MONEY-001
REQ-MONEY-002
```

```text
Decision:
Use cursor pagination.

Trace:
REQ-API-003
REQ-API-004
REQ-BUYER-001
```

No major model, API, constraint, index, or implementation decision should exist without a traceable requirement.

---

# 28. Out of Scope for This Requirements Document

The marketplace is intentionally limited to the product model required for Task 3.

The requirements document does **not** introduce additional marketplace domains such as:

* shopping carts
* wishlists
* messaging
* seller payouts
* shipping providers
* promotions
* subscriptions
* recommendation engines
* marketplace advertising
* loyalty systems

These are not required by the Task 3 brief and therefore are not part of the core model.

The focus remains:

```text
Buyers
Sellers
Listings
Orders
Reviews
```

and the relationships, constraints, API behavior, documentation, deployment, seed data, and proof necessary to demonstrate that model.

---

# 29. Task 3 Completion Definition

Task 3 is complete when the requirements above have been translated into:

1. a complete entity/data model
2. an ER/data relationship diagram
3. documented cardinalities
4. field definitions and requiredness
5. generated identifiers
6. normalisation decisions
7. at least two deliberate denormalisations with justification
8. monetary-field rules
9. lifecycle/state machines
10. deletion strategy
11. database constraints
12. invalid-state analysis
13. indexes mapped to the five important actions
14. versioned REST API design
15. pagination
16. filtering
17. sorting
18. consistent success/error envelopes
19. validation behavior
20. `400`, `404`, `422`, and `429` behavior
21. configurable rate limiting
22. repeatable seed data
23. complete API documentation
24. public deployment
25. production seed
26. a consumer calling the public API
27. required evidence

The Task 3 brief describes this as a **complete API design document and data model followed by a small proof that the model holds**.

---

# 30. Core Product Model

The resulting conceptual model is:

```text
                    ┌──────────────┐
                    │    Seller    │
                    └──────┬───────┘
                           │
                         1 │
                           │ N
                    ┌──────▼───────┐
                    │   Listing    │
                    └──────┬───────┘
                           │
                         1 │
                           │ N
                    ┌──────▼───────┐
                    │    Order     │
                    └──────┬───────┘
                           │
                         1 │
                           │ 0..1
                    ┌──────▼───────┐
                    │    Review    │
                    └──────────────┘

                    ┌──────────────┐
                    │    Buyer     │
                    └──────┬───────┘
                           │
                         1 │
                           │ N
                    ┌──────▼───────┐
                    │    Order     │
                    └──────────────┘

                    ┌──────────────┐
                    │    Buyer     │
                    └──────┬───────┘
                           │
                         1 │
                           │ N
                    ┌──────▼───────┐
                    │    Review    │
                    └──────────────┘
```

The exact physical schema, fields, indexes, constraints, state transitions, and API endpoint matrix should be produced next from these requirements rather than being invented independently.

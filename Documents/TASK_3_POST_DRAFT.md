# Task 3 Public Post Draft

## Design decision: Why I versioned the API from day one

For Task 3 of the Product Engineering Bootcamp, I designed a marketplace API around buyers, sellers, listings, orders and reviews.

One decision I made early was to version the API from the first endpoint using `/api/v1`.

An API is a contract with its consumers. If a future change is breaking, a new version gives existing clients a stable contract instead of forcing every client to change at once.

The design also covers generated identifiers, consistent response and error envelopes, pagination, filtering, sorting, schema validation and configuration-driven rate limiting.

The proof includes a live public API, repeatable seed data, a curl request showing pagination, a 429 response, and a small consumer calling the deployed API.

Live API:
`https://<PUBLIC_API_URL>`

Example:
```bash
curl "https://<PUBLIC_API_URL>/api/v1/listings?limit=20&sort=createdAt&order=desc"
```

The biggest lesson from this task was that the hard part was not writing routes. It was making the data model, constraints and API contract agree before implementation.

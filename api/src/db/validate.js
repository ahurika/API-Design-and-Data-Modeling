// src/db/validate.js
// Local validation that the implementation matches the approved ERD and the
// seed meets the required volumes before deployment (checklist: Local validation
// must pass before deployment).
//
// Checks:
//  1. Tables/columns match the ERD (DATA_MODEL_ERD_SPECIFICATION.md §23)
//  2. Constraints (FK, UNIQUE, CHECK) are present
//  3. Indexes from the five actions exist (REQ-INDEX-001 – 005)
//  4. Seed volume: a few hundred records per resource (REQ-SEED-002)
//  5. Reviews only reference COMPLETED orders (ERD §20, REQ-REVIEW-002)
//  6. Review buyer/listing match the order buyer/listing (ERD §33)
//  7. IDs are generated (UUID-shaped, non-sequential) (REQ-ID-001)

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = require('./pool');

const EXPECTED_TABLES = {
  buyers:   ['id', 'name', 'email', 'created_at', 'updated_at', 'deleted_at'],
  sellers:  ['id', 'name', 'email', 'created_at', 'updated_at', 'deleted_at'],
  listings: ['id', 'seller_id', 'title', 'description', 'price_minor', 'currency', 'status', 'created_at', 'updated_at', 'deleted_at'],
  orders:   ['id', 'buyer_id', 'listing_id', 'quantity', 'unit_price_minor', 'total_amount_minor', 'currency', 'status', 'created_at', 'updated_at'],
  reviews:  ['id', 'buyer_id', 'listing_id', 'order_id', 'rating', 'comment', 'created_at', 'updated_at'],
};

const EXPECTED_INDEXES = [
  'idx_listings_status_created_at',
  'idx_listings_status_currency_price',
  'idx_listings_seller_id_created_at',
  'idx_orders_buyer_id_created_at',
  'idx_reviews_listing_id_created_at',
];

const failures = [];

function check(name, ok, detail) {
  if (!ok) failures.push(`${name}: ${detail}`);
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${ok ? '' : ' — ' + detail}`);
}

async function validate() {
  console.log('Validating database against ERD …\n');

  // 1. Tables and columns (ERD §23)
  console.log('Tables / columns:');
  for (const [table, cols] of Object.entries(EXPECTED_TABLES)) {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [table],
    );
    const actualCols = rows.map((r) => r.column_name);
    check(`${table} exists`, rows.length > 0, 'table not found');
    for (const col of cols) {
      check(`${table}.${col}`, actualCols.includes(col), `missing column (actual: ${actualCols.join(', ')})`);
    }
  }

  // 2. Constraints
  console.log('\nConstraints:');
  const { rows: pkRows } = await pool.query(
    `SELECT table_name, constraint_name FROM information_schema.table_constraints
     WHERE table_schema = 'public' AND constraint_type IN ('PRIMARY KEY','UNIQUE','FOREIGN KEY','CHECK')
     ORDER BY table_name, constraint_name`,
  );
  const constraints = pkRows.map((r) => `${r.table_name}.${r.constraint_name}`).join('|');
  const required = [
    'buyers.buyers_email_unique',
    'sellers.sellers_email_unique',
    'listings.listings_seller_fk',
    'listings.listings_price_nonneg',
    'orders.orders_buyer_fk',
    'orders.orders_listing_fk',
    'orders.orders_quantity_positive',
    'orders.orders_unit_price_nonneg',
    'orders.orders_total_amount_nonneg',
    'reviews.reviews_buyer_fk',
    'reviews.reviews_listing_fk',
    'reviews.reviews_order_fk',
    'reviews.reviews_order_unique',
    'reviews.reviews_rating_range',
  ];
  for (const c of required) check(c, constraints.includes(c), 'constraint not found');

  // 3. Indexes (REQ-INDEX-001 – 005)
  console.log('\nIndexes:');
  const { rows: idxRows } = await pool.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`,
  );
  const indexes = idxRows.map((r) => r.indexname);
  for (const i of EXPECTED_INDEXES) check(i, indexes.includes(i), 'index not found');

  // 4. Seed volume (REQ-SEED-002)
  console.log('\nSeed volume:');
  const volumeTarget = { buyers: 100, sellers: 100, listings: 200, orders: 200, reviews: 100 };
  for (const [table, min] of Object.entries(volumeTarget)) {
    const { rows } = await pool.query(`SELECT COUNT(*) FROM ${table}`);
    const count = parseInt(rows[0].count, 10);
    check(`${table} count >= ${min}`, count >= min, `count is ${count}`);
  }

  // 5. Reviews only on COMPLETED orders (REQ-REVIEW-002)
  console.log('\nBusiness invariants:');
  const { rows: badReviewOrders } = await pool.query(
    `SELECT r.id FROM reviews r JOIN orders o ON o.id = r.order_id
     WHERE o.status <> 'COMPLETED'`,
  );
  check('all reviews reference COMPLETED orders', badReviewOrders.length === 0, `${badReviewOrders.length} reviews on non-completed orders`);

  // 6. Review buyer/listing match order buyer/listing (ERD §33)
  const { rows: badBuyer } = await pool.query(
    `SELECT r.id FROM reviews r JOIN orders o ON o.id = r.order_id
     WHERE r.buyer_id <> o.buyer_id`,
  );
  check('review buyer matches order buyer', badBuyer.length === 0, `${badBuyer.length} reviews with mismatched buyer`);

  const { rows: badListing } = await pool.query(
    `SELECT r.id FROM reviews r JOIN orders o ON o.id = r.order_id
     WHERE r.listing_id <> o.listing_id`,
  );
  check('review listing matches order listing', badListing.length === 0, `${badListing.length} reviews with mismatched listing`);

  // 7. Generated, non-sequential IDs (REQ-ID-001)
  console.log('\nIdentifiers:');
  for (const table of Object.keys(EXPECTED_TABLES)) {
    const { rows } = await pool.query(
      `SELECT id FROM ${table} ORDER BY created_at LIMIT 10`,
    );
    const allUuid = rows.every((r) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.id));
    check(`${table} uses UUID v4-style generated IDs`, allUuid, rows.map((r) => r.id).join(', '));
  }

  await pool.end();

  if (failures.length) {
    console.log(`\nVALIDATION FAILED: ${failures.length} issue(s)`);
    process.exit(1);
  }
  console.log('\nAll local validation checks passed ✓');
}

validate().catch((err) => {
  console.error('Validation could not run:', err.message);
  process.exit(1);
});
// src/db/seed.js
// Repeatable seed script (REQ-SEED-001, REQ-SEED-002, REQ-SEED-003)
// - Truncates all resource tables then reseeds inside one transaction, so
//   re-running ALWAYS ends at the same known state — no duplicate rows on rerun.
// - Produces realistic volumes: 200 sellers, 200 buyers, 300 listings,
//   400 orders, ~200 reviews — all with valid foreign-key relationships.
// - All money is in minor units (REQ-MONEY-001); currencies are explicit (REQ-MONEY-002).
// - IDs are gen_random_uuid() — generated, non-sequential (REQ-ID-001).
// - Inserts are batched (multi-row VALUES) to keep the seed fast against a
//   remote managed PostgreSQL — one round-trip per resource instead of ~1300.

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = require('./pool');

// ─── helpers ────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Build a single multi-row INSERT.
 * @param {string} table     table name
 * @param {string[]} cols    column list
 * @param {Array<Array>} rows rows of values
 * @param {string} [conflict] optional ON CONFLICT clause
 * @returns {{text: string, values: Array}} pg query config
 */
function bulkInsert(table, cols, rows, conflict) {
  const placeholders = [];
  const params = [];
  let n = 0;
  for (const row of rows) {
    const rowPlaceholders = [];
    for (const val of row) {
      n += 1;
      rowPlaceholders.push(`$${n}`);
      params.push(val);
    }
    placeholders.push(`(${rowPlaceholders.join(', ')})`);
  }
  const text =
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES ${placeholders.join(', ')}` +
    (conflict ? ` ${conflict}` : '') +
    ' RETURNING id';
  return { text, values: params };
}

const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR', 'KES'];

const ADJECTIVES = [
  'Vintage', 'Modern', 'Handmade', 'Rare', 'Classic',
  'Premium', 'Artisan', 'Luxury', 'Eco-friendly', 'Refurbished',
];
const NOUNS = [
  'Watch', 'Camera', 'Bag', 'Shoes', 'Book', 'Lamp', 'Chair',
  'Phone', 'Jacket', 'Bicycle', 'Painting', 'Guitar', 'Desk',
  'Keyboard', 'Monitor', 'Headphones', 'Sneakers', 'Ring', 'Rug', 'Mug',
];

function randomTitle() {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}

// Staggered realistic timestamps: each row gets its own created/updated time
// spread over the past year (REQ-REALISTIC-003). Prevents flat out-of-the-box
// listing pages and exercises keyset pagination against non-uniform data.
const DAY_MS = 24 * 60 * 60 * 1000;

function pastDate(maxDaysAgo, minDaysAgo = 0) {
  const days = randInt(minDaysAgo, maxDaysAgo);
  const ms = Date.now() - days * DAY_MS - randInt(0, 23) * 60 * 60 * 1000 - randInt(0, 59) * 60 * 1000 - randInt(0, 59) * 1000;
  return new Date(ms);
}

function iso(date) {
  return date.toISOString();
}

// ─── seed ───────────────────────────────────────────────────────────────────

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Reset to a known state first so the seed is idempotent (REQ-SEED-001).
    // Truncate in one statement (reviews, orders, listings reference the rest).
    await client.query('TRUNCATE reviews, orders, listings, sellers, buyers RESTART IDENTITY');

    // ── 1. Sellers (200) ──────────────────────────────────────────────────
    console.log('Seeding sellers …');
    const sellerRows = [];
    const sellerCreated = [];
    for (let i = 1; i <= 200; i++) {
      const created = pastDate(730, 1);
      sellerCreated.push(created);
      sellerRows.push([`Seller ${i}`, `seller${i}@example.com`, iso(created), iso(created)]);
    }
    const sellersRes = await client.query(
      bulkInsert(
        'sellers',
        ['name', 'email', 'created_at', 'updated_at'],
        sellerRows,
        'ON CONFLICT (email) DO NOTHING',
      ),
    );
    const sellerIds = sellersRes.rows.map((r) => r.id);
    console.log(`  → ${sellerIds.length} sellers`);

    // ── 2. Buyers (200) ───────────────────────────────────────────────────
    console.log('Seeding buyers …');
    const buyerRows = [];
    for (let i = 1; i <= 200; i++) {
      const created = pastDate(730, 1);
      buyerRows.push([`Buyer ${i}`, `buyer${i}@example.com`, iso(created), iso(created)]);
    }
    const buyersRes = await client.query(
      bulkInsert(
        'buyers',
        ['name', 'email', 'created_at', 'updated_at'],
        buyerRows,
        'ON CONFLICT (email) DO NOTHING',
      ),
    );
    const buyerIds = buyersRes.rows.map((r) => r.id);
    console.log(`  → ${buyerIds.length} buyers`);

    // ── 3. Listings (300) ──────────────────────────────────────────────────
    // Statuses distributed realistically:
    //   60% ACTIVE, 15% DRAFT, 15% SOLD_OUT, 10% ARCHIVED
    console.log('Seeding listings …');
    const listingStatuses = [
      ...Array(60).fill('ACTIVE'),
      ...Array(15).fill('DRAFT'),
      ...Array(15).fill('SOLD_OUT'),
      ...Array(10).fill('ARCHIVED'),
    ];
    const listingRows = [];
    const listingCreated = [];
    for (let i = 0; i < 300; i++) {
      const status      = pick(listingStatuses);
      const currency    = pick(CURRENCIES);
      const priceMinor  = randInt(100, 50000) * 100; // e.g. 10000 = 100 NGN
      const created     = pastDate(365, 1);
      listingCreated.push(created);
      listingRows.push([
        pick(sellerIds),
        randomTitle(),
        `High-quality ${randomTitle().toLowerCase()}. Ships within 3–5 business days.`,
        priceMinor,
        currency,
        status,
        iso(created),
        iso(created),
      ]);
    }
    const listingsRes = await client.query(
      bulkInsert(
        'listings',
        ['seller_id', 'title', 'description', 'price_minor', 'currency', 'status', 'created_at', 'updated_at'],
        listingRows,
      ),
    );
    const listingIds = listingsRes.rows.map((r) => r.id);
    console.log(`  → ${listingIds.length} listings`);

    // Ensure we have ACTIVE listings for orders
    const { rows: activeRows } = await client.query(
      `SELECT id, price_minor, currency FROM listings WHERE status = 'ACTIVE' LIMIT 200`,
    );

    // ── 4. Orders (400) ────────────────────────────────────────────────────
    // Order statuses: 20% PENDING, 20% CONFIRMED, 50% COMPLETED, 10% CANCELLED
    // (50% COMPLETED → ~200 completed orders → ~200 candidate reviews)
    console.log('Seeding orders …');
    const orderStatuses = [
      ...Array(20).fill('PENDING'),
      ...Array(20).fill('CONFIRMED'),
      ...Array(50).fill('COMPLETED'),
      ...Array(10).fill('CANCELLED'),
    ];
    const orderRows    = [];
    const orderByIndex = []; // { listingId, buyerId, status, createdAt } per order
    for (let i = 0; i < 400; i++) {
      const activeListing = pick(activeRows);
      const buyerId       = pick(buyerIds);
      const quantity      = randInt(1, 5);
      const unitPrice     = activeListing.price_minor;
      const totalAmount   = quantity * unitPrice;
      const status        = pick(orderStatuses);
      const createdAt     = pastDate(30, 1);

      orderRows.push([
        buyerId,
        activeListing.id,
        quantity,
        unitPrice,
        totalAmount,
        activeListing.currency,
        status,
        iso(createdAt),
        iso(createdAt),
      ]);
      orderByIndex.push({ listingId: activeListing.id, buyerId, status, createdAt });
    }
    const ordersRes = await client.query(
      bulkInsert(
        'orders',
        ['buyer_id', 'listing_id', 'quantity', 'unit_price_minor', 'total_amount_minor', 'currency', 'status', 'created_at', 'updated_at'],
        orderRows,
      ),
    );
    const orderIds = ordersRes.rows.map((r) => r.id);

    // completed orders (candidates for reviews)
    const completedOrderIds = [];
    orderIds.forEach((orderId, i) => {
      if (orderByIndex[i].status === 'COMPLETED') completedOrderIds.push(orderId);
    });
    console.log(`  → ${orderIds.length} orders (${completedOrderIds.length} completed available for reviews)`);

    // ── 5. Reviews (~200, all on completed orders) ────────────────────────
    // REQ-REVIEW-002: only completed orders may have reviews
    console.log('Seeding reviews …');
    const reviewRows = [];
    const shuffled = completedOrderIds.sort(() => Math.random() - 0.5);
    for (const orderId of shuffled.slice(0, Math.min(200, shuffled.length))) {
      const orderIndex = orderIds.indexOf(orderId);
      const buyerId    = orderByIndex[orderIndex].buyerId;
      const listingId  = orderByIndex[orderIndex].listingId;
      const rating     = randInt(1, 5);
      const comment =
        `${rating >= 4 ? 'Great' : rating === 3 ? 'Decent' : 'Disappointing'} purchase. Would ${rating >= 3 ? '' : 'not '}recommend.`;
      // review created after its order was completed
      const reviewAt = new Date(orderByIndex[orderIndex].createdAt.getTime() + randInt(1, 20) * DAY_MS);
      reviewRows.push([buyerId, listingId, orderId, rating, comment, iso(reviewAt), iso(reviewAt)]);
    }
    let reviewCount = 0;
    for (let i = 0; i < reviewRows.length; i += 100) {
      const chunk = reviewRows.slice(i, i + 100);
      const res = await client.query(
        bulkInsert(
          'reviews',
          ['buyer_id', 'listing_id', 'order_id', 'rating', 'comment', 'created_at', 'updated_at'],
          chunk,
          'ON CONFLICT (order_id) DO NOTHING',
        ),
      );
      reviewCount += res.rowCount;
    }
    console.log(`  → ${reviewCount} reviews`);

    await client.query('COMMIT');
    console.log('\nSeed complete ✓');
    console.log('Resource counts:');
    for (const tbl of ['sellers', 'buyers', 'listings', 'orders', 'reviews']) {
      const { rows } = await client.query(`SELECT COUNT(*) FROM ${tbl}`);
      console.log(`  ${tbl}: ${rows[0].count}`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  if (err.code) console.error(`  (pg code ${err.code}, position ${err.position})`);
  process.exit(1);
});
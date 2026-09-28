// src/db/seed.js
// Repeatable seed script (REQ-SEED-001, REQ-SEED-002, REQ-SEED-003)
// - Uses upsert (INSERT … ON CONFLICT DO NOTHING) so re-running is safe.
// - Produces realistic volumes: 50 sellers, 50 buyers, 300 listings,
//   400 orders, ~200 reviews — all with valid foreign-key relationships.
// - All money is in minor units (REQ-MONEY-001); currencies are explicit (REQ-MONEY-002).
// - IDs are gen_random_uuid() — generated, non-sequential (REQ-ID-001).

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

// ─── seed ───────────────────────────────────────────────────────────────────

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Sellers (50) ────────────────────────────────────────────────────
    console.log('Seeding sellers …');
    const sellerIds = [];
    for (let i = 1; i <= 50; i++) {
      const res = await client.query(
        `INSERT INTO sellers (name, email)
         VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [`Seller ${i}`, `seller${i}@example.com`],
      );
      sellerIds.push(res.rows[0].id);
    }
    console.log(`  → ${sellerIds.length} sellers`);

    // ── 2. Buyers (50) ─────────────────────────────────────────────────────
    console.log('Seeding buyers …');
    const buyerIds = [];
    for (let i = 1; i <= 50; i++) {
      const res = await client.query(
        `INSERT INTO buyers (name, email)
         VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [`Buyer ${i}`, `buyer${i}@example.com`],
      );
      buyerIds.push(res.rows[0].id);
    }
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
    const listingIds = [];
    for (let i = 1; i <= 300; i++) {
      const status   = pick(listingStatuses);
      const currency = pick(CURRENCIES);
      const priceMinor = randInt(100, 50000) * 100; // e.g. 10000 = 100 NGN
      const res = await client.query(
        `INSERT INTO listings (seller_id, title, description, price_minor, currency, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          pick(sellerIds),
          randomTitle(),
          `High-quality ${randomTitle().toLowerCase()}. Ships within 3–5 business days.`,
          priceMinor,
          currency,
          status,
        ],
      );
      if (res.rows[0]) listingIds.push(res.rows[0].id);
    }
    console.log(`  → ${listingIds.length} listings`);

    // Ensure we have ACTIVE listings for orders
    const { rows: activeRows } = await client.query(
      `SELECT id, price_minor, currency FROM listings WHERE status = 'ACTIVE' LIMIT 200`,
    );

    // ── 4. Orders (400) ────────────────────────────────────────────────────
    // Order statuses: 30% PENDING, 25% CONFIRMED, 35% COMPLETED, 10% CANCELLED
    console.log('Seeding orders …');
    const orderStatuses = [
      ...Array(30).fill('PENDING'),
      ...Array(25).fill('CONFIRMED'),
      ...Array(35).fill('COMPLETED'),
      ...Array(10).fill('CANCELLED'),
    ];
    const completedOrderIds = [];   // used for reviews
    const orderListingMap   = {};   // orderId → listingId (for reviews)
    const orderBuyerMap     = {};   // orderId → buyerId

    for (let i = 0; i < 400; i++) {
      const activeListing = pick(activeRows);
      const buyerId       = pick(buyerIds);
      const quantity      = randInt(1, 5);
      const unitPrice     = activeListing.price_minor;
      const totalAmount   = quantity * unitPrice;
      const status        = pick(orderStatuses);

      const res = await client.query(
        `INSERT INTO orders
           (buyer_id, listing_id, quantity, unit_price_minor, total_amount_minor, currency, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          buyerId,
          activeListing.id,
          quantity,
          unitPrice,
          totalAmount,
          activeListing.currency,
          status,
        ],
      );
      if (res.rows[0]) {
        const orderId = res.rows[0].id;
        orderListingMap[orderId] = activeListing.id;
        orderBuyerMap[orderId]   = buyerId;
        if (status === 'COMPLETED') completedOrderIds.push(orderId);
      }
    }
    console.log(`  → 400 orders (${completedOrderIds.length} completed available for reviews)`);

    // ── 5. Reviews (~half of completed orders) ────────────────────────────
    // REQ-REVIEW-002: only completed orders may have reviews
    console.log('Seeding reviews …');
    let reviewCount = 0;
    const shuffled = completedOrderIds.sort(() => Math.random() - 0.5);
    for (const orderId of shuffled.slice(0, Math.min(200, shuffled.length))) {
      const buyerId   = orderBuyerMap[orderId];
      const listingId = orderListingMap[orderId];
      const rating    = randInt(1, 5);

      const res = await client.query(
        `INSERT INTO reviews (buyer_id, listing_id, order_id, rating, comment)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (order_id) DO NOTHING
         RETURNING id`,
        [
          buyerId,
          listingId,
          orderId,
          rating,
          `${rating >= 4 ? 'Great' : rating === 3 ? 'Decent' : 'Disappointing'} purchase. Would ${rating >= 3 ? '' : 'not '}recommend.`,
        ],
      );
      if (res.rows[0]) reviewCount++;
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
  process.exit(1);
});

// src/server.js
// Express entry point.
// Mounts all /api/v1 resources, applies IP rate limiting from
// configuration (REQ-RATE-001, REQ-RATE-002, REQ-RATE-003) and
// guarantees the one success / one error envelope (REQ-API-007, REQ-API-008).

'use strict';

const express = require('express');
const path    = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { errorResponse } = require('./lib/response');
const { rateLimiter }    = require('./middleware/rateLimit');
const cors               = require('./middleware/cors');

const buyersRouter  = require('./routes/buyers');
const sellersRouter = require('./routes/sellers');
const listingsRouter = require('./routes/listings');
const ordersRouter  = require('./routes/orders');
const reviewsRouter = require('./routes/reviews');

const app = express();

app.disable('x-powered-by');
app.use(cors);
app.use(express.json());

// Root API metadata — not a landing page, just a discoverable index (REQ-API-002)
app.get('/', (_req, res) => {
  res.json({
    data: {
      name: 'Marketplace API',
      version: 'v1',
      resources: ['buyers', 'sellers', 'listings', 'orders', 'reviews'],
      docs: '/README_API_DOCUMENTATION.md',
    },
  });
});

// IP rate limiting applies to the whole public API surface (REQ-RATE-001)
app.use('/api/v1', rateLimiter);

// Resource routers (REQ-API-001 — all endpoints under /api/v1)
app.use('/api/v1/buyers',  buyersRouter);
app.use('/api/v1/sellers', sellersRouter);
app.use('/api/v1/listings', listingsRouter);
app.use('/api/v1/orders',  ordersRouter);
app.use('/api/v1/reviews', reviewsRouter);

// 404 for anything unmatched (REQ-ERROR-002)
app.use((req, res) => {
  res.status(404).json(errorResponse('NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`));
});

// Central error handler (REQ-API-008, REQ-ERROR-005)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json(errorResponse('INTERNAL_ERROR', 'Unexpected server error'));
});

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, () => {
  console.log(`Marketplace API listening on port ${PORT}`);
});
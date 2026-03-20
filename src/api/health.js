const express = require('express');
const { locationQueue } = require('../tcp/server');

const router = express.Router();
const startTime = Date.now();

// GET /health — no auth needed (stress test monitoring)
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    pending_count: locationQueue.length,
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
  });
});

module.exports = router;
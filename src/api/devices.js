const express = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../db/client');
const { JWT_SECRET } = require('../config');

const router = express.Router();

// Middleware — verify JWT
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });

  try {
    req.user = jwt.verify(header.replace('Bearer ', ''), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// GET /devices — Admin sees all, Customer sees only their own
router.get('/', auth, async (req, res) => {
  try {
    const where = req.user.role === 'Admin' ? {} : { customerId: req.user.id };
    const devices = await prisma.device.findMany({ where });
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /devices/:imei/history — last 100 location logs
router.get('/:imei/history', auth, async (req, res) => {
  try {
    const { imei } = req.params;

    // Customers can only query their own devices
    if (req.user.role === 'Customer') {
      const device = await prisma.device.findFirst({ where: { imei, customerId: req.user.id } });
      if (!device) return res.status(403).json({ error: 'Forbidden' });
    }

    const logs = await prisma.locationLog.findMany({
      where: { imei },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../db/client');
const { JWT_SECRET } = require('../config');

const router = express.Router();

// POST /auth/token — generate a test JWT
router.post('/token', async (req, res) => {
  const { email, role } = req.body;

  if (!email || !['Admin', 'Customer'].includes(role)) {
    return res.status(400).json({ error: 'email and role (Admin|Customer) required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
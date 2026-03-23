const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../db/client');
const { JWT_SECRET } = require('../config');

const router = express.Router();

// POST /auth/token — validate credentials and return a JWT
router.post('/token', async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !['Admin', 'Customer'].includes(role)) {
    return res.status(400).json({ error: 'email, password, and role (Admin|Customer) required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid password' });

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
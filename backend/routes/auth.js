const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

// SIGNUP
router.post('/signup', async (req, res) => {
  const { name, password, branch, year } = req.body;
  const email = String(req.body.email || '').trim().toLowerCase();

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ message: 'This email is already registered' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const { rows } = await db.query(
    'INSERT INTO users (name, email, password_hash, branch, year) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [String(name).trim(), email, hash, branch || null, year || null]
  );

  res.status(201).json({ message: 'Signup successful', userId: rows[0].id });
});

// LOGIN
router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = jwt.sign({ id: user.id, name: user.name }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      branch: user.branch,
      year: user.year,
      role: user.role,
    },
  });
});

module.exports = router;
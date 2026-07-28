import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';

const router = Router();

// Cost factor for bcrypt. Higher = slower = harder to brute-force offline.
// 12 is a reasonable default in 2026, bump it up as hardware gets faster.
const SALT_ROUNDS = 12;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email);
}

function isValidPassword(password) {
  //NIST recommends length over forced complexity [see NIST SP 800-63B]
  return typeof password === 'string' && password.length >= 10;
}

router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "... Right, are you sure that's a real mail?" });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: "Hey, your password need to be at least 10 characters" });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    // Same message as a generic failure 
    // Don't confirm which emails are registered [called "user enumeration" vulnerability]
    return res.status(400).json({ error: "Sorry, can't register these details" });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const result = db
    .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
    .run(email, passwordHash);

  return res.status(201).json({ id: result.lastInsertRowid, email });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!isValidEmail(email) || typeof password !== 'string') {
    return res.status(400).json({ error: 'Try again, your pass or email are invalid' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  // Always run bcrypt.compare, even if the user doesn't exist
  // Otherwise, a missing user returns instantly while a real user takes ~100ms
  // [An attacker can time this to enumerate accounts]
  const hashToCheck = user
    ? user.password_hash
    : '$2b$12$C6UzMDM.H6dfI/f/IKcEeO6H0lJj3f0f0d2i3z8b2fPQK1234567890';

  const passwordMatches = await bcrypt.compare(password, hashToCheck);

  if (!user || !passwordMatches) {
    return res.status(401).json({ error: '' });
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  return res.json({ token });
});

export default router;
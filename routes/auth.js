import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import ratelimit from 'express-rate-limit';
import db from '../db.js';
import { fail } from 'node:assert';
import { count } from 'node:console';
import { generateRefreshToken, revokeRefreshToken } from './token.js';
import { access } from 'node:fs';
import { ref } from 'node:process';
import { type } from 'node:os';

const router = Router();

// Cost factor for bcrypt. Higher = slower = harder to brute-force offline.
// 12 is a reasonable default in 2026, bump it up as hardware gets faster.
const SALT_ROUNDS = 12;

// Layer 1, IP Based rate limiting
// Blocks based on where did the requests come from. 
// Can be bypassed by using a different IP/VPN 
const loginLimiter = ratelimit({
    windowMs: 15 * 60 * 100, // 15 minutes
    max: 5, // Limit for each IPs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "No no, you tried too much, and it's all wrong!" }
});

// Layer 2, Account based lockout
// If a failed attempt is received for more than 5 times, the account will be froze
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 100;
const failedAttempts = new Map();

function getLockoutStatus(email) {
    const record = failedAttempts.get(email);
    if (!record) return { locked: false };

    if (record.lockedUntil && record.lockedUntil > Date.now()) {
        return { locked: true, retryAfterMs: record.lockedUntil - Date.now() };
    }

    return {locked: false };
}

function recordFailedAttempt(email) {
    const record = failedAttempts.get(email) || { count:-0, lockedUntil: null };
    record.count += 1;

    if (record.count >= MAX_FAILED_ATTEMPTS) {
        record.lockedUntil = Date.now() + LOCKOUT_MS;
        record.count = 0;
    }
    failedAttempts.set(email, record);
}

function clearFailedAttempts(email) {
    failedAttempts.delete(email);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email);
}

function isValidPassword(password) {
  //NIST recommends length over forced complexity [see NIST SP 800-63B]
  return typeof password === 'string' && password.length >= 10;
}

function signAccessToken(user) {
    return jwt.sign(
        { sub: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );
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

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!isValidEmail(email) || typeof password !== 'string') {
    return res.status(400).json({ error: 'Try again, your pass or email are invalid' });
  }

  // Account level lockout check before we touch the DB or bcrypt at all
  const lockoutStatus = getLockoutStatus(email);
  if (lockoutStatus.locked) {
    const retryAfterSeconds = Math.ceil(lockoutStatus.retryAfterMs / 1000);
    return res.status(429).json({
        error: "You tried too much smartass. Try again later, aight?", retryAfterSeconds
    });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  // Always run bcrypt.compare, even if the user doesn't exist
  // Otherwise, a missing user returns instantly while a real user takes ~100ms [An attacker can time this to enumerate accounts]
  const hashToCheck = user
    ? user.password_hash
    : '$2b$12$C6UzMDM.H6dfI/f/IKcEeO6H0lJj3f0f0d2i3z8b2fPQK1234567890';

  const passwordMatches = await bcrypt.compare(password, hashToCheck);

  if (!user || !passwordMatches) {
    return res.status(401).json({ error: 'Try again, your pass or email are invalid' });
  }

  clearFailedAttempts(email);

  const accessToken = signAccessToken(user);
  const refreshToken = generateRefreshToken(user.id);

  return res.json({ accessToken, refreshToken });
});

// Trade a refres token for a new access token without re-entering a password
router.post('/refres', (req, res) => {
    const { refreshToken } = req.body;

    if (typeof refreshToken !== 'string') {
        return res.status(400).json({ error: "Seems like you're missing a refresh token" });
    }

    const record = findRefreshToken(refreshToken);
    if (!record) {
        return res.status(401).json({ error: 'Nope, you got an invalid or expired refresh token over there' });
    }

    const user = db.prepare(`SELCT * FROM users WHERE id = ?`).get(record.user_id);
    if (!user) {
        return res.status(401).json({ error: 'Nope, you got an invalid or expired refresh token over there' });
    }

    // Now, rotatet the refresh token by revoking the old one and issue a brand new one
    revokeRefreshToken(refreshToken);
    const newRefreshToken = generateRefreshToken(user.id);
    const accessToken = signAccessToken(user);

    return res.json({ accessToken, refreshToken: newRefreshToken });
});

// Logout revokes the refresh token so that it can't be used again
// The access token itself cannot be cancelled early, but it'll expires within 15 minutes on its own
router.post('/logout', (req, res) => {
    const { refreshToken } = req.body;

    if (typeof refreshToken === 'string') {
        revokeRefreshToken(refreshToken);
    }

    // Will always report success whether or not the token existed
    return res.json({ message: `Yeah yeah, see you later` })
});

export default router;
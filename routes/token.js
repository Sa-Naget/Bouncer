import crypto from 'node:crypto';
import db from '../db.js';

// 7 days feels reasonable for a demo — long enough you're not forced to
// log in constantly, short enough that a leaked token doesn't stay
// dangerous forever. Real apps often make this configurable per-user
// (e.g. shorter on shared devices).
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// We hash refresh tokens before storing them, same principle as
// passwords: if the database ever leaked, the tokens inside it shouldn't
// be directly usable. Unlike passwords, these are already high-entropy
// random values (not human-guessable), so a fast hash (sha256) is fine —
// we don't need bcrypt's deliberate slowness here, we need a fast lookup.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken(userId) {
  const token = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();

  db.prepare(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).run(userId, tokenHash, expiresAt);

  // Return the RAW token to send to the client — only the hash lives in
  // the database. This is the one and only time the raw value exists;
  // if it's lost, it's gone (same idea as never storing a raw password).
  return token;
}

function findRefreshToken(token) {
  const tokenHash = hashToken(token);
  const row = db
    .prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?')
    .get(tokenHash);

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  return row;
}

function revokeRefreshToken(token) {
  const tokenHash = hashToken(token);
  db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(tokenHash);
}

export { generateRefreshToken, findRefreshToken, revokeRefreshToken };
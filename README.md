# Bouncer 🚪

A tiny auth system built completely from scratch — no Passport, no Auth0,
no Firebase magic. Just bcrypt, JWTs, and me making sure I actually
understand what's happening at the door before letting anyone in (｡•̀ᴗ-)✧

## Structure ✦｡°✩

```
bouncer/
├── server.js          ← the entry point, wires everything up
├── db.js              ← schema + connection, shared by everything
├── routes/
│   └── auth.js        ← register + login, hashing, token issuing
├── .env.example       ← copy me to .env and fill in your secret
└── auth.db            ← created automatically on first run ♪
```

Only one place knows the schema: `db.js`. `auth.js` just asks it questions.
Fixing a bug or adding a column happens once, everywhere picks it up.

## Usage (๑ > ᴗ < ๑)

```bash
npm install
cp .env.example .env
# open .env and set JWT_SECRET to something long and random
npm run dev
```

Then knock on the door:

```bash
# Register — bouncer checks your ID is valid and files it away
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"correct-horse-battery"}'

# Login — bouncer checks your ID against the file, hands you a wristband
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"correct-horse-battery"}'

# Flash your wristband to get past the velvet rope
curl http://localhost:3000/me \
  -H "Authorization: Bearer <token from login>"
```

## How it works (๑>؂•̀๑)

- `db.js` owns the schema — one `users` table, `email` + `password_hash`
- Passwords are never stored as-is — bcrypt hashes them (cost factor 12),
  so even if the database leaked, nobody's actual password is exposed
- Login takes the same amount of time whether your email exists or not —
  otherwise a stopwatch is enough to guess valid accounts
- Register and login return the same vague error either way, so nobody
  can fish for which emails are already signed up
- Tokens are JWTs with a short 15 minute expiry — a stolen wristband
  doesn't stay useful for long

## Roadmap ⋆.˚

Currently at **stage 1** (register + login). Next up: session hardening,
rate limiting so the bouncer notices someone trying every password in
the book, a password reset flow, and TOTP 2FA so there's a second ID
check at the door.

## Stack

Node.js, Express, better-sqlite3, bcrypt, jsonwebtoken. Deliberately
no auth framework — every piece stays visible and explainable.
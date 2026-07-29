# Bouncer 

A tiny auth system built completely from scratch with no Passport, no Auth0, and no Firebase magic.
Just bcrypt, JWTs, and me making sure I actually understand what's happening at the door before letting anyone in (｡•̀ᴗ-)✧

## Structure ✦｡°✩

```
bouncer/
├── server.js               ← the entry point, wires everything up
├── db.js                   ← schema + connection, shared by everything
├── routes/
│   └── auth.js             ← register + login, hashing, token issuing
├── scripts/
│   └── brute-force-test.js ← hammers login to prove the point below
├── .env.example            ← copy me to .env and fill it with your own secret
└── auth.db                 ← created automatically on first run ♪
```

Only one place knows the schema: `db.js`. `auth.js` just asks it questions (◡ ‿ ◡ .)
Fixing a bug or adding a column happens once, others just picks it up.

## Usage (๑ > ᴗ < ๑)

```bash
npm install
cp .env.example .env
# open .env and set JWT_SECRET to something something random
npm run dev
```

Then knock on the door,

```bash
# Register — bouncer checks your ID is valid and files it away
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"me@naget.com","password":"smiling-golden-brown-nugget"}'

# Login — bouncer checks your ID against the file, hands you a wristband
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"me@naget.com","password":"smiling-golden-brown-nugget"}'

# Flash your wristband to get past the velvet rope 
curl http://localhost:3000/me \
  -H "Authorization: Bearer <token from login>"
```

## How it works ( ˶°ㅁ°) !!

- `db.js` owns the schema. One `users` table, `email` + `password_hash`
- Passwords are never stored as-is, bcrypt hashes them (cost factor 12).
  so even if the database leaked, nobody's actual password is exposed (≖⩊≖)
- Login takes the same amount of time whether your email exists or not
  Otherwise a stopwatch is enough to guess the valid accounts
- Register and login return the same vague error either way, so nobody can fish for which emails are already signed up
- Tokens are JWTs with a short 15 minute expiry so that a stolen wristband doesn't stay useful for long you kno

## Rate limiting (˶ᵔ ᵕ ᵔ˶) stage 3

The bouncer finally notices repeat troublemakers, two ways:

- **By IP** ; max 5 login attempts per 15 minutes from the same address
- **By account** ; max 5 failed attempts on the *same email* no matter where they come from, then it's a 15 minute lockout

`scripts/brute-force-test.js` used to breeze through all 20 wrong passwords
with nothing stopping it. Run it again now and watch it get shut down
partway through (｀へ´)

A successful login wipes the slate clean, no grudges held once you prove who you are.

## Roadmap ⋆.˚ (ᵕ—ᴗ—)

Currently at **stage 3** (rate limiting). 
Next up: session hardening, a password reset flow, and TOTP 2FA so there's a second ID check at the door

## Stack 三三ᕕ( ᐛ )ᕗ

Node.js, Express, node:sqlite (built into Node, no compiling needed), bcryptjs, jsonwebtoken, express-rate-limit. 
Deliberately no auth framework so every piece stays visible and explainable :D
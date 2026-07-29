// Brute-force test script — for testing YOUR OWN local server only.
//
// This just fires a bunch of wrong-password login attempts at your own
// running server, one after another, and times how long it takes. Right
// now (before Stage 3) nothing stops this — that's the point. Run this,
// watch it go through all 20 attempts without ever getting blocked, then
// we'll add rate limiting and run it again to see the difference.
//
// Usage:
//   node scripts/brute-force-test.js you@example.com

const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/brute-force-test.js <email-you-registered>');
  process.exit(1);
}

const wrongPasswords = [
  'password123', 'qwerty12345', 'letmein1234', 'admin12345',
  'welcome1234', 'monkey12345', 'dragon12345', 'football123',
  'iloveyou123', 'trustno1234', 'sunshine123', 'princess123',
  'password124', 'password125', 'password126', 'password127',
  'password128', 'password129', 'password130', 'password131',
];

async function attempt(password) {
  const start = Date.now();
  const res = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const ms = Date.now() - start;
  return { status: res.status, ms };
}

async function main() {
  console.log("\nHello!! It is I Ruthe :3")
  console.log(`I'm attempting ${wrongPasswords.length} wrong passwords against ${email} ...\n`);

  let blocked = 0;

  for (const password of wrongPasswords) {
    const { status, ms } = await attempt(password);
    const flag = status === 429 ? '  <-- blocked!' : '';
    if (status === 429) blocked++;
    console.log(`  "${password}" -> ${status} (${ms}ms)${flag} (๑•̀ㅁ•́๑)!`);
  }

  console.log(`\nAnd.. done! ${blocked}/${wrongPasswords.length} attempts were blocked ( ◡̀_◡́)ᕤ\n`);
  if (blocked === 0) {
    console.log('How co0oolll! None of them were blocked, the server let us try every single one XD');
    console.log('I guess that\'ll be the job of rate limit huh?\n');
  }
}

main().catch((err) => {
  console.error('... hmm, is your server running with `npm run dev`?');
  console.error(err.message);
});
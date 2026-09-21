/**
 * Checks the half of the Clerk sync that writes to the database — the part that decides who
 * appears in the dashboard and who counts as suspended. Clerk's own SDK needs Next's runtime, so
 * the list call is not exercised here; everything it feeds is. Run: pnpm check:users
 */
// Type-only, so it is erased before Node ever loads the module (which needs env set up first).
import type { ClerkPerson } from '../src/server/users/mirror';

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!ok) failures += 1;
};

async function main() {
  // Only when nothing is set already, so the same script can be pointed at production.
  if (!process.env.DATABASE_URL) process.loadEnvFile('.env.local');
  const { db } = await import('../src/server/db');
  const { mirrorPeople, mirrorPerson } = await import('../src/server/users/mirror');

  const stamp = Date.now();
  const clerkId = `probe_${stamp}`;
  const created = new Date('2026-01-02T03:04:05.000Z');
  const person = (over: Partial<ClerkPerson> = {}): ClerkPerson => ({
    clerkId,
    username: `probe-${stamp}`,
    name: null,
    email: null,
    banned: false,
    role: null,
    createdAt: created,
    lastSignInAt: null,
    ...over,
  });

  const usersBefore = await db.user.count();

  // Everything runs inside a transaction that is rolled back: this suite is pointed at a real
  // database with real people in it.
  await db
    .$transaction(async (tx) => {
      const first = await mirrorPeople([person()], tx);
      check('mirrors a person Clerk has and we do not', first.created === 1 && first.updated === 0);

      const row = await tx.user.findUniqueOrThrow({ where: { clerkId } });
      check('carries Clerk’s created_at', row.createdAt.toISOString() === created.toISOString(), row.createdAt.toISOString());
      check('a username-only person needs no email', row.email === null && row.username === `probe-${stamp}`);
      check('an unbanned person is active', row.status === 'active');

      // The same list again must be a no-op, or every page load would rewrite every row.
      const again = await mirrorPeople([person()], tx);
      check('unchanged people are not rewritten', again.created === 0 && again.updated === 0, JSON.stringify(again));

      const renamed = await mirrorPeople([person({ name: 'Probe Person', banned: true })], tx);
      const afterBan = await tx.user.findUniqueOrThrow({ where: { clerkId } });
      check('a rename in Clerk follows through', renamed.updated === 1 && afterBan.name === 'Probe Person');
      check('a ban in Clerk reads as suspended here', afterBan.status === 'suspended');

      // Someone who vanishes from Clerk keeps their row — their configs and tunnels are real.
      const without = await mirrorPeople([], tx);
      check(
        'a person missing from Clerk is kept, not deleted',
        without.created === 0 && (await tx.user.findUnique({ where: { clerkId } })) !== null,
      );

      // First sign-in takes this path instead, and must agree with the sync rather than duplicate.
      const signedIn = await mirrorPerson(person({ banned: false }), tx);
      check('first sign-in updates the same row', signedIn.clerkId === clerkId && signedIn.status === 'active');
      check('first sign-in creates no duplicate', (await tx.user.count({ where: { clerkId } })) === 1);

      throw new Error('ROLLBACK');
    })
    .catch((error: Error) => {
      if (error.message !== 'ROLLBACK') throw error;
    });

  check('nothing persisted', (await db.user.count()) === usersBefore);

  console.log(failures ? `\n${failures} FAILED` : '\nuser mirror OK');
  process.exit(failures ? 1 : 0);
}

main();

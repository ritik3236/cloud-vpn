/**
 * Mints an enrollment token without a Clerk session, for testing the installer end to end.
 * The real path is the dashboard; this exists because every service is behind an admin gate
 * and there is no signed-in admin on the dev instance yet.
 *
 *   pnpm mint:token "VPN-1" Stockholm njal.la 10.8.0.0/24 1.1.1.1
 */
import { createHash, randomBytes } from 'node:crypto';

async function main() {
  process.loadEnvFile('.env.local');
  const { db } = await import('../src/server/db');

  const [name, region, provider, cidrPool, dns] = process.argv.slice(2);
  if (!name || !region || !provider || !cidrPool || !dns) {
    console.error('usage: pnpm mint:token <name> <region> <provider> <cidrPool> <dns>');
    process.exit(2);
  }

  const staff = await db.staff.upsert({
    where: { clerkId: 'local-script' },
    create: { clerkId: 'local-script', role: 'admin' },
    update: {},
  });

  const token = 'cvpn_' + randomBytes(24).toString('base64url');
  await db.enrollmentToken.create({
    data: {
      tokenHash: createHash('sha256').update(token).digest('hex'),
      name, region, provider, cidrPool, dns,
      createdById: staff.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  console.log(token);
  process.exit(0);
}

main();

import { loadEnvFile } from 'node:process';

import { defineConfig, env } from 'prisma/config';

// Next loads .env.local automatically; the Prisma CLI only reads .env. Load it here so one
// env file serves both instead of duplicating credentials across two.
try {
  loadEnvFile('.env.local');
} catch {
  // absent in CI/production, where the variables are already in the environment
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // Migrations run over the UNPOOLED endpoint — Prisma Migrate fails through Neon's pooler.
  // The runtime client uses the pooled URL via the pg adapter instead (src/server/db.ts).
  datasource: { url: env('DIRECT_URL') },
});

import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { env } from '@/lib/env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // Runtime connects over the POOLED endpoint; migrations use DIRECT_URL via prisma.config.ts.
  // The control plane is a long-lived process, so a small local pool in front of Neon's
  // pooler is the right shape (not the serverless WebSocket driver).
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, max: 10 });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

/**
 * Constructed on first query, not at import. `next build` loads these modules while compiling
 * routes, and building a connection pool then would mean the image could only be built with a
 * reachable database — a build-time dependency on production infrastructure.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, property: string | symbol) {
    if (!globalForPrisma.prisma) {
      const client = createClient();
      // Reused across dev hot-reloads; in production the module is loaded once anyway.
      globalForPrisma.prisma = client;
    }
    return Reflect.get(globalForPrisma.prisma, property, globalForPrisma.prisma);
  },
});

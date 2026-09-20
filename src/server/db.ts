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

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

import 'server-only';

import type { Prisma } from '@prisma/client';

import type { Role } from '@/auth/roles';
import { db } from '@/server/db';

/** A Clerk user, flattened to what this app stores and shows. */
export type ClerkPerson = {
  clerkId: string;
  username: string | null;
  name: string | null;
  email: string | null;
  banned: boolean;
  role: Role | null;
  createdAt: Date;
  lastSignInAt: Date | null;
};

/**
 * The only columns this app mirrors. Role and last sign-in are deliberately not among them: they
 * are Clerk's answer to a question we can ask at any time, and a copy would go stale silently.
 */
const mirrorFields = (person: ClerkPerson) => ({
  username: person.username,
  name: person.name,
  email: person.email,
  status: person.banned ? ('suspended' as const) : ('active' as const),
});

/**
 * Reflects Clerk's people into `users`, writing only rows that are new or changed so a steady
 * state costs a single query. Never deletes: a person who disappears from Clerk keeps their row,
 * because their configs — and their live tunnels — are still real.
 *
 * Takes a client so callers can run it inside a transaction.
 */
export async function mirrorPeople(people: ClerkPerson[], client: Prisma.TransactionClient = db) {
  const existing = new Map(
    (
      await client.user.findMany({
        where: { clerkId: { in: people.map((person) => person.clerkId) } },
        select: { clerkId: true, username: true, name: true, email: true, status: true },
      })
    ).map((row) => [row.clerkId, row]),
  );

  const creates: Prisma.UserCreateManyInput[] = [];
  let updated = 0;

  for (const person of people) {
    const next = mirrorFields(person);
    const prev = existing.get(person.clerkId);
    if (!prev) {
      // Carry Clerk's creation date, so "added" means when the admin created them rather than
      // when this control plane first happened to look.
      creates.push({ clerkId: person.clerkId, createdAt: person.createdAt, ...next });
    } else if (
      prev.username !== next.username ||
      prev.name !== next.name ||
      prev.email !== next.email ||
      prev.status !== next.status
    ) {
      await client.user.update({ where: { clerkId: person.clerkId }, data: next });
      updated += 1;
    }
  }

  if (creates.length) await client.user.createMany({ data: creates, skipDuplicates: true });
  return { created: creates.length, updated };
}

/** Mirrors one person — used on first sign-in, before any sync has seen them. */
export async function mirrorPerson(person: ClerkPerson, client: Prisma.TransactionClient = db) {
  return client.user.upsert({
    where: { clerkId: person.clerkId },
    create: { clerkId: person.clerkId, createdAt: person.createdAt, ...mirrorFields(person) },
    update: mirrorFields(person),
  });
}

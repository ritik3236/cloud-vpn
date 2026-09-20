import 'server-only';

import type { Prisma } from '@prisma/client';

export class PoolExhaustedError extends Error {
  constructor(nodeId: string, cidr: string) {
    super(`node ${nodeId} has no free addresses left in ${cidr}`);
    this.name = 'PoolExhaustedError';
  }
}

const ipToInt = (ip: string) =>
  ip.split('.').reduce((acc, octet) => acc * 256 + Number(octet), 0) >>> 0;

const intToIp = (n: number) =>
  [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');

/**
 * Usable client addresses in a pool. The network and broadcast addresses are excluded, and so is
 * the first host — that is the node's own tunnel address, which `wg` already owns.
 */
export function poolRange(cidr: string): { first: number; last: number } {
  const [base, prefixText] = cidr.split('/');
  const prefix = Number(prefixText);
  if (!base || !Number.isInteger(prefix) || prefix < 8 || prefix > 30) {
    throw new Error(`unsupported cidr_pool: ${cidr}`);
  }
  const size = 2 ** (32 - prefix);
  const network = ipToInt(base) & ((~(size - 1) >>> 0) as number);
  return { first: network + 2, last: network + size - 2 };
}

/**
 * Lowest free address on the node.
 *
 * This reads then writes, so two concurrent generates can pick the same address — the PARTIAL
 * unique index on (node_id, ip) WHERE released_at IS NULL rejects the loser, and the caller
 * retries. The index is the actual guarantee; this function is only the fast path.
 */
export async function allocateIp(
  tx: Prisma.TransactionClient,
  input: { nodeId: string; cidrPool: string; configId: string },
): Promise<string> {
  const { first, last } = poolRange(input.cidrPool);

  const live = await tx.ipAllocation.findMany({
    where: { nodeId: input.nodeId, releasedAt: null },
    select: { ip: true },
  });
  const taken = new Set(live.map((row) => ipToInt(row.ip)));

  for (let candidate = first; candidate <= last; candidate += 1) {
    if (taken.has(candidate)) continue;
    const ip = intToIp(candidate);
    await tx.ipAllocation.create({
      data: { nodeId: input.nodeId, ip, configId: input.configId },
    });
    return ip;
  }

  throw new PoolExhaustedError(input.nodeId, input.cidrPool);
}

/** Is this address inside the pool at all? Catches a node whose interface sits elsewhere. */
export function poolContains(cidr: string, address: string): boolean {
  const bare = address.split('/')[0];
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(bare)) return false;
  const { first, last } = poolRange(cidr);
  const value = ipToInt(bare);
  // `first` excludes the node's own .1, which is exactly the address being checked here.
  return value >= first - 1 && value <= last + 1;
}

/** Revoke returns the address to the pool; disable deliberately does not (SPEC §5). */
export async function releaseIp(tx: Prisma.TransactionClient, configId: string): Promise<void> {
  await tx.ipAllocation.updateMany({
    where: { configId, releasedAt: null },
    data: { releasedAt: new Date() },
  });
}

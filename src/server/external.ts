import 'server-only';

import { AUDIT_ACTIONS, recordAudit } from '@/server/audit';
import { encrypt } from '@/server/crypto';
import { db } from '@/server/db';
import { actingStaff } from '@/server/staff';

export class InvalidExternalConfig extends Error {
  constructor(detail: string) {
    super(`That does not look like a WireGuard config: ${detail}.`);
    this.name = 'InvalidExternalConfig';
  }
}

/**
 * Parses only enough to reject a paste that would never work and to show something useful in
 * the table. We deliberately do not rewrite the file — it is the provider's, and it gets
 * handed back byte for byte.
 */
function inspect(text: string) {
  const present = (pattern: RegExp) => pattern.test(text);

  if (!present(/\[Interface\]/i)) throw new InvalidExternalConfig('there is no [Interface] section');
  if (!present(/^\s*PrivateKey\s*=\s*\S+/im)) {
    throw new InvalidExternalConfig('the [Interface] section has no PrivateKey');
  }
  if (!present(/\[Peer\]/i)) throw new InvalidExternalConfig('there is no [Peer] section');
  if (!present(/^\s*PublicKey\s*=\s*\S+/im)) {
    throw new InvalidExternalConfig('the [Peer] section has no PublicKey');
  }
  if (!present(/^\s*Endpoint\s*=\s*\S+/im)) {
    throw new InvalidExternalConfig('the [Peer] section has no Endpoint');
  }

  return {
    address: text.match(/^\s*Address\s*=\s*([^\s,]+)/im)?.[1]?.split('/')[0] ?? null,
    endpoint: text.match(/^\s*Endpoint\s*=\s*(\S+)/im)?.[1] ?? null,
    allowedIps: text.match(/^\s*AllowedIPs\s*=\s*(.+)$/im)?.[1]?.trim() ?? '0.0.0.0/0',
  };
}

/**
 * Stores a config from a provider we cannot control (SPEC §6). There is no keypair to generate
 * and no peer to add — the file is the whole artifact, so it is encrypted and kept as-is.
 */
export async function uploadExternalConfig(input: {
  sourceName: string;
  conf: string;
  deviceLabel?: string;
}) {
  const staff = await actingStaff('admin');

  const sourceName = input.sourceName.trim();
  if (!sourceName) throw new InvalidExternalConfig('the provider needs a name');

  const conf = input.conf.trim();
  const details = inspect(conf);

  const source = await db.externalSource.upsert({
    where: { name: sourceName },
    create: { name: sourceName },
    update: {},
  });

  const config = await db.config.create({
    data: {
      sourceType: 'static',
      status: 'unassigned',
      externalSourceId: source.id,
      deviceLabel: input.deviceLabel?.trim() || null,
      encryptedConf: encrypt(conf),
      assignedIp: details.address,
      allowedIps: details.allowedIps,
      issuedById: staff.id,
    },
  });

  await recordAudit({
    actorId: staff.clerkId,
    action: AUDIT_ACTIONS.configGenerate,
    target: config.id,
    detail: { source: source.name, external: true, endpoint: details.endpoint },
  });

  return { config, source, endpoint: details.endpoint };
}

export const listExternalSources = () =>
  db.externalSource.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });

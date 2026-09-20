import type { Prisma } from '@prisma/client';

import { db } from '@/server/db';

/** SPEC §8 — every mutation and every key retrieval lands here. */
export const AUDIT_ACTIONS = {
  configGenerate: 'config.generate',
  configAssign: 'config.assign',
  configUnassign: 'config.unassign',
  configView: 'config.view',
  configDisable: 'config.disable',
  configEnable: 'config.enable',
  configRevoke: 'config.revoke',
  configReassign: 'config.reassign',
  nodeEnrollToken: 'node.enroll_token',
  nodeCreate: 'node.create',
  nodeDelete: 'node.delete',
  userCreate: 'user.create',
  userSuspend: 'user.suspend',
  userReactivate: 'user.reactivate',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export async function recordAudit(entry: {
  actorId: string | null;
  action: AuditAction;
  target?: string;
  detail?: Prisma.InputJsonValue;
}) {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      target: entry.target,
      detail: entry.detail,
    },
  });
}

'use server';

import { revalidatePath } from 'next/cache';

import { errorMessage } from '@/features/error-message';
import { configQrSvg } from '@/server/qr';
import type { ActionResult } from '@/features/nodes/actions';
import { db } from '@/server/db';
import { uploadExternalConfig } from '@/server/external';
import {
  assignConfig,
  disableConfig,
  enableConfig,
  generateConfig,
  getConfigFile,
  revokeConfig,
  unassignConfig,
} from '@/server/configs/lifecycle';

const done = (message: string): ActionResult => {
  revalidatePath('/dashboard/configs');
  return { ok: true, message };
};

export async function generateConfigAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const label = String(formData.get('deviceLabel') ?? '').trim();
    const config = await generateConfig({
      nodeId: String(formData.get('nodeId') ?? ''),
      deviceLabel: label || undefined,
    });
    return done(`Spare ${config.assignedIp} is ready to assign.`);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function uploadExternalConfigAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { source, endpoint } = await uploadExternalConfig({
      sourceName: String(formData.get('sourceName') ?? ''),
      conf: String(formData.get('conf') ?? ''),
      deviceLabel: String(formData.get('deviceLabel') ?? ''),
    });
    return done(
      `${source.name} config stored${endpoint ? ` (${endpoint})` : ''}. Assign it when someone needs it.`,
    );
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function assignConfigAction(configId: string, userId: string): Promise<ActionResult> {
  try {
    await assignConfig({ configId, userId });
    return done('Config assigned. The tunnel is live.');
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function unassignConfigAction(configId: string): Promise<ActionResult> {
  try {
    await unassignConfig({ configId });
    return done('Config returned to the pool. Their copy of the file no longer connects.');
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function disableConfigAction(configId: string): Promise<ActionResult> {
  try {
    await disableConfig({ configId });
    return done('Config disabled. The tunnel is down.');
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function enableConfigAction(configId: string): Promise<ActionResult> {
  try {
    await enableConfig({ configId });
    return done('Config re-enabled. The original file works again.');
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function revokeConfigAction(configId: string): Promise<ActionResult> {
  try {
    await revokeConfig({ configId });
    return done('Config revoked. Its address is back in the pool.');
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export type RetrieveResult =
  | { ok: true; filename: string; content: string; qrSvg: string }
  | { ok: false; error: string };

/**
 * Admin-only and audited — `getConfigFile` enforces both, and the audit row it writes is what
 * `unassignConfig` later reads as evidence the key may be in someone's hands.
 */
export async function retrieveConfigAction(configId: string): Promise<RetrieveResult> {
  try {
    const content = await getConfigFile({ configId });

    const config = await db.config.findUniqueOrThrow({
      where: { id: configId },
      select: { assignedIp: true, deviceLabel: true, node: { select: { name: true } } },
    });
    const slug = [config.node?.name, config.deviceLabel ?? config.assignedIp]
      .filter(Boolean)
      .join('-')
      .replace(/[^A-Za-z0-9._-]/g, '-')
      .toLowerCase();

    const qrSvg = await configQrSvg(content);

    return { ok: true, filename: `${slug || 'wireguard'}.conf`, content, qrSvg };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

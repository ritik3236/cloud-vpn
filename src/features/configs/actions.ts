'use server';

import { revalidatePath } from 'next/cache';

import { errorMessage } from '@/features/error-message';
import type { ActionResult } from '@/features/nodes/actions';
import {
  assignConfig,
  disableConfig,
  enableConfig,
  generateConfig,
  revokeConfig,
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

export async function assignConfigAction(configId: string, userId: string): Promise<ActionResult> {
  try {
    await assignConfig({ configId, userId });
    return done('Config assigned. The tunnel is live.');
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

'use server';

import { revalidatePath } from 'next/cache';

import { errorMessage } from '@/features/error-message';
import type { ActionResult } from '@/features/nodes/actions';
import { pluralise } from '@/lib/format';
import { personLabel } from '@/lib/person';
import { reactivateUser, suspendUser } from '@/server/users';

export async function suspendUserAction(userId: string): Promise<ActionResult> {
  try {
    const result = await suspendUser({ userId });
    revalidatePath('/dashboard/users');
    revalidatePath('/dashboard/configs');

    if (result.failed.length > 0) {
      // Report both halves rather than claiming a clean suspension.
      return {
        ok: false,
        error: `${result.label} is suspended, but ${pluralise(result.failed.length, 'tunnel')} could not be stopped — the node may be offline. Retry from the configs page.`,
      };
    }
    return {
      ok: true,
      message:
        result.stopped > 0
          ? `${result.label} suspended and ${pluralise(result.stopped, 'tunnel')} stopped.`
          : `${result.label} suspended.`,
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function reactivateUserAction(userId: string): Promise<ActionResult> {
  try {
    const user = await reactivateUser({ userId });
    revalidatePath('/dashboard/users');
    return {
      ok: true,
      message: `${personLabel(user)} can sign in again. Their tunnels stay off until you re-enable them.`,
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

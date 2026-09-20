'use server';

import { revalidatePath } from 'next/cache';

import { errorMessage } from '@/features/error-message';
import { createEnrollmentToken } from '@/server/enrollment';
import { removeNode } from '@/server/nodes';

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };
export type TokenResult = { ok: true; token: string } | { ok: false; error: string };

export async function createEnrollmentTokenAction(formData: FormData): Promise<TokenResult> {
  const text = (key: string) => String(formData.get(key) ?? '').trim();
  try {
    const { token } = await createEnrollmentToken({
      name: text('name'),
      region: text('region'),
      provider: text('provider'),
      cidrPool: text('cidrPool'),
      dns: text('dns'),
    });
    revalidatePath('/dashboard/nodes');
    return { ok: true, token };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function removeNodeAction(nodeId: string): Promise<ActionResult> {
  try {
    const node = await removeNode({ nodeId });
    revalidatePath('/dashboard/nodes');
    return { ok: true, message: `${node.name} removed.` };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

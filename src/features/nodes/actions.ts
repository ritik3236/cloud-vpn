'use server';

import { revalidatePath } from 'next/cache';

import { errorMessage } from '@/features/error-message';
import { createNode, removeNode } from '@/server/nodes';

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function addNodeAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const text = (key: string) => String(formData.get(key) ?? '').trim();
  try {
    const node = await createNode({
      name: text('name'),
      region: text('region'),
      provider: text('provider'),
      endpoint: text('endpoint'),
      cidrPool: text('cidrPool'),
      dns: text('dns'),
      agentUrl: text('agentUrl'),
      agentToken: text('agentToken'),
      agentCert: text('agentCert'),
    });
    revalidatePath('/dashboard/nodes');
    return { ok: true, message: `${node.name} is online and ready to issue configs.` };
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

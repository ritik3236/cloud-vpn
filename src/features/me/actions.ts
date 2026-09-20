'use server';

import { errorMessage } from '@/features/error-message';
import { configQrSvg } from '@/server/qr';
import type { RetrieveResult } from '@/features/configs/actions';
import { getOwnConfigFile } from '@/server/me';

/** Self-service retrieval. Ownership is enforced in `getOwnConfigFile`, not here. */
export async function retrieveOwnConfigAction(configId: string): Promise<RetrieveResult> {
  try {
    const { filename, content } = await getOwnConfigFile(configId);
    const qrSvg = await configQrSvg(content);
    return { ok: true, filename, content, qrSvg };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

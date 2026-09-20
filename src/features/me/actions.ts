'use server';

import QRCode from 'qrcode';

import { errorMessage } from '@/features/error-message';
import type { RetrieveResult } from '@/features/configs/actions';
import { getOwnConfigFile } from '@/server/me';

/** Self-service retrieval. Ownership is enforced in `getOwnConfigFile`, not here. */
export async function retrieveOwnConfigAction(configId: string): Promise<RetrieveResult> {
  try {
    const { filename, content } = await getOwnConfigFile(configId);
    const qrSvg = await QRCode.toString(content, {
      type: 'svg',
      margin: 1,
      width: 240,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    return { ok: true, filename, content, qrSvg };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

import 'server-only';

import QRCode from 'qrcode';

/**
 * Fixed black on white, never theme tokens: a QR needs real contrast to scan, and one rendered
 * in a palette's muted foreground can fail on a phone camera. The explicit width matters too —
 * without it the SVG carries only a viewBox and renders at zero size.
 */
export const configQrSvg = (content: string) =>
  QRCode.toString(content, {
    type: 'svg',
    margin: 1,
    width: 240,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });

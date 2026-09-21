'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

const MIN_INTERVAL_MS = 5_000;

/**
 * People are created in Clerk, in another tab. Re-syncing when this tab comes back means the
 * admin returns to a list that already has them instead of one they have to reload.
 */
export function RefreshOnFocus() {
  const router = useRouter();

  React.useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < MIN_INTERVAL_MS) return;
      last = Date.now();
      router.refresh();
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [router]);

  return null;
}

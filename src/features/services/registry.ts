import { KeyRound, type LucideIcon } from 'lucide-react';

import type { Role } from '@/auth/roles';

/** The portal itself. Renaming happens here, not in a dozen headers. */
export const PORTAL = {
  name: 'BizDaddy Tech',
  tagline: 'Services we run in-house.',
};

export type Service = {
  id: string;
  name: string;
  blurb: string;
  icon: LucideIcon;
  /** Staff manage a service; everyone else uses it. Each service decides its own two doors. */
  entry: (role: Role | null) => string;
};

/**
 * Adding a service is an entry here plus its routes under `/<id>` — the hub, the headers and the
 * post-sign-in landing all read from this list, so none of them need touching.
 */
export const SERVICES: Service[] = [
  {
    id: 'vpn',
    name: 'Cloud VPN',
    blurb: 'WireGuard tunnels on our own nodes — issued, assigned and switched off from one place.',
    icon: KeyRound,
    entry: (role) => (role ? '/vpn/dashboard' : '/vpn/me'),
  },
];

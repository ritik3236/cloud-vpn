import { Eye, KeyRound, PowerOff, ScrollText, Server, Globe } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/design-system/ui/button';
import { PORTAL } from '@/features/services/registry';
import { ServiceGrid } from '@/features/services/service-grid';

/** Everything here is something the product actually does — no claim without an implementation. */
const FEATURES = [
  {
    icon: KeyRound,
    title: 'One key per device',
    body: 'Every device gets its own config and its own address. Revoke a laptop without disturbing a phone.',
  },
  {
    icon: Eye,
    title: 'See what is live',
    body: 'Connection state is read from the nodes themselves as the page loads, not guessed from a column in a database.',
  },
  {
    icon: PowerOff,
    title: 'Cut access in one click',
    body: 'Disabling pulls the peer off the node immediately. Re-enabling puts it back on the same address.',
  },
  {
    icon: ScrollText,
    title: 'Every key retrieval is logged',
    body: 'Private keys are encrypted before they are stored, only admins can read them, and each read lands in the audit log.',
  },
  {
    icon: Server,
    title: 'Your machines, your keys',
    body: 'Nodes run WireGuard wherever you put them. Enrolment is one command, and the node never phones home.',
  },
  {
    icon: Globe,
    title: 'Provider configs too',
    body: 'Store a Proton config beside the managed ones and hand it out the same way — labelled honestly, since we cannot see inside it.',
  },
];

const SAMPLE_CONF = `[Interface]
Address = 10.8.0.5/32
DNS = 1.1.1.1

[Peer]
Endpoint = 80.78.31.19:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25`;

export function Landing() {
  return (
    <main className="flex-1">
      <section className="mx-auto w-full max-w-5xl px-4 pt-16 pb-14 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Cloud VPN
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Private tunnels on machines you own.
            </h1>
            <p className="mt-4 max-w-prose text-base text-muted-foreground">
              Issue a WireGuard config per device, watch which ones are actually carrying traffic,
              and cut access the moment you need to. No per-seat pricing, and nobody else holding
              your keys.
            </p>
            <div className="mt-7 flex items-center gap-4">
              <Button asChild size="sm" className="h-9 px-4">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <a href="#what-you-get" className="text-sm text-muted-foreground hover:text-foreground">
                What you get
              </a>
            </div>
          </div>

          {/* The product's own output, rather than an illustration of it. */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">Phone</p>
                <p className="truncate text-xs text-muted-foreground">VPN-1 · Stockholm · 10.8.0.5</p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-tone-live">
                <span className="size-1.5 rounded-full bg-tone-live" aria-hidden />
                In use now
              </span>
            </div>
            <pre className="mt-3 overflow-x-auto font-mono text-[11px] leading-relaxed text-muted-foreground">
              {SAMPLE_CONF}
            </pre>
          </div>
        </div>
      </section>

      <section id="what-you-get" className="border-t border-border bg-muted/30">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            What you get
          </p>
          <div className="mt-6 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title}>
                <feature.icon className="size-5 text-muted-foreground" aria-hidden />
                <h2 className="mt-3 text-sm font-medium">{feature.title}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Services
          </p>
          <div className="mt-6">
            <ServiceGrid hrefFor={() => '/sign-in'} />
          </div>
          <p className="mt-8 max-w-prose text-sm text-muted-foreground">
            Accounts are created by an admin — there is no public sign-up. Once you are in, your
            configs sit on one page with a download and a QR code for each device.
          </p>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-6 text-xs text-muted-foreground sm:px-6">
          <span>{PORTAL.name}</span>
          <Link href="/sign-in" className="hover:text-foreground">
            Sign in
          </Link>
        </div>
      </footer>
    </main>
  );
}

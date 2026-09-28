import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import type { Service } from './registry';

export function ServiceCard({ service, href }: { service: Service; href: string }) {
  const Icon = service.icon;

  return (
    <Link
      href={href}
      className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Icon className="size-4" />
        </span>
        <h2 className="truncate text-sm font-medium">{service.name}</h2>
        <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{service.blurb}</p>
    </Link>
  );
}

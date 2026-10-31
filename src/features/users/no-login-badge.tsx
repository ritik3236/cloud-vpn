import { Badge } from '@/design-system/ui/badge';

/** Marks a person who was added without an account: they get their configs from an admin. */
export function NoLoginBadge() {
  return (
    <Badge
      variant="outline"
      className="h-5 px-1.5 text-[11px] text-muted-foreground"
      title="No login — an admin hands over their config files"
    >
      No login
    </Badge>
  );
}

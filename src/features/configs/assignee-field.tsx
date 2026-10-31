'use client';

import { UserPlus } from 'lucide-react';
import * as React from 'react';

import { Input } from '@/design-system/ui/input';
import { Label } from '@/design-system/ui/label';
import { Popover, PopoverAnchor, PopoverContent } from '@/design-system/ui/popover';

import type { Assignee } from './actions';
import type { AssignableUser } from './row-actions';

/** What the admin typed, and the person it was resolved to when they picked a suggestion. */
export type AssigneeChoice = { text: string; userId: string | null };

export const emptyChoice = (): AssigneeChoice => ({ text: '', userId: null });

const SUGGESTIONS = 6;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

type Resolved =
  | { kind: 'spare' }
  | { kind: 'existing'; userId: string; label: string }
  | { kind: 'new'; name: string };

/**
 * An exact name always means the person who already has it, picked or typed: typing "ahmed" must
 * never quietly create a second Ahmed beside the first.
 */
export function resolveChoice(choice: AssigneeChoice, users: AssignableUser[]): Resolved {
  const text = choice.text.trim();
  if (!text) return { kind: 'spare' };
  const picked = users.find((user) => user.id === choice.userId) ?? users.find((user) => same(user.label, text));
  return picked ? { kind: 'existing', userId: picked.id, label: picked.label } : { kind: 'new', name: text };
}

/** The assignee the server should get, or the first thing still missing. */
export function readChoice(
  choice: AssigneeChoice,
  users: AssignableUser[],
  allowSpare: boolean,
): { assignee?: Assignee; problem?: string } {
  const resolved = resolveChoice(choice, users);
  if (resolved.kind === 'spare') return allowSpare ? {} : { problem: 'Type who this config is for.' };
  if (resolved.kind === 'existing') return { assignee: { userId: resolved.userId } };
  return { assignee: { newPersonName: resolved.name } };
}

/** Who the submit button names, so the outcome is never a surprise; null while nobody is typed. */
export function choiceTarget(choice: AssigneeChoice, users: AssignableUser[]): string | null {
  const resolved = resolveChoice(choice, users);
  if (resolved.kind === 'existing') return resolved.label;
  if (resolved.kind === 'new') return `new person ${resolved.name}`;
  return null;
}

export function AssigneeField({
  id,
  users,
  value,
  onChange,
  allowSpare,
}: {
  id: string;
  users: AssignableUser[];
  value: AssigneeChoice;
  onChange: (value: AssigneeChoice) => void;
  /** Generating can leave a config unassigned; assigning an existing spare cannot. */
  allowSpare: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const listId = `${id}-suggestions`;

  const text = value.text.trim();
  const matches = users
    .filter((user) => !text || user.label.toLowerCase().includes(text.toLowerCase()))
    .slice(0, SUGGESTIONS);
  const exact = matches.some((user) => same(user.label, text));
  const options: ({ kind: 'existing'; user: AssignableUser } | { kind: 'new' })[] = [
    ...matches.map((user) => ({ kind: 'existing' as const, user })),
    ...(text && !exact ? [{ kind: 'new' as const }] : []),
  ];
  const resolved = resolveChoice(value, users);

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.kind === 'existing' ? { text: option.user.label, userId: option.user.id } : { text: value.text, userId: null });
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (options.length) setActive((current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (event.key === 'Enter' && open && options.length) {
      // Enter picks the highlighted suggestion rather than submitting the dialog under it.
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        Assign to
      </Label>
      <Popover open={open && options.length > 0} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <Input
            id={id}
            role="combobox"
            aria-expanded={open && options.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
            autoComplete="off"
            placeholder={allowSpare ? 'A name, or leave empty to keep it as a spare' : 'Type a name'}
            value={value.text}
            onChange={(event) => {
              onChange({ text: event.target.value, userId: null });
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            className="h-8 bg-background"
          />
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) p-1"
          // The list is a hint under the box, never a place for focus: typing must keep going.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <ul id={listId} role="listbox" aria-label="People">
            {options.map((option, index) => (
              <li
                key={option.kind === 'existing' ? option.user.id : 'new'}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                // mousedown, not click: a click would blur the box first and close the list.
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(index);
                }}
                onMouseEnter={() => setActive(index)}
                className={
                  'flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm' +
                  (index === active ? ' bg-accent text-accent-foreground' : '')
                }
              >
                {option.kind === 'existing' ? (
                  option.user.label
                ) : (
                  <>
                    <UserPlus className="size-4 text-muted-foreground" aria-hidden />
                    Add “{text}” (no login)
                  </>
                )}
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>

      <p className="text-xs text-muted-foreground">
        {resolved.kind === 'existing'
          ? 'The peer is added to the node as soon as you confirm — their tunnel works immediately.'
          : resolved.kind === 'new'
            ? `No one is called “${resolved.name}” yet: they will be added with no login — you hand them the file or QR, and they show on the Users page.`
            : allowSpare
              ? 'Left empty, the config waits as a spare: no peer on the node until someone holds it.'
              : 'Pick someone from the suggestions, or type a new name.'}
      </p>
    </div>
  );
}

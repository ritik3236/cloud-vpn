'use client';

import * as React from 'react';

import { Input } from '@/design-system/ui/input';
import { Label } from '@/design-system/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/design-system/ui/select';

import type { Assignee } from './actions';
import type { AssignableUser } from './row-actions';

/** Both stay inside this field: the server is told a person or a name, never a magic word. */
export const SPARE = 'spare';
const NEW_PERSON = 'new';

export type AssigneeChoice = { pick: string; newName: string };

export const emptyChoice = (pick = ''): AssigneeChoice => ({ pick, newName: '' });

/** The assignee the server should get, or the first thing still missing. */
export function readChoice(choice: AssigneeChoice): { assignee?: Assignee; problem?: string } {
  if (choice.pick === SPARE) return {};
  if (choice.pick === NEW_PERSON) {
    const name = choice.newName.trim();
    return name ? { assignee: { newPersonName: name } } : { problem: 'Type the new person’s name.' };
  }
  if (!choice.pick) return { problem: 'Choose who this config is for.' };
  return { assignee: { userId: choice.pick } };
}

export function isAssigning(choice: AssigneeChoice) {
  return choice.pick !== SPARE && choice.pick !== '';
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
  const creating = value.pick === NEW_PERSON;
  const nameRef = React.useRef<HTMLInputElement>(null);
  const justPickedNew = React.useRef(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        Assign to
      </Label>
      <Select
        value={value.pick}
        onValueChange={(pick) => {
          justPickedNew.current = pick === NEW_PERSON;
          onChange({ ...value, pick });
        }}
      >
        <SelectTrigger id={id} className="h-8 w-full bg-background">
          <SelectValue placeholder="Choose a person" />
        </SelectTrigger>
        <SelectContent
          // Closing hands focus back to the trigger, which would beat autoFocus on the name box.
          onCloseAutoFocus={(event) => {
            if (!justPickedNew.current) return;
            justPickedNew.current = false;
            event.preventDefault();
            nameRef.current?.focus();
          }}
        >
          {allowSpare ? <SelectItem value={SPARE}>Nobody yet — keep as a spare</SelectItem> : null}
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.label}
            </SelectItem>
          ))}
          {allowSpare || users.length > 0 ? <SelectSeparator /> : null}
          <SelectItem value={NEW_PERSON}>+ New person (no login)</SelectItem>
        </SelectContent>
      </Select>

      {creating ? (
        <Input
          ref={nameRef}
          aria-label="New person’s name"
          placeholder="Their name, e.g. Ahmed"
          value={value.newName}
          onChange={(event) => onChange({ ...value, newName: event.target.value })}
          className="h-8 bg-background"
        />
      ) : null}

      <p className="text-xs text-muted-foreground">
        {creating
          ? 'They get no login: you hand them the file or QR, and they show on the Users page so you can suspend them later.'
          : isAssigning(value)
            ? 'The peer is added to the node as soon as you confirm — their tunnel works immediately.'
            : allowSpare
              ? 'A spare is inert: no peer on the node until someone holds it.'
              : 'Pick someone listed, or add a person who needs no login.'}
      </p>
    </div>
  );
}

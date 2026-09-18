import { Button, GeographyTree } from '@fphd/ui';
import { type ReactNode, useState } from 'react';
import { Form } from 'react-router';
import { MAX_SELECTED_AREAS } from '../selection-limits.js';
import type { GeographyOptions } from './loader.js';

interface GeographySelection {
  areaCodes: string[];
  areaLevels: string[];
}

export function GeographyPicker({
  action,
  buttonClassName,
  children,
  displayGroups,
  geographyOptions,
  levelName,
  name,
  onApply,
  replace = false,
  selection,
}: {
  action: string;
  buttonClassName: string;
  children: ReactNode;
  displayGroups: string[];
  geographyOptions?: GeographyOptions | undefined;
  levelName: string;
  name: string;
  onApply: (selection: GeographySelection) => void;
  replace?: boolean;
  selection: GeographySelection;
}) {
  const [pending, setPending] = useState(selection);
  const before = [...selection.areaCodes, ...selection.areaLevels];
  const after = [...pending.areaCodes, ...pending.areaLevels];
  const added = after.filter((value) => !before.includes(value)).length;
  const removed = before.filter((value) => !after.includes(value)).length;
  const changes = added + removed;

  return (
    <Form action={action} method="get" replace={replace} preventScrollReset>
      {children}
      <GeographyTree
        fallback={geographyOptions}
        levelName={levelName}
        levels={displayGroups}
        maxAreaTicks={MAX_SELECTED_AREAS}
        name={name}
        onChange={(areaCodes) => setPending((current) => ({ ...current, areaCodes }))}
        onLevelsChange={(areaLevels) => setPending((current) => ({ ...current, areaLevels }))}
        selected={pending.areaCodes}
        selectedLevels={pending.areaLevels}
      />
      <Button
        className={buttonClassName}
        data-empty={changes === 0 ? '' : undefined}
        onClick={() => {
          if (changes === 0) return;
          onApply(pending);
        }}
        type={changes === 0 ? 'submit' : 'button'}
      >
        {removed > 0 ? 'Update' : 'Add'} selected geographies
        {changes > 0 ? ` (${changes})` : ''}
      </Button>
    </Form>
  );
}

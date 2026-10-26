import { Button, GeographyTree } from '@fphd/ui';
import { type ReactNode, useEffect, useState } from 'react';
import { Form } from 'react-router';
import { MAX_SELECTED_AREAS } from '../selection-limits.ts';
import type { GeographyOptions } from './loader.ts';

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
  lookupUrl,
  autoApply = false,
  searchLabel,
  searchHint,
  single = false,
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
  lookupUrl?: string | undefined;
  autoApply?: boolean;
  searchLabel?: string | undefined;
  searchHint?: string | undefined;
  single?: boolean;
}) {
  const [pending, setPending] = useState(selection);
  const { areaCodes, areaLevels } = selection;
  useEffect(() => setPending({ areaCodes, areaLevels }), [areaCodes, areaLevels]);
  const before = [...selection.areaCodes, ...selection.areaLevels];
  const after = [...pending.areaCodes, ...pending.areaLevels];
  const added = after.filter((value) => !before.includes(value)).length;
  const removed = before.filter((value) => !after.includes(value)).length;
  const changes = added + removed;

  return (
    <Form action={action} method="get" replace={replace} preventScrollReset>
      {children}
      <GeographyTree
        single={single}
        lookupUrl={lookupUrl}
        searchLabel={searchLabel}
        searchHint={searchHint}
        groupAsOne={autoApply}
        showLimitHint={!autoApply}
        fallback={geographyOptions}
        levelName={levelName}
        levels={displayGroups}
        maxAreaTicks={MAX_SELECTED_AREAS}
        name={name}
        onChange={(areaCodes) => {
          const next = { ...pending, areaCodes, ...(single ? { areaLevels: [] } : {}) };
          setPending(next);
          if (autoApply) onApply(next);
        }}
        onLevelsChange={(areaLevels) => {
          const next = { ...pending, areaLevels };
          setPending(next);
          if (autoApply) onApply(next);
        }}
        selected={pending.areaCodes}
        selectedLevels={pending.areaLevels}
      />
      {autoApply ? (
        <noscript>
          <Button type="submit">Apply geographies</Button>
        </noscript>
      ) : (
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
      )}
    </Form>
  );
}

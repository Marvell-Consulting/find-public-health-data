import { fieldInputId } from '@fphd/ui';
import { type ChangeEvent, useEffect, useState } from 'react';

/**
 * The value chosen in the select named `name`, for a page that reveals what follows from it.
 * A select cannot reveal anything without JavaScript, so until the page is hydrated every
 * follow-up shows, with a hint naming the choice it is for; after, only the chosen one's show.
 */
export function useSelectedValue<Field extends string>(name: Field, initial: string) {
  const [value, setValue] = useState(initial);
  const [enhanced, setEnhanced] = useState(false);

  useEffect(() => {
    // A choice made before hydration is in the select but not yet in state.
    const select = document.getElementById(fieldInputId(name));
    if (select instanceof HTMLSelectElement) setValue(select.value);
    setEnhanced(true);
  }, [name]);

  return {
    value,
    enhanced,
    onChange: (event: ChangeEvent<HTMLSelectElement>) => setValue(event.target.value),
    /** A follow-up's hint naming the choice it is for, shown only before hydration. */
    hint: (text: string): { hint?: string } => (enhanced ? {} : { hint: text }),
    /** Whether to hide a follow-up: once hydrated, unless the choice asks for it. */
    hides: (shown: boolean) => enhanced && !shown,
  };
}

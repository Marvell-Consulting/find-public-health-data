import { describe, expect, it } from 'vitest';

import { tidyName } from './tidy-name.ts';

describe('tidyName', () => {
  it.each([
    ['GP cluster shapes ', 'GP cluster shapes'],
    ['Ethnic groups  [152]', 'Ethnic groups [152]'],
    [
      'LSOA21 deprivation deciles within area (IMD trend)\n',
      'LSOA21 deprivation deciles within area (IMD trend)',
    ],
    [
      'Value for former Trust and \n\tRoyal Trust\tcombined',
      'Value for former Trust and Royal Trust combined',
    ],
    ['\u00a0Other\u202f \ufeff', 'Other'],
    ['Year\u00a0\u20033-6', 'Year 3-6'],
    ['Vertical\u000btab\u000b', 'Vertical tab'],
  ])('tidies %j to %j', (name, tidy) => {
    expect(tidyName(name)).toBe(tidy);
  });

  it.each(['Low birthweight (under 2,500g)', 'Next line\u0085kept', 'Separator\u001ckept'])(
    'leaves %j as it is',
    (name) => {
      expect(tidyName(name)).toBe(name);
    },
  );
});

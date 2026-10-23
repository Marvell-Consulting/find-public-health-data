import { expect, it } from 'vitest';
import { tableCsv } from './download.ts';

it('escapes formula-like text while retaining negative numeric cells', () => {
  expect(
    tableCsv([
      ['=SUM(1)', '+test', '-test', '@test', '\tformula', '\rformula'],
      [-2.5, 0, null, 'Plain text', 'with,comma', '"quoted"'],
    ]),
  ).toBe(
    '\'=SUM(1),\'+test,\'-test,\'@test,\'\tformula,\'\rformula\n-2.5,0,,Plain text,"with,comma","""quoted"""\n',
  );
});

import { describe, expect, it } from 'vitest';

import { extractImportSpecifiers } from './specifiers.js';

describe('extractImportSpecifiers', () => {
  it('extracts static, side-effect, dynamic and require specifiers', () => {
    const source = [
      "import { healthHandler } from '@fphd/api';",
      "import express from 'express';",
      "import './styles.css';",
      "const db = await import('./db.js');",
      "const legacy = require('node:fs');",
    ].join('\n');

    expect(extractImportSpecifiers(source)).toEqual([
      '@fphd/api',
      'express',
      './styles.css',
      './db.js',
      'node:fs',
    ]);
  });

  it('extracts compacted side-effect imports, several to a line', () => {
    const source = 'import"@fphd/internal-api";import"./styles.css";';

    expect(extractImportSpecifiers(source)).toEqual(['@fphd/internal-api', './styles.css']);
  });
});

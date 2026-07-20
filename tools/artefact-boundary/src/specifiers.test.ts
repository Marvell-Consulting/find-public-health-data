import { describe, expect, it } from 'vitest';

import { findInternalReferences } from './internal.js';
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

  it('catches a deliberate internal import in compiled API output', () => {
    const source = [
      "import { internalRoutes } from '@fphd/internal-api-features';",
      "import { secret } from '../../internal-api/src/secret.js';",
      "import express from 'express';",
    ].join('\n');

    expect(findInternalReferences(extractImportSpecifiers(source))).toEqual([
      '../../internal-api/src/secret.js',
      '@fphd/internal-api-features',
    ]);
  });
});

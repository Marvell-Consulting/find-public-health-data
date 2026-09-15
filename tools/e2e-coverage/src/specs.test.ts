import { describe, expect, it } from 'vitest';

import { findSpecsWithoutScan, findStaleEntries, findUncoveredRoutes } from './specs.js';

const mapping = {
  '/': 'home.spec.ts',
  '/topics/:slug': 'topic.spec.ts',
  '/manage/topics': 'manage-topics.spec.ts',
  '/manage/topics/new': 'manage-topics.spec.ts',
};
const page = (path: string) => ({ path, page: true });
const resource = (path: string) => ({ path, page: false });

describe('findUncoveredRoutes', () => {
  it('passes page routes whose mapped spec exists and ignores resource routes', () => {
    expect(
      findUncoveredRoutes(
        [page('/'), page('/topics/:slug'), resource('/geographies')],
        ['home.spec.ts', 'topic.spec.ts'],
        mapping,
      ),
    ).toEqual([]);
  });

  it('names a page route no spec is mapped to', () => {
    expect(findUncoveredRoutes([page('/dashboard')], ['home.spec.ts'], mapping)).toEqual([
      { route: '/dashboard', problem: 'is mapped to no spec' },
    ]);
  });

  it('names a page route whose mapped spec does not exist', () => {
    expect(findUncoveredRoutes([page('/topics/:slug')], ['home.spec.ts'], mapping)).toEqual([
      { route: '/topics/:slug', problem: 'is mapped to topic.spec.ts, which does not exist' },
    ]);
  });

  it('requires the spec a resource route is mapped to, since it exempts that spec from scanning', () => {
    expect(findUncoveredRoutes([resource('/')], ['topic.spec.ts'], mapping)).toEqual([
      { route: '/', problem: 'is mapped to home.spec.ts, which does not exist' },
    ]);
  });

  it('lets several routes share one spec', () => {
    expect(
      findUncoveredRoutes(
        [page('/manage/topics'), page('/manage/topics/new')],
        ['manage-topics.spec.ts'],
        mapping,
      ),
    ).toEqual([]);
  });
});

describe('findStaleEntries', () => {
  it('names mapped routes no app declares', () => {
    expect(findStaleEntries(['/', '/topics/:slug'], mapping)).toEqual([
      '/manage/topics',
      '/manage/topics/new',
    ]);
  });

  it('is empty when every entry is declared', () => {
    expect(findStaleEntries(Object.keys(mapping), mapping)).toEqual([]);
  });
});

describe('findSpecsWithoutScan', () => {
  const scanned = {
    name: 'home.spec.ts',
    source: 'await expectNoAccessibilityViolations(page, testInfo);',
  };
  const unscanned = { name: 'home.spec.ts', source: "test('redirects', async () => {});" };

  it('names a spec that never calls the scan, even one that only mentions it', () => {
    expect(
      findSpecsWithoutScan(
        [
          scanned,
          {
            name: 'imported.spec.ts',
            source:
              "import { expectNoAccessibilityViolations } from '../support/accessibility.js';",
          },
          {
            name: 'commented.spec.ts',
            source: '// expectNoAccessibilityViolations(page, testInfo)',
          },
          { name: 'bare.spec.ts', source: "test('renders', async () => {});" },
        ],
        [page('/')],
        mapping,
      ),
    ).toEqual(['imported.spec.ts', 'commented.spec.ts', 'bare.spec.ts']);
  });

  it('exempts a spec only resource routes map to', () => {
    expect(findSpecsWithoutScan([unscanned], [resource('/')], mapping)).toEqual([]);
  });

  it('holds a spec to the scan when any page route maps to it', () => {
    expect(findSpecsWithoutScan([unscanned], [resource('/'), page('/')], mapping)).toEqual([
      'home.spec.ts',
    ]);
  });

  it('holds a spec nothing maps to, since it drives some page state', () => {
    expect(findSpecsWithoutScan([{ ...unscanned, name: 'extra.spec.ts' }], [], mapping)).toEqual([
      'extra.spec.ts',
    ]);
  });
});

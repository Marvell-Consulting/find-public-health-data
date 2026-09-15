import { describe, expect, it } from 'vitest';

import { findSpecsWithoutScan, findStaleEntries, findUncoveredRoutes } from './specs.js';

const mapping = {
  '/': 'home.spec.ts',
  '/topics/:slug': 'topic.spec.ts',
  '/manage/topics': 'manage-topics.spec.ts',
  '/manage/topics/new': 'manage-topics.spec.ts',
};
const resources = ['/geographies'];

describe('findUncoveredRoutes', () => {
  it('passes routes whose mapped spec exists and resource routes', () => {
    expect(
      findUncoveredRoutes(
        ['/', '/topics/:slug', '/geographies'],
        ['home.spec.ts', 'topic.spec.ts'],
        mapping,
        resources,
      ),
    ).toEqual([]);
  });

  it('names a route no spec is mapped to', () => {
    expect(findUncoveredRoutes(['/dashboard'], ['home.spec.ts'], mapping, resources)).toEqual([
      { route: '/dashboard', problem: 'is mapped to no spec and is not a resource route' },
    ]);
  });

  it('names a route whose mapped spec does not exist', () => {
    expect(findUncoveredRoutes(['/topics/:slug'], ['home.spec.ts'], mapping, resources)).toEqual([
      { route: '/topics/:slug', problem: 'is mapped to topic.spec.ts, which does not exist' },
    ]);
  });

  it('lets several routes share one spec', () => {
    expect(
      findUncoveredRoutes(
        ['/manage/topics', '/manage/topics/new'],
        ['manage-topics.spec.ts'],
        mapping,
        resources,
      ),
    ).toEqual([]);
  });
});

describe('findStaleEntries', () => {
  it('names mapped and resource routes no app declares', () => {
    expect(findStaleEntries(['/', '/topics/:slug'], mapping, resources)).toEqual([
      '/manage/topics',
      '/manage/topics/new',
      '/geographies',
    ]);
  });

  it('is empty when every entry is declared', () => {
    expect(findStaleEntries([...Object.keys(mapping), ...resources], mapping, resources)).toEqual(
      [],
    );
  });
});

describe('findSpecsWithoutScan', () => {
  it('names a spec that never calls the scan, even one that imports it', () => {
    expect(
      findSpecsWithoutScan([
        {
          name: 'scanned.spec.ts',
          source: 'await expectNoAccessibilityViolations(page, testInfo);',
        },
        {
          name: 'imported.spec.ts',
          source: "import { expectNoAccessibilityViolations } from '../support/accessibility.js';",
        },
        { name: 'bare.spec.ts', source: "test('renders', async () => {});" },
      ]),
    ).toEqual(['imported.spec.ts', 'bare.spec.ts']);
  });
});

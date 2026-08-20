import type { AreaGroup } from './indicator-loader';

/**
 * The prototype's geography levels, in its fixed display order. Pholio stores area types
 * by boundary-revision status ("County unchanged", "UA new 2023"); the prototype groups
 * them into plain-English levels, so the raw names must never reach the screen.
 */
const DISPLAY_GROUPS: { label: string; areaTypes: string[] }[] = [
  {
    label: 'Local authorities',
    areaTypes: [
      'County unchanged',
      'LA unchanged',
      'UA unchanged',
      'UA new 2020',
      'UA new 2021',
      'UA new 2023',
    ],
  },
  { label: 'Statistical regions', areaTypes: ['Regions (statistical)'] },
  { label: 'NHS regions', areaTypes: ['NHS regions'] },
  { label: 'Integrated care boards', areaTypes: ['ICBs'] },
  { label: 'Middle-layer super output areas', areaTypes: ['MSOA'] },
  { label: 'GP practices', areaTypes: ['GPs'] },
];

// England is the default selected area, so the prototype never offers it in the tree.
const EXCLUDED = new Set(['England']);

/** The display level names, for validating `als` query values. */
export const DISPLAY_LEVEL_NAMES = DISPLAY_GROUPS.map(({ label }) => label);

/** The Pholio area types behind one display level, for expanding a level selection. */
export function levelAreaTypes(level: string): string[] {
  return DISPLAY_GROUPS.find(({ label }) => label === level)?.areaTypes ?? [];
}

export interface DisplayGeographyGroup {
  name: string;
  areas: { code: string; name: string }[];
}

/**
 * Pholio area names carry their level as a suffix ("East Midlands region (statistical)",
 * "NHS Dorset Integrated Care Board - QVV"); the prototype shows the bare place name and
 * lets the level heading carry that context.
 */
export function cleanAreaName(name: string): string {
  return name
    .replace(/ region \(statistical\)$/, '')
    .replace(/ NHS Region$/, '')
    .replace(/^NHS (.+) Integrated Care Board - \w+$/, '$1')
    .replace(/ UA$/, '');
}

export function displayGeographyGroups(areaGroups: AreaGroup[]): DisplayGeographyGroup[] {
  const byLabel = new Map<string, { code: string; name: string }[]>();
  const unmapped: DisplayGeographyGroup[] = [];

  for (const { areaType, areas } of areaGroups) {
    if (EXCLUDED.has(areaType)) {
      continue;
    }
    const display = DISPLAY_GROUPS.find(({ areaTypes }) => areaTypes.includes(areaType));
    if (!display) {
      unmapped.push({ name: areaType, areas });
      continue;
    }
    const existing = byLabel.get(display.label) ?? [];
    byLabel.set(display.label, [
      ...existing,
      ...areas.map(({ code, name }) => ({ code, name: cleanAreaName(name) })),
    ]);
  }

  const mapped = DISPLAY_GROUPS.flatMap(({ label }) => {
    const areas = byLabel.get(label);
    return areas
      ? [{ name: label, areas: [...areas].sort((a, b) => a.name.localeCompare(b.name)) }]
      : [];
  });
  return [...mapped, ...unmapped];
}

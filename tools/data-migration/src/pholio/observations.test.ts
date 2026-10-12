import { describe, expect, it } from 'vitest';

import {
  COMPOUND_AGE_IDS,
  compoundAgeDimensionValueIds,
  computeCiPair,
  computeDenominator2,
  dedupKey,
  nullIfSentinel,
} from './observations.ts';

describe('nullIfSentinel', () => {
  it('returns null for -1', () => expect(nullIfSentinel(-1)).toBeNull());
  it('returns null for null input', () => expect(nullIfSentinel(null)).toBeNull());
  it('passes through 0', () => expect(nullIfSentinel(0)).toBe(0));
  it('passes through positive number', () => expect(nullIfSentinel(42.5)).toBe(42.5));
  it('passes through negative numbers other than -1', () => expect(nullIfSentinel(-2)).toBe(-2));
});

describe('computeDenominator2', () => {
  it('returns null when same as denominator (no distinct value)', () =>
    expect(computeDenominator2(100, 100)).toBeNull());
  it('returns null when null input', () => expect(computeDenominator2(null, 100)).toBeNull());
  it('returns null when denominator_2 is sentinel -1 and differs from denominator', () =>
    expect(computeDenominator2(-1, 100)).toBeNull());
  it('returns value when different from denominator', () =>
    expect(computeDenominator2(200, 100)).toBe(200));
  it('both -1: same value → null', () => expect(computeDenominator2(-1, -1)).toBeNull());
});

describe('computeCiPair', () => {
  it('value=-1 nulls both CIs', () => {
    expect(computeCiPair(-1, 1.0, 2.0)).toEqual({ lower: null, upper: null });
  });
  it('value=-1 nulls even when CIs are valid numbers', () => {
    expect(computeCiPair(-1, 0.5, 0.8)).toEqual({ lower: null, upper: null });
  });
  it('value present, normal order → NULLIF each', () => {
    expect(computeCiPair(5.0, 4.0, 6.0)).toEqual({ lower: 4.0, upper: 6.0 });
  });
  it('value present, inverted (lower > upper): swap', () => {
    expect(computeCiPair(5.0, 6.0, 4.0)).toEqual({ lower: 4.0, upper: 6.0 });
  });
  it('value present, lower is sentinel -1: no swap, lower → null', () => {
    expect(computeCiPair(5.0, -1, 6.0)).toEqual({ lower: null, upper: 6.0 });
  });
  it('value present, upper is sentinel -1: no swap, upper → null', () => {
    expect(computeCiPair(5.0, 4.0, -1)).toEqual({ lower: 4.0, upper: null });
  });
  it('both sentinels -1: both → null, no swap', () => {
    expect(computeCiPair(5.0, -1, -1)).toEqual({ lower: null, upper: null });
  });
  it('inverted but one is -1: no swap (condition requires both != -1)', () => {
    // lower=6 > upper=-1, but upper==-1 so condition false → no swap
    expect(computeCiPair(5.0, 6.0, -1)).toEqual({ lower: 6.0, upper: null });
  });
  it('null inputs treated as -1', () => {
    expect(computeCiPair(5.0, null, null)).toEqual({ lower: null, upper: null });
  });
});

describe('COMPOUND_AGE_IDS', () => {
  it('contains 209, 212, 274', () => {
    expect(COMPOUND_AGE_IDS.has(209)).toBe(true);
    expect(COMPOUND_AGE_IDS.has(212)).toBe(true);
    expect(COMPOUND_AGE_IDS.has(274)).toBe(true);
  });
  it('does not contain other AgeIDs', () => {
    expect(COMPOUND_AGE_IDS.has(1)).toBe(false);
    expect(COMPOUND_AGE_IDS.has(303)).toBe(false);
  });
});

describe('compoundAgeDimensionValueIds', () => {
  it('AgeID 209 male and female use different ids', () => {
    const { maleDvId, femaleDvId } = compoundAgeDimensionValueIds(209);
    expect(maleDvId).not.toBe(femaleDvId);
  });
  it('AgeID 212 male and female use different ids', () => {
    const { maleDvId, femaleDvId } = compoundAgeDimensionValueIds(212);
    expect(maleDvId).not.toBe(femaleDvId);
  });
  it('AgeID 274 male reuses AgeID 209 male (intentional design)', () => {
    const { maleDvId: male274 } = compoundAgeDimensionValueIds(274);
    const { maleDvId: male209 } = compoundAgeDimensionValueIds(209);
    expect(male274).toBe(male209);
  });
  it('AgeID 274 female differs from AgeID 209 female', () => {
    const { femaleDvId: female274 } = compoundAgeDimensionValueIds(274);
    const { femaleDvId: female209 } = compoundAgeDimensionValueIds(209);
    expect(female274).not.toBe(female209);
  });
  it('throws for unknown AgeID', () => {
    expect(() => compoundAgeDimensionValueIds(1)).toThrow('AgeID 1 is not a compound age');
  });
  it('all ids are safe integers', () => {
    for (const ageId of [209, 212, 274]) {
      const { maleDvId, femaleDvId } = compoundAgeDimensionValueIds(ageId);
      expect(Number.isSafeInteger(maleDvId)).toBe(true);
      expect(Number.isSafeInteger(femaleDvId)).toBe(true);
    }
  });
});

describe('dedupKey', () => {
  it('produces the same key for identical inputs', () => {
    const k1 = dedupKey(108, 1234, '2020-04-01', '2021-03-31', 108, []);
    const k2 = dedupKey(108, 1234, '2020-04-01', '2021-03-31', 108, []);
    expect(k1).toBe(k2);
  });
  it('differs by indicatorId', () => {
    const k1 = dedupKey(108, 1234, '2020-04-01', '2021-03-31', 108, []);
    const k2 = dedupKey(109, 1234, '2020-04-01', '2021-03-31', 109, []);
    expect(k1).not.toBe(k2);
  });
  it('differs by areaId', () => {
    const k1 = dedupKey(108, 1234, '2020-04-01', '2021-03-31', 108, []);
    const k2 = dedupKey(108, 9999, '2020-04-01', '2021-03-31', 108, []);
    expect(k1).not.toBe(k2);
  });
  it('sortedDimValueIds encoded as comma-joined', () => {
    const k = dedupKey(1, 1, '2020-01-01', '2020-12-31', 1, [100, 200, 300]);
    expect(k.endsWith('|100,200,300')).toBe(true);
  });
  it('empty dims encoded as empty suffix', () => {
    const k = dedupKey(1, 1, '2020-01-01', '2020-12-31', 1, []);
    expect(k.endsWith('|')).toBe(true);
  });
});

describe('dedup across non-contiguous uid ranges', () => {
  // Simulates the two-pass dedup logic for an indicator whose rows are non-contiguous in uid
  // order (e.g. because incremental loads added new rows for an old indicator at higher uids).
  //
  // Indicator A has rows at uid 1, 2, then uid 5 (non-contiguous, interleaved with indicator B
  // at uid 3, 4). Row at uid 2 is a duplicate of uid 1 for indicator A. Row at uid 5 is another
  // duplicate. Pass 1 streams ORDER BY IndicatorID, uid so sees all of A's rows together.
  it('detects duplicates within an indicator even when uids are non-contiguous', () => {
    // Simulate the per-indicator pass (ORDER BY IndicatorID, uid) dedup logic.
    // We directly test the Set<string> + indicator-boundary clear pattern from buildDeletedObsIds.
    const seen = new Set<string>();
    const deleted = new Set<number>(); // using plain number here for test simplicity

    // Helper mimicking checkAndMark from buildDeletedObsIds
    const checkAndMark = (indId: number, areaId: number, fromDate: string, obsId: number) => {
      const dk = dedupKey(indId, areaId, fromDate, fromDate, indId, []);
      if (seen.has(dk)) {
        deleted.add(obsId);
      } else {
        seen.add(dk);
      }
    };

    // Pass 1: process in ORDER BY IndicatorID, uid order
    // Indicator A (id=1): uids 1, 2 (dup of 1), then later uid 5 (dup of 1)
    // Indicator B (id=2): uids 3, 4 (non-overlapping with A)
    // In uid order: 1(A), 2(A dup), 3(B), 4(B), 5(A dup)
    // In IndicatorID,uid order: 1(A), 2(A dup), 5(A dup), 3(B), 4(B)

    // Indicator A rows (grouped together in pass 1)
    let currentInd: number | undefined;
    const processRow = (indId: number, uid: number, area = 1, fromDate = '2020-01-01') => {
      if (indId !== currentInd) {
        seen.clear();
        currentInd = indId;
      }
      checkAndMark(indId, area, fromDate, uid);
    };

    processRow(1, 1); // A uid=1: first, not dup
    processRow(1, 2); // A uid=2: same key as uid=1 → dup
    processRow(1, 5); // A uid=5: same key as uid=1 → dup (non-contiguous!)
    processRow(2, 3, 10); // B uid=3: first, area=10, not dup
    processRow(2, 4, 20); // B uid=4: area=20 → different key, not dup

    expect(deleted.has(1)).toBe(false); // uid=1 is the keeper
    expect(deleted.has(2)).toBe(true); // uid=2 is a dup
    expect(deleted.has(5)).toBe(true); // uid=5 is a dup — would be MISSED by the old contiguity approach
    expect(deleted.has(3)).toBe(false); // B uid=3 is the keeper (different area)
    expect(deleted.has(4)).toBe(false); // B uid=4 is not a dup (different area from uid=3)
  });

  it('old contiguity approach would miss a non-contiguous duplicate', () => {
    // Proves the old approach (clear-on-indicator-change in uid order) fails for non-contiguous uids.
    const seen = new Set<string>();
    const deleted = new Set<number>();
    let currentInd: number | undefined;

    const processOldApproach = (indId: number, uid: number, fromDate = '2020-01-01') => {
      // Old approach: clear on indicator change IN UID ORDER
      if (indId !== currentInd) {
        seen.clear();
        currentInd = indId;
      }
      const dk = dedupKey(indId, 1, fromDate, fromDate, indId, []);
      if (seen.has(dk)) {
        deleted.add(uid);
      } else {
        seen.add(dk);
      }
    };

    // In uid order: 1(A), 2(A dup), 3(B), 4(B), 5(A dup — but seen is cleared when B started)
    processOldApproach(1, 1);
    processOldApproach(1, 2); // correctly caught
    processOldApproach(2, 3); // switches to B, clears seen
    processOldApproach(2, 4);
    processOldApproach(1, 5); // switches back to A, clears seen → misses the dup!

    expect(deleted.has(2)).toBe(true); // correctly detected
    expect(deleted.has(5)).toBe(false); // BUG: missed because seen was cleared when B was processed
  });
});

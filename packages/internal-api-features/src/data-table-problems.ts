import {
  DATA_TABLE_PROBLEM_CODES,
  DATA_TABLE_PROBLEM_ITEMS,
  type DataTableProblem,
  type DataTableProblemCode,
} from './data-upload-contract.ts';

/** One finding: the problem, and the row number, heading or value it was found at, if any. */
export interface DataTableFinding {
  code: DataTableProblemCode;
  item?: string;
}

export interface ProblemTally {
  add(finding: DataTableFinding): void;
  /** Each problem found, in the order the problems page lists them. */
  problems(): DataTableProblem[];
}

/**
 * Counts every finding but keeps only the first few distinct items of each problem, so a file
 * wrong on every row costs no more memory than one wrong on ten.
 */
export function createProblemTally(): ProblemTally {
  const found = new Map<DataTableProblemCode, { items: Set<string>; count: number }>();

  return {
    add({ code, item }) {
      const entry = found.get(code) ?? { items: new Set<string>(), count: 0 };
      if (item !== undefined && entry.items.size < DATA_TABLE_PROBLEM_ITEMS) entry.items.add(item);
      found.set(code, { items: entry.items, count: entry.count + 1 });
    },

    problems() {
      return DATA_TABLE_PROBLEM_CODES.flatMap((code) => {
        const entry = found.get(code);
        return entry === undefined ? [] : [{ code, items: [...entry.items], count: entry.count }];
      });
    },
  };
}

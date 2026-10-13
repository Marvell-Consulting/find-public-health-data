/** Whole milliseconds each stage of an upload took, for its log line; a stage not reached is absent. */
export interface UploadTimings {
  receiveMs?: number;
  lockWaitMs?: number;
  stageMs?: number;
  duplicatesMs?: number;
  insertMs?: number;
  observationMs?: number;
  dimensionMs?: number;
  noteMs?: number;
  deleteEarlierMs?: number;
  commitMs?: number;
  totalMs?: number;
}

/** Whole milliseconds since `start`, a `performance.now()` reading. */
export function elapsedMs(start: number): number {
  return Math.round(performance.now() - start);
}

/** Runs one step, answering its result with the whole milliseconds it took. */
export async function timed<T>(step: () => Promise<T>): Promise<[T, number]> {
  const start = performance.now();
  const result = await step();
  return [result, elapsedMs(start)];
}

/** An upload that failed part way, carrying the timings of the stages it reached. */
export class TimedUploadError extends Error {
  readonly timings: UploadTimings;

  constructor(timings: UploadTimings, cause: unknown) {
    super('The upload failed part way', { cause });
    this.name = 'TimedUploadError';
    this.timings = timings;
  }
}

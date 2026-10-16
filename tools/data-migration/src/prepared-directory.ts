import { lstat, mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

/** Existing paths, including symlink aliases of inputs, cannot become prepared output. */
export async function writePreparedDirectory(
  directory: string,
  write: (staged: string) => Promise<void>,
): Promise<void> {
  const output = resolve(directory);
  try {
    await lstat(output);
    throw new Error(`Prepared output already exists: ${output}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await mkdir(dirname(output), { recursive: true });
  const staged = await mkdtemp(join(dirname(output), `.${basename(output)}-`));
  try {
    await write(staged);
    await rename(staged, output);
  } finally {
    await rm(staged, { recursive: true, force: true });
  }
}

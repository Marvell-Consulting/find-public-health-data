import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { generateDemoTopics } from './demo-topics.ts';

let directory: string;
afterEach(async () => {
  vi.unstubAllGlobals();
  if (directory) await rm(directory, { recursive: true, force: true });
});
it('names a mapped topic missing from the topics file before writing JSON', async () => {
  directory = await mkdtemp(join(tmpdir(), 'demo-topics-'));
  const topics = join(directory, 'topics.json');
  const links = join(directory, 'links.json');
  await writeFile(topics, '[]');
  await writeFile(links, '{"indicatorTopics":[]}');
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ Id: 18, GroupMetadata: [{ Id: 1, Name: 'Example' }] }])),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ IndicatorId: 108, IndicatorName: 'Example indicator', GroupId: 1 }]),
        ),
      ),
  );
  await expect(generateDemoTopics(topics, links, join(directory, 'output.json'))).rejects.toThrow(
    'Unknown demo topic slug: smoking-and-tobacco',
  );
});

import { createArchive } from './archive.ts';
import { generateDemoTopics } from './demo-topics.ts';
import { createIncremental } from './diff.ts';
import { exportDevSnapshot } from './export-dev-snapshot.ts';
import { parseIndicatorIds } from './indicator-checks.ts';
import { exportLegacySeed } from './legacy-seed.ts';
import { exportPholio } from './pholio/export-pholio.ts';
import { prepareBaseline } from './prepare-baseline.ts';
import { importPrototypeSeed } from './prototype-seed.ts';

function argumentsFor(argv: readonly string[]): { command: string; values: Map<string, string> } {
  const [command = '', ...rest] = argv;
  const values = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 2) {
    const name = rest[index];
    const value = rest[index + 1];
    if (!name?.startsWith('--') || value === undefined)
      throw new Error(`Invalid argument: ${name ?? ''}`);
    values.set(name.slice(2), value);
  }
  return { command, values };
}

function required(values: Map<string, string>, name: string): string {
  const value = values.get(name);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function main(argv: readonly string[]): Promise<void> {
  const { command, values } = argumentsFor(argv);
  switch (command) {
    case 'export-pholio': {
      const rawExcluded = values.get('excluded-indicators');
      await exportPholio({
        connectionString: requiredEnvironment('PHOLIO_CONNECTION_STRING'),
        outDir: required(values, 'out-dir'),
        expectedDatabase: required(values, 'expected-database'),
        excludedIndicators: rawExcluded ? parseIndicatorIds(rawExcluded) : [],
      });
      return;
    }
    case 'prepare-baseline':
      await prepareBaseline(
        required(values, 'directory'),
        required(values, 'migration-id'),
        required(values, 'relationships'),
      );
      return;
    case 'create-incremental':
      await createIncremental(
        required(values, 'previous'),
        required(values, 'current'),
        required(values, 'out-dir'),
        required(values, 'migration-id'),
      );
      return;
    case 'archive':
      await createArchive(required(values, 'directory'), required(values, 'output'));
      return;
    case 'generate-demo-topics':
      await generateDemoTopics(
        required(values, 'topics'),
        required(values, 'existing-links'),
        required(values, 'output'),
      );
      return;
    case 'export-legacy-seed':
      await exportLegacySeed(
        requiredEnvironment('MSSQL_CONNECTION_STRING'),
        required(values, 'out-dir'),
      );
      return;
    case 'import-prototype-seed':
      await importPrototypeSeed({
        databaseUrl: requiredEnvironment('SOURCE_DATABASE_URL'),
        dataCsv: required(values, 'data-csv'),
        metadataJson: required(values, 'metadata-json'),
        areaTypesJson: required(values, 'area-types-json'),
        areaDirectory: required(values, 'area-dir'),
        seedDirectory: required(values, 'seed-dir'),
        outDirectory: required(values, 'out-dir'),
      });
      return;
    case 'export-dev-snapshot':
      await exportDevSnapshot({
        connectionString: requiredEnvironment('PHOLIO_CONNECTION_STRING'),
        outDir: required(values, 'out-dir'),
      });
      return;
    default:
      throw new Error(
        'Usage: data-migration <export-pholio|prepare-baseline|create-incremental|archive|generate-demo-topics|export-legacy-seed|import-prototype-seed|export-dev-snapshot> --option value',
      );
  }
}

await main(process.argv.slice(2));

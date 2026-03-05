import { assertOrUpdateBaseline, writeLatestArtifact } from './utils';

const updateBaseline = process.argv.includes('--update-baseline');

const ensureCharacterizationProcessEnv = () => {
  if (!process.env.API_URL) {
    process.env.API_URL = 'http://localhost:3333';
  }

  if (!process.env.DISCORD_TOKEN) {
    process.env.DISCORD_TOKEN = 'characterization-discord-token';
  }

  if (!process.env.DISCORD_CLIENT_ID) {
    process.env.DISCORD_CLIENT_ID = 'characterization-client-id';
  }

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'file:./sqlite.db';
  }
};

const loadSuites = async () => {
  const { runRestRouteDomainsCharacterization } = await import('./restRouteDomains.characterization');
  const { runRestOverlayPairConsumeCharacterization } = await import('./restOverlayPairConsume.characterization');
  const { runOverlayAuthCharacterization } = await import('./overlayAuth.characterization');
  const { runAdminIngestClientValidationCharacterization } = await import(
    './adminIngestClientValidation.characterization'
  );
  const { runSocketLifecycleCharacterization } = await import('./socketLifecycle.characterization');
  const { runDiscordExecutionCharacterization } = await import('./discordExecution.characterization');
  const { runDiscordRegistrationCharacterization } = await import('./discordRegistration.characterization');
  const { runMediaLifecycleCharacterization } = await import('./mediaLifecycle.characterization');
  const { runErrorHandlingCharacterization } = await import('./errorHandling.characterization');
  const { runEnvParsingCharacterization } = await import('./envParsing.characterization');

  return [
    {
      name: 'rest-route-domains',
      run: runRestRouteDomainsCharacterization,
    },
    {
      name: 'rest-overlay-pair-consume',
      run: runRestOverlayPairConsumeCharacterization,
    },
    {
      name: 'overlay-auth',
      run: runOverlayAuthCharacterization,
    },
    {
      name: 'admin-ingest-client-validation',
      run: runAdminIngestClientValidationCharacterization,
    },
    {
      name: 'socket-lifecycle',
      run: runSocketLifecycleCharacterization,
    },
    {
      name: 'discord-execution-flow',
      run: runDiscordExecutionCharacterization,
    },
    {
      name: 'discord-registration',
      run: runDiscordRegistrationCharacterization,
    },
    {
      name: 'media-lifecycle',
      run: runMediaLifecycleCharacterization,
    },
    {
      name: 'error-handling',
      run: runErrorHandlingCharacterization,
    },
    {
      name: 'env-parsing',
      run: runEnvParsingCharacterization,
    },
  ];
};

const run = async () => {
  ensureCharacterizationProcessEnv();

  const suites = await loadSuites();
  const results: Array<{ name: string; passed: boolean }> = [];

  for (const suite of suites) {
    const artifact = await suite.run();

    await writeLatestArtifact(suite.name, artifact);
    await assertOrUpdateBaseline({
      suiteName: suite.name,
      artifact,
      updateBaseline,
    });

    results.push({
      name: suite.name,
      passed: true,
    });
  }

  const summary = results.map((result) => `${result.name}: ${result.passed ? 'PASS' : 'FAIL'}`).join('\n');

  process.stdout.write(`${summary}\n`);
};

void run().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

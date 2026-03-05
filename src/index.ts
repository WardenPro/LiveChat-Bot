import 'dotenv/config';
import { runServer } from './server';

interface EnvironmentValidationErrorLike {
  invalidKeys: string[];
}

const isEnvironmentValidationErrorLike = (error: unknown): error is EnvironmentValidationErrorLike => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const invalidKeys = (error as { invalidKeys?: unknown }).invalidKeys;
  return Array.isArray(invalidKeys) && invalidKeys.every((value) => typeof value === 'string');
};

const logBootError = (message: string, error: unknown) => {
  if (global.logger) {
    logger.fatal({ err: error }, message);
    return;
  }

  // eslint-disable-next-line no-console
  console.error(message, error);
};

process.on('unhandledRejection', (reason) => {
  logBootError('[BOOT] Unhandled rejection', reason);
});

process.on('uncaughtException', (error) => {
  logBootError('[BOOT] Uncaught exception', error);
  process.exit(1);
});

const bootstrap = async () => {
  const { env } = await import('./services/env');

  global.env = env;
  // TODO(@livechat-maintainers, LC-TS-009): Replace global env reassignment with
  // a typed bootstrap config container and remove this compatibility exception.
  // @ts-expect-error env schema includes non-string values by design.
  process.env = env;

  const port: number = env.PORT ? env.PORT : 3000;

  const fastify = await runServer();

  await fastify.listen({
    port,
    host: '::',
    listenTextResolver: (address) => `[SERVER] Listening on ${address}`,
  });
};

void bootstrap().catch((error) => {
  if (isEnvironmentValidationErrorLike(error)) {
    const invalidKeysSuffix = error.invalidKeys.length > 0 ? `: ${error.invalidKeys.join(', ')}` : '';
    logBootError(`[BOOT] Invalid environment configuration${invalidKeysSuffix}`, error);
  } else {
    logBootError('[BOOT] Startup failed', error);
  }

  process.exit(1);
});

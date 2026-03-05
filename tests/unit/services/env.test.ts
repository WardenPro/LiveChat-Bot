import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRuntimeEnv } from './env/runtimeEnvFixture';

const importEnvModule = async (overrides: NodeJS.ProcessEnv = {}) => {
  const previousEnv = process.env;
  process.env = createRuntimeEnv(overrides);
  vi.resetModules();

  try {
    return await import('../../../src/services/env');
  } finally {
    process.env = previousEnv;
  }
};

afterEach(() => {
  vi.resetModules();
});

describe('services/env', () => {
  it('parses runtime config with defaults through loadEnv', async () => {
    const envModule = await importEnvModule();

    const parsed = envModule.loadEnv(createRuntimeEnv());
    expect(parsed.PORT).toBe(3000);
    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.ADMIN_UI_LOCAL_ONLY).toBe(true);
  });

  it('normalizes NODE_ENV and evaluates helper predicates from env snapshot', async () => {
    const envModule = await importEnvModule({
      NODE_ENV: '  PRODUCTION  ',
    });

    expect(envModule.currentEnv()).toBe('production');
    expect(envModule.isProductionEnv()).toBe(true);
    expect(envModule.isDeployedEnv()).toBe(true);
    expect(envModule.isDevelopmentEnv()).toBe(false);
  });

  it('uses development default when NODE_ENV is missing', async () => {
    const envModule = await importEnvModule({
      NODE_ENV: undefined,
    });

    expect(envModule.currentEnv()).toBe('development');
    expect(envModule.isDevelopmentEnv()).toBe(true);
    expect(envModule.isDeployedEnv()).toBe(false);
  });

  it('throws startup EnvironmentValidationError category for invalid numeric env', async () => {
    await expect(
      importEnvModule({
        PORT: 'not-a-number',
      }),
    ).rejects.toMatchObject({
      name: 'EnvironmentValidationError',
      code: 'invalid_environment_configuration',
      invalidKeys: ['PORT'],
    });
  });
});

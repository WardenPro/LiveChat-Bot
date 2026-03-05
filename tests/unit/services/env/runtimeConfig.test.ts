import { describe, expect, it } from 'vitest';

import { ENV_DEFAULTS } from '../../../../src/services/env/defaults';
import {
  EnvironmentValidationError,
  isEnvironmentValidationError,
  parseRuntimeConfig,
} from '../../../../src/services/env/runtimeConfig';
import { createRuntimeEnv } from './runtimeEnvFixture';

describe('env/runtimeConfig', () => {
  it('returns parsed runtime config with optional defaults', () => {
    const parsed = parseRuntimeConfig(createRuntimeEnv());

    expect(parsed.PORT).toBe(ENV_DEFAULTS.PORT);
    expect(parsed.LOG).toBe(ENV_DEFAULTS.LOG);
    expect(parsed.ADMIN_UI_LOCAL_ONLY).toBe(ENV_DEFAULTS.ADMIN_UI_LOCAL_ONLY);
  });

  it('returns EnvironmentValidationError for invalid numeric env values', () => {
    let thrownError: unknown;

    try {
      parseRuntimeConfig(
        createRuntimeEnv({
          PORT: 'not-a-number',
        }),
      );
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(EnvironmentValidationError);
    expect(isEnvironmentValidationError(thrownError)).toBe(true);

    if (!isEnvironmentValidationError(thrownError)) {
      throw thrownError;
    }

    expect(thrownError.code).toBe('invalid_environment_configuration');
    expect(thrownError.invalidKeys).toEqual(['PORT']);
  });

  it('returns EnvironmentValidationError for invalid enum env values', () => {
    let thrownError: unknown;

    try {
      parseRuntimeConfig(
        createRuntimeEnv({
          MEDIA_VIDEO_ENCODER: 'vp9',
        }),
      );
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(EnvironmentValidationError);
    expect(isEnvironmentValidationError(thrownError)).toBe(true);

    if (!isEnvironmentValidationError(thrownError)) {
      throw thrownError;
    }

    expect(thrownError.code).toBe('invalid_environment_configuration');
    expect(thrownError.invalidKeys).toEqual(['MEDIA_VIDEO_ENCODER']);
  });

  it('returns false for non-validation errors in type guard', () => {
    expect(isEnvironmentValidationError(new Error('boom'))).toBe(false);
  });
});

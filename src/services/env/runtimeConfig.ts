import { ZodError } from 'zod';
import { runtimeConfigSchema, type RuntimeConfig } from './configSchema';

const ENV_CONFIG_ERROR_CODE = 'invalid_environment_configuration';

const toIssuePath = (errorPath: Array<string | number>): string => {
  const normalized = errorPath.map((segment) => String(segment).trim()).filter((segment) => segment.length > 0);

  return normalized.length > 0 ? normalized.join('.') : 'unknown';
};

const toDistinctIssuePaths = (error: ZodError): string[] => {
  return Array.from(
    new Set(error.issues.map((issue) => toIssuePath(issue.path)).filter((path) => path !== 'unknown')),
  ).sort();
};

export class EnvironmentValidationError extends Error {
  public readonly code = ENV_CONFIG_ERROR_CODE;
  public readonly invalidKeys: string[];

  constructor(invalidKeys: string[]) {
    const suffix = invalidKeys.length > 0 ? `: ${invalidKeys.join(', ')}` : '';
    super(`Invalid environment configuration${suffix}`);
    this.name = 'EnvironmentValidationError';
    this.invalidKeys = invalidKeys;
  }
}

const assertRuntimeInvariants = (config: RuntimeConfig): RuntimeConfig => {
  if (config.PORT < 0 || config.PORT > 65535) {
    throw new EnvironmentValidationError(['PORT']);
  }

  return config;
};

export const parseRuntimeConfig = (runtimeEnv: NodeJS.ProcessEnv): RuntimeConfig => {
  try {
    const parsed = runtimeConfigSchema.parse(runtimeEnv);
    return assertRuntimeInvariants(parsed);
  } catch (error) {
    if (error instanceof EnvironmentValidationError) {
      throw error;
    }

    if (error instanceof ZodError) {
      throw new EnvironmentValidationError(toDistinctIssuePaths(error));
    }

    throw error;
  }
};

export const isEnvironmentValidationError = (error: unknown): error is EnvironmentValidationError => {
  return error instanceof EnvironmentValidationError;
};

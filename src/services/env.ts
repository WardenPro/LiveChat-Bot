import 'dotenv/config';
import { EnvironmentValidationError, isEnvironmentValidationError, parseRuntimeConfig } from './env/runtimeConfig';

export type RuntimeConfig = ReturnType<typeof loadEnv>;

export const loadEnv = (runtimeEnv: NodeJS.ProcessEnv = process.env) => {
  return parseRuntimeConfig(runtimeEnv);
};

export const env = loadEnv();

export { isEnvironmentValidationError, EnvironmentValidationError };

export enum Environment {
  TEST = 'test',
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PREPRODUCTION = 'preproduction',
  PRODUCTION = 'production',
}

export const currentEnv = () =>
  (!!env.NODE_ENV && env.NODE_ENV !== undefined ? env.NODE_ENV : Environment.DEVELOPMENT)
    ?.toString()
    ?.toLowerCase()
    ?.trim();
export const isProductionEnv = () => currentEnv() === Environment.PRODUCTION;
export const isPreProductionEnv = () => currentEnv() === Environment.PREPRODUCTION;
export const isStagingEnv = () => currentEnv() === Environment.STAGING;
export const isDevelopmentEnv = () => currentEnv() === Environment.DEVELOPMENT;
export const isTestEnv = () => currentEnv() === Environment.TEST;
export const isDeployedEnv = () =>
  Object.values(Environment)
    .filter((value) => value !== Environment.TEST && value !== Environment.DEVELOPMENT)
    .indexOf(currentEnv() as Environment) !== -1;

import { describe, expect, it } from 'vitest';

import { runtimeConfigSchema } from '../../../../src/services/env/configSchema';
import { ENV_DEFAULTS } from '../../../../src/services/env/defaults';
import { createRuntimeEnv } from './runtimeEnvFixture';

describe('env/configSchema', () => {
  it('parses required fields and applies defaults to optional values', () => {
    const parsed = runtimeConfigSchema.parse(createRuntimeEnv());

    expect(parsed.API_URL).toBe('https://api.livechat.example');
    expect(parsed.DISCORD_TOKEN).toBe('discord-token');
    expect(parsed.DISCORD_CLIENT_ID).toBe('discord-client-id');
    expect(parsed.DATABASE_URL).toBe('file:./sqlite.db');

    expect(parsed.NODE_ENV).toBe(ENV_DEFAULTS.NODE_ENV);
    expect(parsed.LOG).toBe(ENV_DEFAULTS.LOG);
    expect(parsed.PORT).toBe(ENV_DEFAULTS.PORT);
    expect(parsed.ADMIN_UI_LOCAL_ONLY).toBe(ENV_DEFAULTS.ADMIN_UI_LOCAL_ONLY);
    expect(parsed.MEDIA_VIDEO_ENCODER).toBe(ENV_DEFAULTS.MEDIA_VIDEO_ENCODER);
  });

  it('uses the same resulting value when an optional env variable is missing or set to default', () => {
    const withMissingOptional = runtimeConfigSchema.parse(
      createRuntimeEnv({
        MEDIA_CACHE_TTL_HOURS: undefined,
      }),
    );
    const withExplicitDefault = runtimeConfigSchema.parse(
      createRuntimeEnv({
        MEDIA_CACHE_TTL_HOURS: String(ENV_DEFAULTS.MEDIA_CACHE_TTL_HOURS),
      }),
    );

    expect(withMissingOptional.MEDIA_CACHE_TTL_HOURS).toBe(ENV_DEFAULTS.MEDIA_CACHE_TTL_HOURS);
    expect(withMissingOptional.MEDIA_CACHE_TTL_HOURS).toBe(withExplicitDefault.MEDIA_CACHE_TTL_HOURS);
  });

  it('normalizes numeric values from env strings', () => {
    const parsed = runtimeConfigSchema.parse(
      createRuntimeEnv({
        PORT: ' 8081 ',
        MEDIA_AUDIO_LOUDNORM_I: ' -16.25 ',
      }),
    );

    expect(parsed.PORT).toBe(8081);
    expect(parsed.MEDIA_AUDIO_LOUDNORM_I).toBe(-16.25);
  });

  it('rejects missing required variables', () => {
    const result = runtimeConfigSchema.safeParse(
      createRuntimeEnv({
        API_URL: undefined,
      }),
    );

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected parse failure for missing API_URL');
    }
    expect(result.error.issues.some((issue) => issue.path.join('.') === 'API_URL')).toBe(true);
  });

  it('rejects invalid enum values', () => {
    const result = runtimeConfigSchema.safeParse(
      createRuntimeEnv({
        LOG: 'trace',
      }),
    );

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected parse failure for invalid LOG value');
    }
    expect(result.error.issues.some((issue) => issue.path.join('.') === 'LOG')).toBe(true);
  });
});

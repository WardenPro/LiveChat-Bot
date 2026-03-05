import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { parseBooleanEnv, parseFloatEnv, parseIntegerEnv } from '../../../../src/services/env/parsers';

describe('env/parsers', () => {
  it('parses integer values with defaults and whitespace normalization', () => {
    const schema = z.object({
      PORT: parseIntegerEnv('PORT', 3000, { min: 0, max: 65535 }),
    });

    expect(schema.parse({}).PORT).toBe(3000);
    expect(schema.parse({ PORT: ' 8080 ' }).PORT).toBe(8080);
  });

  it('rejects invalid integer values with custom error messages', () => {
    const schema = z.object({
      PORT: parseIntegerEnv('PORT', 3000, { min: 0, max: 65535 }),
    });

    const invalidInteger = schema.safeParse({ PORT: '8080.5' });
    expect(invalidInteger.success).toBe(false);
    if (invalidInteger.success) {
      throw new Error('Expected parse failure for a non-integer PORT value');
    }
    expect(invalidInteger.error.issues[0]?.message).toBe('PORT must be an integer');

    const outOfRange = schema.safeParse({ PORT: '70000' });
    expect(outOfRange.success).toBe(false);
    if (outOfRange.success) {
      throw new Error('Expected parse failure for an out-of-range PORT value');
    }
    expect(outOfRange.error.issues[0]?.message).toBe('PORT must be <= 65535');
  });

  it('parses float values with defaults and whitespace normalization', () => {
    const schema = z.object({
      LOUDNORM_TP: parseFloatEnv('MEDIA_AUDIO_LOUDNORM_TP', -1.5),
    });

    expect(schema.parse({}).LOUDNORM_TP).toBe(-1.5);
    expect(schema.parse({ LOUDNORM_TP: ' -16.25 ' }).LOUDNORM_TP).toBe(-16.25);
  });

  it('rejects invalid float values with custom error messages', () => {
    const schema = z.object({
      LOUDNORM_TP: parseFloatEnv('MEDIA_AUDIO_LOUDNORM_TP', -1.5),
    });

    const invalidFloat = schema.safeParse({ LOUDNORM_TP: 'NaN' });
    expect(invalidFloat.success).toBe(false);
    if (invalidFloat.success) {
      throw new Error('Expected parse failure for an invalid float value');
    }
    expect(invalidFloat.error.issues[0]?.message).toBe('MEDIA_AUDIO_LOUDNORM_TP must be a finite number');
  });

  it('parses boolean values from string enum defaults', () => {
    const schema = z.object({
      ADMIN_UI_LOCAL_ONLY: parseBooleanEnv(true),
    });

    expect(schema.parse({}).ADMIN_UI_LOCAL_ONLY).toBe(true);
    expect(schema.parse({ ADMIN_UI_LOCAL_ONLY: 'false' }).ADMIN_UI_LOCAL_ONLY).toBe(false);
  });

  it('rejects invalid boolean tokens', () => {
    const schema = z.object({
      ADMIN_UI_LOCAL_ONLY: parseBooleanEnv(true),
    });

    const invalidBoolean = schema.safeParse({ ADMIN_UI_LOCAL_ONLY: 'TRUE' });
    expect(invalidBoolean.success).toBe(false);
  });
});

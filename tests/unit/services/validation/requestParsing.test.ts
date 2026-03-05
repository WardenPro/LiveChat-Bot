import { describe, expect, it, vi } from 'vitest';

import {
  parseBodyField,
  parseBodyNonEmptyString,
  parseBooleanFlag,
  parseNonEmptyString,
  parseNonEmptyStringOrUndefined,
  parseOptionalBoolean,
  parseOptionalDurationSec,
  parseOptionalInt,
  parseParamField,
  parseParamNonEmptyString,
  parseQueryField,
  parseQueryNonEmptyString,
  parseRequestField,
} from '../../../../src/services/validation/requestParsing';

describe('services/validation/requestParsing', () => {
  it('parses fields from request-like objects and forwards values to parser', () => {
    const parser = vi.fn().mockImplementation((value: unknown) => `${String(value)}-parsed`);

    const parsedFromRequest = parseRequestField({ text: 'hello' }, 'text', parser);
    const parsedFromBody = parseBodyField({ flag: true }, 'flag', parser);
    const parsedFromParams = parseParamField({ id: '42' }, 'id', parser);
    const parsedFromQuery = parseQueryField({ page: 2 }, 'page', parser);

    expect(parsedFromRequest).toBe('hello-parsed');
    expect(parsedFromBody).toBe('true-parsed');
    expect(parsedFromParams).toBe('42-parsed');
    expect(parsedFromQuery).toBe('2-parsed');
    expect(parser).toHaveBeenCalledTimes(4);
  });

  it('passes undefined to parser when source payload is not an object', () => {
    const parser = vi.fn().mockReturnValue('fallback');

    const parsed = parseRequestField('not-an-object', 'missing', parser);

    expect(parsed).toBe('fallback');
    expect(parser).toHaveBeenCalledWith(undefined);
  });

  it('propagates parser errors for invalid parsing branches', () => {
    const parseFailure = new Error('invalid_request_field');

    expect(() =>
      parseRequestField({ duration: 'abc' }, 'duration', () => {
        throw parseFailure;
      }),
    ).toThrowError(parseFailure);
  });

  it('normalizes non-empty string parsing helpers', () => {
    expect(parseNonEmptyString('  overlay  ')).toBe('overlay');
    expect(parseNonEmptyString('   ')).toBeNull();
    expect(parseNonEmptyString(123)).toBeNull();

    expect(parseNonEmptyStringOrUndefined('  label  ')).toBe('label');
    expect(parseNonEmptyStringOrUndefined('')).toBeUndefined();

    expect(parseBodyNonEmptyString({ caption: '  hello  ' }, 'caption')).toBe('hello');
    expect(parseParamNonEmptyString({ guildId: ' guild-1 ' }, 'guildId')).toBe('guild-1');
    expect(parseQueryNonEmptyString({ token: ' token-1 ' }, 'token')).toBe('token-1');
  });

  it('parses boolean-like values and rejects malformed booleans', () => {
    expect(parseBooleanFlag(true)).toBe(true);
    expect(parseBooleanFlag(1)).toBe(true);
    expect(parseBooleanFlag(' YES ')).toBe(true);
    expect(parseBooleanFlag('off')).toBe(false);
    expect(parseBooleanFlag({})).toBe(false);

    expect(parseOptionalBoolean(false)).toBe(false);
    expect(parseOptionalBoolean('true')).toBeUndefined();
    expect(parseOptionalBoolean(null)).toBeUndefined();
  });

  it('parses optional integers and durations with invalid branch handling', () => {
    expect(parseOptionalInt(12.9)).toBe(12);
    expect(parseOptionalInt(' 007 ')).toBe(7);
    expect(parseOptionalInt('not-an-int')).toBeNull();
    expect(parseOptionalInt('')).toBeNull();
    expect(parseOptionalInt(Number.NaN)).toBeNull();

    expect(parseOptionalDurationSec(4.2)).toBe(5);
    expect(parseOptionalDurationSec(0)).toBeNull();
    expect(parseOptionalDurationSec(-1)).toBeNull();
    expect(parseOptionalDurationSec('3')).toBeNull();
  });
});

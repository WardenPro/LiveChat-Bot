import { describe, expect, it, vi } from 'vitest';

import {
  REDACTED_LOG_MARKER,
  OperationalError,
  buildSafeErrorLogContext,
  createHttpErrorHandler,
  createSocketAuthOperationalError,
  mapErrorToCommandOutput,
  mapErrorToHttpOutput,
  mapErrorToSocketAuthOutput,
  sanitizeLogValue,
} from '../../../../src/services/errors/runtimeErrorHandling';

describe('services/errors/runtimeErrorHandling', () => {
  it('sanitizes sensitive log values and preserves non-sensitive metadata', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const sanitized = sanitizeLogValue({
      authorization: 'Bearer secret-token',
      message: 'token=plain-text',
      nested: {
        apiKey: 'abcdef',
        safe: 'hello',
      },
      circular,
    }) as Record<string, unknown>;

    expect(sanitized.authorization).toBe(REDACTED_LOG_MARKER);
    expect(sanitized.message).toBe('token=[REDACTED]');
    expect((sanitized.nested as Record<string, unknown>).apiKey).toBe(REDACTED_LOG_MARKER);
    expect((sanitized.nested as Record<string, unknown>).safe).toBe('hello');
    expect((sanitized.circular as Record<string, unknown>).self).toBe('[Circular]');
  });

  it('maps operational and unexpected errors to HTTP output payloads', () => {
    const authError = new OperationalError({
      category: 'authentication',
      code: 'missing_token',
      message: 'missing token',
      statusCode: 401,
    });

    expect(mapErrorToHttpOutput(authError)).toEqual({
      category: 'authentication',
      statusCode: 401,
      payload: {
        error: 'request_error',
      },
      logLevel: 'warn',
    });

    expect(mapErrorToHttpOutput(new Error('unexpected'))).toEqual({
      category: 'unexpected',
      statusCode: 500,
      payload: {
        error: 'internal_error',
      },
      logLevel: 'error',
    });
  });

  it('creates an HTTP error handler that logs safely and sends mapped payloads', async () => {
    const logger = {
      warn: vi.fn(),
      error: vi.fn(),
    };
    const handler = createHttpErrorHandler(logger);

    const reply = {
      sent: false,
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockResolvedValue(undefined),
    };

    await handler(
      {
        message: 'authorization=raw-secret',
        statusCode: 400,
      } as any,
      {
        method: 'POST',
        url: '/overlay/config',
      } as any,
      reply as any,
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/overlay/config',
        statusCode: 400,
      }),
      '[HTTP] Request error',
    );
    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'request_error',
    });

    const safeContext = buildSafeErrorLogContext(new Error('token=abc'), {
      credentials: {
        token: 'abc',
      },
    });
    expect((safeContext.err as Record<string, unknown>).message).toBe('token=[REDACTED]');
    expect(safeContext.credentials).toBe(REDACTED_LOG_MARKER);
  });

  it('respects already-sent replies and skips duplicate writes', async () => {
    const logger = {
      warn: vi.fn(),
      error: vi.fn(),
    };
    const handler = createHttpErrorHandler(logger);
    const reply = {
      sent: true,
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    await handler(new Error('already sent') as any, { method: 'GET', url: '/health' } as any, reply as any);

    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('maps socket and command errors to transport-safe outputs', () => {
    const missingTokenError = createSocketAuthOperationalError('missing_token', {
      source: 'socket',
    });
    const socketMapped = mapErrorToSocketAuthOutput(missingTokenError);

    expect(socketMapped).toMatchObject({
      category: 'authentication',
      socketCode: 'missing_token',
      logLevel: 'warn',
    });
    expect(socketMapped.transportError).toBeInstanceOf(Error);
    expect(socketMapped.transportError.message).toBe('missing_token');

    const genericSocketMapped = mapErrorToSocketAuthOutput(new Error('transport failure'));
    expect(genericSocketMapped).toMatchObject({
      category: 'unexpected',
      socketCode: 'auth_error',
      logLevel: 'error',
    });

    const commandMapped = mapErrorToCommandOutput(missingTokenError);
    expect(commandMapped).toEqual({
      category: 'authentication',
      responseCode: 'command_error',
      logLevel: 'error',
    });
  });
});

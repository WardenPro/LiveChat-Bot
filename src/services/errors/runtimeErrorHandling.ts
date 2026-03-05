import type { FastifyBaseLogger, FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export type ErrorCategory =
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'operational'
  | 'unexpected';

export type SocketAuthErrorCode = 'missing_token' | 'invalid_token' | 'auth_error';

export type HttpErrorPayload = {
  error: 'internal_error' | 'request_error';
};

interface OperationalErrorOptions {
  category: Exclude<ErrorCategory, 'unexpected'>;
  code: string;
  message: string;
  statusCode?: number;
  socketCode?: SocketAuthErrorCode;
  context?: Record<string, unknown>;
}

const REDACTED_LOG_VALUE = '[REDACTED]';
const MAX_SANITIZE_DEPTH = 5;
const SENSITIVE_KEY_PATTERN = /token|secret|password|credential|authorization|cookie|api[-_]?key/i;
const SENSITIVE_VALUE_PATTERN =
  /(bearer\s+)[^,\s;]+|((?:token|secret|password|credential|authorization|cookie|api[-_]?key)\s*[:=]\s*)[^,\s;]+/gi;

const isHttpStatusCode = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value) && value >= 400 && value < 600;
};

const toHttpStatusCode = (error: unknown): number => {
  const errorStatusCode = (error as { statusCode?: unknown } | null)?.statusCode;
  return isHttpStatusCode(errorStatusCode) ? Math.trunc(errorStatusCode) : 500;
};

const sanitizeString = (value: string): string => {
  return value.replace(SENSITIVE_VALUE_PATTERN, (fullMatch: string, bearerPrefix?: string, keyPrefix?: string) => {
    if (bearerPrefix) {
      return `${bearerPrefix}${REDACTED_LOG_VALUE}`;
    }

    if (keyPrefix) {
      return `${keyPrefix}${REDACTED_LOG_VALUE}`;
    }

    return fullMatch;
  });
};

const sanitizeLogValueInternal = (value: unknown, depth: number, seen: WeakSet<object>): unknown => {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (typeof value === 'symbol') {
    return String(value);
  }

  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (depth >= MAX_SANITIZE_DEPTH) {
    return '[Truncated]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValueInternal(item, depth + 1, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);

    const entries = Object.entries(value);
    const sanitizedRecord = entries.reduce<Record<string, unknown>>((accumulator, [key, entryValue]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        accumulator[key] = REDACTED_LOG_VALUE;
      } else {
        accumulator[key] = sanitizeLogValueInternal(entryValue, depth + 1, seen);
      }

      return accumulator;
    }, {});

    seen.delete(value);
    return sanitizedRecord;
  }

  return String(value);
};

const toCategoryFromStatusCode = (statusCode: number): ErrorCategory => {
  if (statusCode === 401) {
    return 'authentication';
  }

  if (statusCode === 403) {
    return 'authorization';
  }

  if (statusCode === 404) {
    return 'not_found';
  }

  if (statusCode >= 400 && statusCode < 500) {
    return 'validation';
  }

  return 'unexpected';
};

const toErrorCategory = (error: unknown, statusCode: number): ErrorCategory => {
  if (error instanceof OperationalError) {
    return error.category;
  }

  if (statusCode >= 500) {
    return 'unexpected';
  }

  return toCategoryFromStatusCode(statusCode);
};

const toStructuredError = (error: unknown) => {
  if (error instanceof OperationalError) {
    return sanitizeLogValue({
      name: error.name,
      code: error.code,
      category: error.category,
      statusCode: error.statusCode ?? null,
      socketCode: error.socketCode ?? null,
      message: error.message,
      context: error.context ?? null,
      stack: error.stack ?? null,
    });
  }

  if (error instanceof Error) {
    return sanitizeLogValue({
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    });
  }

  return sanitizeLogValue({
    value: error,
  });
};

export class OperationalError extends Error {
  public readonly category: Exclude<ErrorCategory, 'unexpected'>;
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly socketCode?: SocketAuthErrorCode;
  public readonly context?: Record<string, unknown>;

  constructor(options: OperationalErrorOptions) {
    super(options.message);
    this.name = 'OperationalError';
    this.category = options.category;
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.socketCode = options.socketCode;
    this.context = options.context;
  }
}

export interface HttpErrorOutput {
  category: ErrorCategory;
  statusCode: number;
  payload: HttpErrorPayload;
  logLevel: 'warn' | 'error';
}

export interface SocketAuthErrorOutput {
  category: ErrorCategory;
  socketCode: SocketAuthErrorCode;
  transportError: Error;
  logLevel: 'warn' | 'error';
}

export interface CommandErrorOutput {
  category: ErrorCategory;
  responseCode: 'command_error';
  logLevel: 'error';
}

export const sanitizeLogValue = (value: unknown): unknown => {
  return sanitizeLogValueInternal(value, 0, new WeakSet<object>());
};

export const buildSafeErrorLogContext = (
  error: unknown,
  context?: Record<string, unknown>,
): Record<string, unknown> => {
  const safeContext = sanitizeLogValue(context || {}) as Record<string, unknown>;

  return {
    ...safeContext,
    err: toStructuredError(error),
  };
};

export const mapErrorToHttpOutput = (error: unknown): HttpErrorOutput => {
  const statusCode = toHttpStatusCode(error);
  const category = toErrorCategory(error, statusCode);
  const payload: HttpErrorPayload = statusCode >= 500 ? { error: 'internal_error' } : { error: 'request_error' };

  return {
    category,
    statusCode,
    payload,
    logLevel: statusCode >= 500 ? 'error' : 'warn',
  };
};

export const createHttpErrorHandler = (logger: Pick<FastifyBaseLogger, 'warn' | 'error'>) => {
  return async (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const mapped = mapErrorToHttpOutput(error);
    const logContext = buildSafeErrorLogContext(error, {
      method: request.method,
      path: request.url,
      statusCode: mapped.statusCode,
      category: mapped.category,
    });

    if (mapped.logLevel === 'error') {
      logger.error(logContext, '[HTTP] Internal error');
    } else {
      logger.warn(logContext, '[HTTP] Request error');
    }

    if (reply.sent) {
      return;
    }

    return reply.code(mapped.statusCode).send(mapped.payload);
  };
};

export const createSocketAuthOperationalError = (
  code: Exclude<SocketAuthErrorCode, 'auth_error'>,
  context?: Record<string, unknown>,
) => {
  const message = code === 'missing_token' ? 'overlay_socket_missing_token' : 'overlay_socket_invalid_token';

  return new OperationalError({
    category: 'authentication',
    code,
    message,
    statusCode: 401,
    socketCode: code,
    context,
  });
};

export const mapErrorToSocketAuthOutput = (
  error: unknown,
  fallbackSocketCode: SocketAuthErrorCode = 'auth_error',
): SocketAuthErrorOutput => {
  const socketCode = error instanceof OperationalError && error.socketCode ? error.socketCode : fallbackSocketCode;
  const category = socketCode === 'auth_error' ? toErrorCategory(error, toHttpStatusCode(error)) : 'authentication';
  const logLevel: 'warn' | 'error' = socketCode === 'auth_error' ? 'error' : 'warn';

  return {
    category,
    socketCode,
    transportError: new Error(socketCode),
    logLevel,
  };
};

export const mapErrorToCommandOutput = (error: unknown): CommandErrorOutput => {
  const statusCode = toHttpStatusCode(error);

  return {
    category: toErrorCategory(error, statusCode),
    responseCode: 'command_error',
    logLevel: 'error',
  };
};

export const REDACTED_LOG_MARKER = REDACTED_LOG_VALUE;

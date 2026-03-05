import assert from 'assert';
import Fastify from 'fastify';

import {
  REDACTED_LOG_MARKER,
  buildSafeErrorLogContext,
  createHttpErrorHandler,
  OperationalError,
} from '../services/errors/runtimeErrorHandling';
import { toValueShape } from './utils';

const parseJsonBody = (payload: string): Record<string, unknown> => {
  const trimmed = payload.trim();

  if (!trimmed) {
    return {};
  }

  return JSON.parse(trimmed) as Record<string, unknown>;
};

export const runErrorHandlingCharacterization = async () => {
  const fastify = Fastify({ logger: false });
  fastify.setErrorHandler(createHttpErrorHandler(fastify.log));

  fastify.get('/characterization/request-error', async () => {
    const error = new Error('token=super-secret-value');
    (error as Error & { statusCode?: number }).statusCode = 422;
    throw error;
  });

  fastify.get('/characterization/operational-error', async () => {
    throw new OperationalError({
      category: 'operational',
      code: 'known_failure',
      message: 'authorization=Bearer super-secret-value',
      statusCode: 400,
      context: {
        token: 'super-secret-value',
        password: 'super-secret-password',
      },
    });
  });

  fastify.get('/characterization/unexpected-error', async () => {
    throw new Error('secret=super-secret-value');
  });

  const requestErrorResponse = await fastify.inject({
    method: 'GET',
    url: '/characterization/request-error',
  });
  const operationalErrorResponse = await fastify.inject({
    method: 'GET',
    url: '/characterization/operational-error',
  });
  const unexpectedErrorResponse = await fastify.inject({
    method: 'GET',
    url: '/characterization/unexpected-error',
  });

  await fastify.close();

  const requestErrorBody = parseJsonBody(requestErrorResponse.payload);
  const operationalErrorBody = parseJsonBody(operationalErrorResponse.payload);
  const unexpectedErrorBody = parseJsonBody(unexpectedErrorResponse.payload);

  assert.deepStrictEqual(requestErrorBody, { error: 'request_error' });
  assert.deepStrictEqual(operationalErrorBody, { error: 'request_error' });
  assert.deepStrictEqual(unexpectedErrorBody, { error: 'internal_error' });

  const safeLogContext = buildSafeErrorLogContext(new Error('token=super-secret-value'), {
    socketToken: 'super-secret-value',
    nested: {
      password: 'super-secret-password',
    },
    authorization: 'Bearer super-secret-value',
    note: 'safe-note',
  });

  const serializedSafeLogContext = JSON.stringify(safeLogContext);
  const leakedSensitiveValue = serializedSafeLogContext.includes('super-secret-value');

  assert.strictEqual(leakedSensitiveValue, false, 'safe log context should redact sensitive values');
  assert(serializedSafeLogContext.includes(REDACTED_LOG_MARKER), 'safe log context should include redaction marker');

  return {
    requestError: {
      statusCode: requestErrorResponse.statusCode,
      bodyShape: toValueShape(requestErrorBody),
    },
    operationalError: {
      statusCode: operationalErrorResponse.statusCode,
      bodyShape: toValueShape(operationalErrorBody),
    },
    unexpectedError: {
      statusCode: unexpectedErrorResponse.statusCode,
      bodyShape: toValueShape(unexpectedErrorBody),
    },
    safeLogContext: {
      leakedSensitiveValue,
      redactionMarkerPresent: serializedSafeLogContext.includes(REDACTED_LOG_MARKER),
    },
  };
};

import assert from 'assert';
import Fastify from 'fastify';

import { createAdminRoutes } from '../components/admin/adminRoutes';
import { ensureCharacterizationGlobals, toValueShape } from './utils';

interface IngestClientCreateData {
  guildId: string;
  label: string;
  tokenHash: string;
  defaultAuthorName: string;
  defaultAuthorImage: string | null;
  createdByDiscordUserId: string;
}

interface IngestClientCreateCall {
  data: IngestClientCreateData;
}

const parseJsonBody = (payload: string): Record<string, unknown> => {
  const trimmedPayload = payload.trim();
  if (!trimmedPayload) {
    return {};
  }

  return JSON.parse(trimmedPayload) as Record<string, unknown>;
};

export const runAdminIngestClientValidationCharacterization = async () => {
  ensureCharacterizationGlobals({
    ADMIN_UI_TOKEN: 'admin-ui-token',
    ADMIN_UI_LOCAL_ONLY: false,
  });

  const ingestClientCreateCalls: IngestClientCreateCall[] = [];

  global.prisma = {
    pairingCode: {
      findMany: async () => [
        {
          createdByDiscordUserId: 'author-123',
          authorName: 'Alice',
          authorImage: 'https://cdn.example/alice.png',
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
        },
      ],
    },
    ingestClient: {
      findMany: async () => [],
      create: async (args: IngestClientCreateCall) => {
        ingestClientCreateCalls.push(args);

        return {
          id: 'ingest-client-char-1',
          guildId: args.data.guildId,
          label: args.data.label,
          tokenHash: args.data.tokenHash,
          defaultAuthorName: args.data.defaultAuthorName,
          defaultAuthorImage: args.data.defaultAuthorImage,
          createdByDiscordUserId: args.data.createdByDiscordUserId,
          lastSeenAt: null,
          createdAt: new Date('2026-01-01T11:00:00.000Z'),
          revokedAt: null,
        };
      },
      updateMany: async () => ({ count: 0 }),
      findFirst: async () => null,
      deleteMany: async () => ({ count: 0 }),
    },
  } as any;

  const fastify = Fastify({ logger: false });
  await fastify.register(createAdminRoutes() as any, {
    prefix: '/admin',
  });

  const adminHeaders = {
    authorization: 'Bearer admin-ui-token',
  };

  const validPayloadResponse = await fastify.inject({
    method: 'POST',
    url: '/admin/api/ingest-clients',
    headers: adminHeaders,
    payload: {
      guildId: 'guild-rest-domain',
      authorDiscordUserId: 'author-123',
      label: 'Desk',
    },
  });

  const invalidAuthorResponse = await fastify.inject({
    method: 'POST',
    url: '/admin/api/ingest-clients',
    headers: adminHeaders,
    payload: {
      guildId: 'guild-rest-domain',
      authorDiscordUserId: '   ',
      label: 'Desk',
    },
  });

  await fastify.close();

  const validPayloadBody = parseJsonBody(validPayloadResponse.payload);
  const invalidAuthorBody = parseJsonBody(invalidAuthorResponse.payload);

  assert.strictEqual(ingestClientCreateCalls.length, 1, 'valid payload should persist exactly one ingest client');

  const persistedData = ingestClientCreateCalls[0]?.data || null;

  return {
    validPayload: {
      statusCode: validPayloadResponse.statusCode,
      bodyShape: toValueShape(validPayloadBody),
      persistedDataShape: toValueShape(persistedData),
      persistedCreatedByDiscordUserId:
        persistedData && typeof persistedData.createdByDiscordUserId === 'string'
          ? persistedData.createdByDiscordUserId
          : null,
    },
    invalidAuthorDiscordUserId: {
      statusCode: invalidAuthorResponse.statusCode,
      bodyShape: toValueShape(invalidAuthorBody),
      error: typeof invalidAuthorBody.error === 'string' ? invalidAuthorBody.error : null,
    },
  };
};

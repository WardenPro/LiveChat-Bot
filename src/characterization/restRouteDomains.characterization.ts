import assert from 'assert';
import crypto from 'crypto';
import Module from 'module';
import Fastify from 'fastify';

import { ensureCharacterizationGlobals, toValueShape } from './utils';

interface RestRoutesCharacterizationState {
  guildLookups: number;
  overlayClientLookups: number;
}

const hashToken = (token: string) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const createRestRoutesPrismaStub = (state: RestRoutesCharacterizationState, validTokenHash: string) => {
  return {
    overlayClient: {
      findFirst: async (args: { where: { tokenHash: string; revokedAt: null } }) => {
        state.overlayClientLookups += 1;

        if (args.where.revokedAt !== null || args.where.tokenHash !== validTokenHash) {
          return null;
        }

        return {
          id: 'overlay-client-char',
          guildId: 'guild-rest-domain',
          label: 'Overlay-Desk',
          tokenHash: validTokenHash,
          sessionMode: 'NORMAL',
          defaultAuthorName: null,
          defaultAuthorImage: null,
          createdByDiscordUserId: null,
          lastSeenAt: null,
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
          revokedAt: null,
        };
      },
    },
    guild: {
      findFirst: async (args: { where: { id: string } }) => {
        state.guildLookups += 1;

        return {
          id: args.where.id,
          defaultMediaTime: 37,
          maxMediaTime: 92,
        };
      },
    },
  };
};

const parseJsonBody = (payload: string): Record<string, unknown> => {
  const trimmedPayload = payload.trim();
  if (!trimmedPayload) {
    return {};
  }

  return JSON.parse(trimmedPayload) as Record<string, unknown>;
};

const loadRestLoader = async () => {
  const moduleLoader = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };

  const originalLoad = moduleLoader._load;

  moduleLoader._load = (request: string, parent: unknown, isMain: boolean) => {
    if (request === '../../services/media/mediaIngestion') {
      return {
        ingestMediaFromSource: async () => {
          throw new Error('media_ingestion_stub_should_not_run_in_rest_route_domains_characterization');
        },
      };
    }

    return originalLoad(request, parent, isMain);
  };

  try {
    const restLoaderModule = await import('../loaders/RESTLoader');
    return restLoaderModule.loadRestRoutes;
  } finally {
    moduleLoader._load = originalLoad;
  }
};

export const runRestRouteDomainsCharacterization = async () => {
  const overlayClientToken = 'overlay-config-token';

  ensureCharacterizationGlobals({
    API_URL: 'http://localhost:4000',
    ADMIN_UI_TOKEN: 'admin-ui-token',
  });

  const state: RestRoutesCharacterizationState = {
    guildLookups: 0,
    overlayClientLookups: 0,
  };

  global.prisma = createRestRoutesPrismaStub(state, hashToken(overlayClientToken)) as any;

  const loadRestRoutes = await loadRestLoader();
  const fastify = Fastify({ logger: false });
  await loadRestRoutes(fastify as unknown as FastifyCustomInstance);

  const overlayConfig = await fastify.inject({
    method: 'GET',
    url: '/overlay/config',
    headers: {
      authorization: `Bearer ${overlayClientToken}`,
    },
  });

  const ingestMalformedConsume = await fastify.inject({
    method: 'POST',
    url: '/ingest/pair/consume',
    payload: {
      deviceName: 'Desk',
    },
  });

  const adminUnauthorizedRuntimeSettings = await fastify.inject({
    method: 'GET',
    url: '/admin/api/runtime-settings',
  });

  const unsupportedPath = await fastify.inject({
    method: 'GET',
    url: '/unsupported/path',
  });

  await fastify.close();

  const overlayConfigBody = parseJsonBody(overlayConfig.payload);
  const ingestMalformedBody = parseJsonBody(ingestMalformedConsume.payload);
  const adminUnauthorizedBody = parseJsonBody(adminUnauthorizedRuntimeSettings.payload);
  const unsupportedPathBody = parseJsonBody(unsupportedPath.payload);

  assert.strictEqual(state.guildLookups, 1, 'overlay config should look up guild exactly once');
  assert.strictEqual(state.overlayClientLookups, 1, 'overlay config should resolve overlay client once');

  return {
    overlayConfig: {
      statusCode: overlayConfig.statusCode,
      bodyShape: toValueShape(overlayConfigBody),
      payloadKeys: Object.keys(overlayConfigBody).sort(),
    },
    ingestPairConsumeMalformed: {
      statusCode: ingestMalformedConsume.statusCode,
      bodyShape: toValueShape(ingestMalformedBody),
    },
    adminRuntimeSettingsUnauthorized: {
      statusCode: adminUnauthorizedRuntimeSettings.statusCode,
      bodyShape: toValueShape(adminUnauthorizedBody),
    },
    unsupportedRoute: {
      statusCode: unsupportedPath.statusCode,
      bodyShape: toValueShape(unsupportedPathBody),
    },
  };
};

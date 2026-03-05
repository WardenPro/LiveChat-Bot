import assert from 'assert';
import Module from 'module';
import Fastify from 'fastify';

import { ensureCharacterizationGlobals, toValueShape } from './utils';

interface PairingCodeRecord {
  code: string;
  guildId: string;
  mode: string;
  createdByDiscordUserId: string | null;
  authorName: string | null;
  authorImage: string | null;
  expiresAt: Date | null;
  usedAt: Date | null;
  createdAt: Date;
}

interface OverlayClientRecord {
  id: string;
  guildId: string;
  label: string;
  tokenHash: string;
  sessionMode: string;
  defaultAuthorName: string | null;
  defaultAuthorImage: string | null;
  createdByDiscordUserId: string | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

interface ConsumeCharacterizationState {
  pairingCodes: PairingCodeRecord[];
  overlayClients: OverlayClientRecord[];
  revokedClientCount: number;
  createdClient: OverlayClientRecord | null;
}

const createRestCharacterizationPrisma = (state: ConsumeCharacterizationState) => {
  return {
    pairingCode: {
      deleteMany: async (args: { where: { expiresAt: { lte: Date } } }) => {
        const now = args.where.expiresAt.lte;
        const before = state.pairingCodes.length;

        state.pairingCodes = state.pairingCodes.filter((pairingCode) => {
          return !pairingCode.expiresAt || pairingCode.expiresAt > now;
        });

        return {
          count: before - state.pairingCodes.length,
        };
      },
      findFirst: async (args: {
        where: {
          code: string;
          usedAt: null;
          OR: Array<{ expiresAt: null } | { expiresAt: { gt: Date } }>;
        };
      }) => {
        const now = (
          args.where.OR.find((entry) => 'expiresAt' in entry && entry.expiresAt !== null) as {
            expiresAt: { gt: Date };
          } | null
        )?.expiresAt.gt;

        return (
          state.pairingCodes.find((pairingCode) => {
            if (pairingCode.code !== args.where.code) {
              return false;
            }

            if (pairingCode.usedAt !== null) {
              return false;
            }

            if (!pairingCode.expiresAt) {
              return true;
            }

            return !!now && pairingCode.expiresAt > now;
          }) || null
        );
      },
      update: async (args: {
        where: {
          code: string;
        };
        data: {
          usedAt: Date;
          expiresAt: Date;
        };
      }) => {
        const pairingCode = state.pairingCodes.find((candidate) => candidate.code === args.where.code);

        assert(pairingCode, 'pairing code expected in update()');

        pairingCode.usedAt = args.data.usedAt;
        pairingCode.expiresAt = args.data.expiresAt;

        return pairingCode;
      },
    },
    overlayClient: {
      updateMany: async (args: {
        where: {
          guildId: string;
          label: string;
          revokedAt: null;
        };
        data: {
          revokedAt: Date;
        };
      }) => {
        let count = 0;

        for (const overlayClient of state.overlayClients) {
          if (
            overlayClient.guildId === args.where.guildId &&
            overlayClient.label === args.where.label &&
            overlayClient.revokedAt === null
          ) {
            overlayClient.revokedAt = args.data.revokedAt;
            count += 1;
          }
        }

        state.revokedClientCount += count;

        return {
          count,
        };
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const createdClient: OverlayClientRecord = {
          id: 'overlay-client-created',
          guildId: `${args.data.guildId || ''}`,
          label: `${args.data.label || ''}`,
          tokenHash: `${args.data.tokenHash || ''}`,
          sessionMode: `${args.data.sessionMode || 'NORMAL'}`,
          defaultAuthorName:
            typeof args.data.defaultAuthorName === 'string' && args.data.defaultAuthorName.trim() !== ''
              ? args.data.defaultAuthorName
              : null,
          defaultAuthorImage:
            typeof args.data.defaultAuthorImage === 'string' && args.data.defaultAuthorImage.trim() !== ''
              ? args.data.defaultAuthorImage
              : null,
          createdByDiscordUserId:
            typeof args.data.createdByDiscordUserId === 'string' && args.data.createdByDiscordUserId.trim() !== ''
              ? args.data.createdByDiscordUserId
              : null,
          lastSeenAt: null,
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
          revokedAt: null,
        };

        state.overlayClients.push(createdClient);
        state.createdClient = createdClient;

        return createdClient;
      },
    },
  };
};

const loadOverlayRoutes = async () => {
  const moduleLoader = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };

  const originalLoad = moduleLoader._load;

  moduleLoader._load = (request: string, parent: unknown, isMain: boolean) => {
    if (request === '../../services/media/mediaIngestion') {
      return {
        ingestMediaFromSource: async () => {
          throw new Error('media_ingestion_stub_should_not_run_in_pair_consume_characterization');
        },
      };
    }

    return originalLoad(request, parent, isMain);
  };

  try {
    const overlayRoutesModule = await import('../components/overlay/overlayRoutes');
    return overlayRoutesModule.OverlayRoutes;
  } finally {
    moduleLoader._load = originalLoad;
  }
};

export const runRestOverlayPairConsumeCharacterization = async () => {
  ensureCharacterizationGlobals({
    API_URL: 'http://localhost:4000',
  });

  const now = new Date();

  const state: ConsumeCharacterizationState = {
    pairingCodes: [
      {
        code: 'ABCD1234',
        guildId: 'guild-rest-1',
        mode: 'NORMAL',
        createdByDiscordUserId: 'discord-user-1',
        authorName: 'Alice',
        authorImage: 'https://cdn.example/avatar.png',
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
        usedAt: null,
        createdAt: new Date(now.getTime() - 60 * 1000),
      },
    ],
    overlayClients: [
      {
        id: 'overlay-client-existing',
        guildId: 'guild-rest-1',
        label: 'Overlay-Alice',
        tokenHash: 'already-revoked-later',
        sessionMode: 'NORMAL',
        defaultAuthorName: 'Alice',
        defaultAuthorImage: null,
        createdByDiscordUserId: 'discord-user-1',
        lastSeenAt: null,
        createdAt: new Date(now.getTime() - 30 * 60 * 1000),
        revokedAt: null,
      },
    ],
    revokedClientCount: 0,
    createdClient: null,
  };

  global.prisma = createRestCharacterizationPrisma(state) as any;

  const overlayRoutes = await loadOverlayRoutes();
  const fastify = Fastify({ logger: false });
  await fastify.register(overlayRoutes() as any, { prefix: '/overlay' });

  const validConsume = await fastify.inject({
    method: 'POST',
    url: '/overlay/pair/consume',
    payload: {
      code: 'abcd1234',
    },
  });

  const invalidConsume = await fastify.inject({
    method: 'POST',
    url: '/overlay/pair/consume',
    payload: {
      deviceName: 'Custom Device',
    },
  });

  await fastify.close();

  const validBody = validConsume.json() as Record<string, unknown>;
  const invalidBody = invalidConsume.json() as Record<string, unknown>;

  const usedPairingCode = state.pairingCodes.find((pairingCode) => pairingCode.code === 'ABCD1234');

  assert(usedPairingCode, 'pairing code should remain present after consume');
  assert(usedPairingCode.usedAt instanceof Date, 'pairing code should be marked as used');
  assert(usedPairingCode.expiresAt instanceof Date, 'pairing code should receive forced expiry');
  assert(state.createdClient, 'new overlay client should be created');

  return {
    validConsume: {
      statusCode: validConsume.statusCode,
      bodyShape: toValueShape(validBody),
      sideEffects: {
        pairingCodeMarkedUsed: usedPairingCode.usedAt instanceof Date,
        pairingCodeForcedExpired: !!usedPairingCode.expiresAt && usedPairingCode.expiresAt.getTime() < now.getTime(),
        existingClientRevokedCount: state.revokedClientCount,
        createdClientLabel: state.createdClient.label,
        createdClientSessionMode: state.createdClient.sessionMode,
      },
    },
    malformedConsume: {
      statusCode: invalidConsume.statusCode,
      bodyShape: toValueShape(invalidBody),
    },
  };
};

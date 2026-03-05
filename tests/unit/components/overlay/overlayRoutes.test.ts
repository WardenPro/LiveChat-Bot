import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OVERLAY_PROTOCOL_VERSION } from '@livechat/overlay-protocol';

import { createOverlayRoutes } from '../../../../src/components/overlay/overlayRoutes';

const overlayRouteMocks = vi.hoisted(() => {
  class MockMediaIngestionError extends Error {
    constructor(message = 'media_ingestion_failed') {
      super(message);
      this.name = 'MediaIngestionError';
    }
  }

  return {
    createOverlayClientToken: vi.fn(),
    resolveOverlayAuthFromRequest: vi.fn(),
    touchMediaAsset: vi.fn(),
    ingestMediaFromSource: vi.fn(),
    listMemeBoardItems: vi.fn(),
    addToMemeBoard: vi.fn(),
    removeMemeBoardItem: vi.fn(),
    updateMemeBoardItem: vi.fn(),
    toMediaIngestionError: vi.fn((error: unknown) =>
      error instanceof Error ? error : new MockMediaIngestionError(),
    ),
    MediaIngestionError: MockMediaIngestionError,
  };
});

vi.mock('../../../../src/services/overlayAuth', () => {
  return {
    createOverlayClientToken: overlayRouteMocks.createOverlayClientToken,
    resolveOverlayAuthFromRequest: overlayRouteMocks.resolveOverlayAuthFromRequest,
  };
});

vi.mock('../../../../src/services/media/mediaCache', () => {
  return {
    touchMediaAsset: overlayRouteMocks.touchMediaAsset,
  };
});

vi.mock('../../../../src/services/media/mediaIngestion', () => {
  return {
    ingestMediaFromSource: overlayRouteMocks.ingestMediaFromSource,
  };
});

vi.mock('../../../../src/services/media/mediaErrors', () => {
  return {
    MediaIngestionError: overlayRouteMocks.MediaIngestionError,
    toMediaIngestionError: overlayRouteMocks.toMediaIngestionError,
  };
});

vi.mock('../../../../src/services/memeBoard', () => {
  return {
    addToMemeBoard: overlayRouteMocks.addToMemeBoard,
    listMemeBoardItems: overlayRouteMocks.listMemeBoardItems,
    removeMemeBoardItem: overlayRouteMocks.removeMemeBoardItem,
    updateMemeBoardItem: overlayRouteMocks.updateMemeBoardItem,
  };
});

type PrismaPairingCodeRecord = {
  code: string;
  guildId: string;
  authorName: string | null;
  authorImage: string | null;
  createdByDiscordUserId: string | null;
  mode: string | null;
};

const createApp = async () => {
  const app = Fastify();
  await app.register(createOverlayRoutes(), {
    prefix: '/overlay',
  });
  await app.ready();

  return app;
};

describe('components/overlay/overlayRoutes', () => {
  beforeEach(() => {
    global.logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    global.env = {
      API_URL: 'https://api.livechat.test',
      DEFAULT_DURATION: 25,
    } as any;

    global.prisma = {
      pairingCode: {
        deleteMany: vi.fn().mockResolvedValue(undefined),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue(undefined),
      },
      overlayClient: {
        updateMany: vi.fn().mockResolvedValue({
          count: 0,
        }),
      },
      guild: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as any;

    overlayRouteMocks.createOverlayClientToken.mockReset();
    overlayRouteMocks.resolveOverlayAuthFromRequest.mockReset();
    overlayRouteMocks.touchMediaAsset.mockReset();
    overlayRouteMocks.ingestMediaFromSource.mockReset();
    overlayRouteMocks.listMemeBoardItems.mockReset();
    overlayRouteMocks.addToMemeBoard.mockReset();
    overlayRouteMocks.removeMemeBoardItem.mockReset();
    overlayRouteMocks.updateMemeBoardItem.mockReset();
    overlayRouteMocks.toMediaIngestionError.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects malformed consume payloads with the current validation contract', async () => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/overlay/pair/consume',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: 'invalid_payload',
      });
      expect(global.prisma.pairingCode.findFirst).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('returns pairing consume payload contract for a valid overlay code', async () => {
    const app = await createApp();
    const pairingCodeRecord: PrismaPairingCodeRecord = {
      code: 'ABCD',
      guildId: 'guild-1',
      authorName: 'Overlay Owner',
      authorImage: null,
      createdByDiscordUserId: 'discord-1',
      mode: 'NORMAL',
    };

    global.prisma.pairingCode.findFirst.mockResolvedValueOnce(pairingCodeRecord);
    overlayRouteMocks.createOverlayClientToken.mockResolvedValueOnce({
      rawToken: 'overlay-token-1',
      client: {
        id: 'overlay-client-1',
        guildId: 'guild-1',
        label: 'Studio Overlay',
      },
    });

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/overlay/pair/consume',
        payload: {
          code: 'abcd',
          deviceName: 'Studio Overlay',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        clientToken: 'overlay-token-1',
        clientId: 'overlay-client-1',
        guildId: 'guild-1',
        apiBaseUrl: 'https://api.livechat.test',
        deviceName: 'Studio Overlay',
        authorName: 'Overlay Owner',
        sessionMode: 'normal',
      });
      expect(global.prisma.pairingCode.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            code: 'ABCD',
          }),
        }),
      );
      expect(overlayRouteMocks.createOverlayClientToken).toHaveBeenCalledWith({
        guildId: 'guild-1',
        label: 'Studio Overlay',
        sessionMode: 'NORMAL',
        defaultAuthorName: 'Overlay Owner',
        defaultAuthorImage: null,
        createdByDiscordUserId: 'discord-1',
      });
    } finally {
      await app.close();
    }
  });

  it('returns unauthorized for protected config requests without valid auth', async () => {
    const app = await createApp();
    overlayRouteMocks.resolveOverlayAuthFromRequest.mockResolvedValueOnce({
      kind: 'missing_token',
    });

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/overlay/config',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        error: 'unauthorized',
      });
    } finally {
      await app.close();
    }
  });

  it('returns config payload for protected config requests with valid auth', async () => {
    const app = await createApp();
    overlayRouteMocks.resolveOverlayAuthFromRequest.mockResolvedValueOnce({
      kind: 'authenticated',
      tokenSource: 'authorization_header',
      token: 'token-1',
      client: {
        id: 'overlay-client-1',
        guildId: 'guild-42',
        label: 'Overlay',
        sessionMode: 'NORMAL',
        defaultAuthorName: null,
        defaultAuthorImage: null,
        createdByDiscordUserId: null,
      },
    });
    global.prisma.guild.findFirst.mockResolvedValueOnce({
      id: 'guild-42',
      defaultMediaTime: 30,
      maxMediaTime: 120,
    });

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/overlay/config',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        guildId: 'guild-42',
        protocolVersion: OVERLAY_PROTOCOL_VERSION,
        showTextDefault: true,
        defaultMediaTime: 30,
        maxMediaTime: 120,
      });
    } finally {
      await app.close();
    }
  });
});

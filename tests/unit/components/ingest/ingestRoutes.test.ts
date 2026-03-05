import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createIngestRoutes } from '../../../../src/components/ingest/ingestRoutes';

const ingestRouteMocks = vi.hoisted(() => {
  class MockMediaIngestionError extends Error {
    constructor(message = 'media_ingestion_failed') {
      super(message);
      this.name = 'MediaIngestionError';
    }
  }

  return {
    createIngestClientToken: vi.fn(),
    isIngestApiEnabled: vi.fn(),
    resolveIngestAuthFromRequest: vi.fn(),
    revokeIngestClientsForGuildLabel: vi.fn(),
    ingestMediaFromSource: vi.fn(),
    toMediaIngestionError: vi.fn((error: unknown) =>
      error instanceof Error ? error : new MockMediaIngestionError(),
    ),
    MediaIngestionError: MockMediaIngestionError,
    extractMediaStartOffsetSec: vi.fn().mockReturnValue(0),
    createPlaybackJob: vi.fn(),
    buildMediaOverlayTextPayload: vi.fn().mockReturnValue(null),
    encodeRichOverlayPayload: vi.fn().mockReturnValue(''),
    addToMemeBoard: vi.fn(),
    normalizeTweetStatusUrl: vi.fn().mockReturnValue(null),
    resolveTweetCardFromUrl: vi.fn().mockResolvedValue(null),
    resolveTweetCardFromUrlWithOptions: vi.fn().mockResolvedValue(null),
    extractTweetStatusIdFromUrl: vi.fn().mockReturnValue(null),
    resolveTweetVideoMediasFromUrl: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('../../../../src/services/ingestAuth', () => {
  return {
    createIngestClientToken: ingestRouteMocks.createIngestClientToken,
    isIngestApiEnabled: ingestRouteMocks.isIngestApiEnabled,
    resolveIngestAuthFromRequest: ingestRouteMocks.resolveIngestAuthFromRequest,
    revokeIngestClientsForGuildLabel: ingestRouteMocks.revokeIngestClientsForGuildLabel,
  };
});

vi.mock('../../../../src/services/media/mediaIngestion', () => {
  return {
    ingestMediaFromSource: ingestRouteMocks.ingestMediaFromSource,
  };
});

vi.mock('../../../../src/services/media/mediaErrors', () => {
  return {
    MediaIngestionError: ingestRouteMocks.MediaIngestionError,
    toMediaIngestionError: ingestRouteMocks.toMediaIngestionError,
  };
});

vi.mock('../../../../src/services/media/mediaSourceResolver', () => {
  return {
    extractMediaStartOffsetSec: ingestRouteMocks.extractMediaStartOffsetSec,
  };
});

vi.mock('../../../../src/services/playbackJobs', () => {
  return {
    createPlaybackJob: ingestRouteMocks.createPlaybackJob,
  };
});

vi.mock('../../../../src/services/messages/richOverlayPayload', () => {
  return {
    buildMediaOverlayTextPayload: ingestRouteMocks.buildMediaOverlayTextPayload,
    encodeRichOverlayPayload: ingestRouteMocks.encodeRichOverlayPayload,
  };
});

vi.mock('../../../../src/services/memeBoard', () => {
  return {
    addToMemeBoard: ingestRouteMocks.addToMemeBoard,
  };
});

vi.mock('../../../../src/services/social/twitterOEmbed', () => {
  return {
    normalizeTweetStatusUrl: ingestRouteMocks.normalizeTweetStatusUrl,
    resolveTweetCardFromUrl: ingestRouteMocks.resolveTweetCardFromUrl,
    resolveTweetCardFromUrlWithOptions: ingestRouteMocks.resolveTweetCardFromUrlWithOptions,
  };
});

vi.mock('../../../../src/services/social/twitterVideoResolver', () => {
  return {
    extractTweetStatusIdFromUrl: ingestRouteMocks.extractTweetStatusIdFromUrl,
    resolveTweetVideoMediasFromUrl: ingestRouteMocks.resolveTweetVideoMediasFromUrl,
  };
});

type PrismaIngestPairingCodeRecord = {
  code: string;
  guildId: string;
  authorName: string | null;
  authorImage: string | null;
  createdByDiscordUserId: string;
  mode: string;
};

const createApp = async () => {
  const app = Fastify();
  await app.register(createIngestRoutes(), {
    prefix: '/ingest',
  });
  await app.ready();

  return app;
};

describe('components/ingest/ingestRoutes', () => {
  beforeEach(() => {
    global.logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    global.env = {
      API_URL: 'https://api.livechat.test',
    } as any;

    global.prisma = {
      pairingCode: {
        deleteMany: vi.fn().mockResolvedValue(undefined),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue(undefined),
      },
    } as any;

    ingestRouteMocks.createIngestClientToken.mockReset();
    ingestRouteMocks.isIngestApiEnabled.mockReset();
    ingestRouteMocks.resolveIngestAuthFromRequest.mockReset();
    ingestRouteMocks.revokeIngestClientsForGuildLabel.mockReset();
    ingestRouteMocks.ingestMediaFromSource.mockReset();
    ingestRouteMocks.toMediaIngestionError.mockReset();
    ingestRouteMocks.extractMediaStartOffsetSec.mockReset();
    ingestRouteMocks.extractMediaStartOffsetSec.mockReturnValue(0);
    ingestRouteMocks.createPlaybackJob.mockReset();
    ingestRouteMocks.buildMediaOverlayTextPayload.mockReset();
    ingestRouteMocks.buildMediaOverlayTextPayload.mockReturnValue(null);
    ingestRouteMocks.encodeRichOverlayPayload.mockReset();
    ingestRouteMocks.encodeRichOverlayPayload.mockReturnValue('');
    ingestRouteMocks.addToMemeBoard.mockReset();
    ingestRouteMocks.normalizeTweetStatusUrl.mockReset();
    ingestRouteMocks.normalizeTweetStatusUrl.mockReturnValue(null);
    ingestRouteMocks.resolveTweetCardFromUrl.mockReset();
    ingestRouteMocks.resolveTweetCardFromUrl.mockResolvedValue(null);
    ingestRouteMocks.resolveTweetCardFromUrlWithOptions.mockReset();
    ingestRouteMocks.resolveTweetCardFromUrlWithOptions.mockResolvedValue(null);
    ingestRouteMocks.extractTweetStatusIdFromUrl.mockReset();
    ingestRouteMocks.extractTweetStatusIdFromUrl.mockReturnValue(null);
    ingestRouteMocks.resolveTweetVideoMediasFromUrl.mockReset();
    ingestRouteMocks.resolveTweetVideoMediasFromUrl.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns ingest pairing payload contract for a valid pairing code', async () => {
    const app = await createApp();
    const pairingCodeRecord: PrismaIngestPairingCodeRecord = {
      code: 'ING1',
      guildId: 'guild-1',
      authorName: 'Extension User',
      authorImage: 'https://cdn.livechat.test/author.png',
      createdByDiscordUserId: 'discord-7',
      mode: 'NORMAL',
    };

    global.prisma.pairingCode.findFirst.mockResolvedValueOnce(pairingCodeRecord);
    ingestRouteMocks.createIngestClientToken.mockResolvedValueOnce({
      rawToken: 'ingest-token-1',
      client: {
        id: 'ingest-client-1',
        guildId: 'guild-1',
        label: 'Chrome Extension',
        defaultAuthorName: 'Extension User',
        defaultAuthorImage: 'https://cdn.livechat.test/author.png',
      },
    });

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/ingest/pair/consume',
        payload: {
          code: 'ing1',
          deviceName: 'Chrome Extension',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        apiBaseUrl: 'https://api.livechat.test',
        ingestApiToken: 'ingest-token-1',
        ingestClientId: 'ingest-client-1',
        guildId: 'guild-1',
        deviceName: 'Chrome Extension',
        authorName: 'Extension User',
        authorImage: 'https://cdn.livechat.test/author.png',
      });
      expect(ingestRouteMocks.createIngestClientToken).toHaveBeenCalledWith({
        guildId: 'guild-1',
        label: 'Chrome Extension',
        defaultAuthorName: 'Extension User',
        defaultAuthorImage: 'https://cdn.livechat.test/author.png',
        createdByDiscordUserId: 'discord-7',
      });
    } finally {
      await app.close();
    }
  });

  it('rejects protected ingest route when credentials are invalid', async () => {
    const app = await createApp();
    ingestRouteMocks.resolveIngestAuthFromRequest.mockResolvedValueOnce(null);
    ingestRouteMocks.isIngestApiEnabled.mockResolvedValueOnce(true);

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/ingest/',
        payload: {
          text: 'hello',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        error: 'unauthorized',
      });
    } finally {
      await app.close();
    }
  });

  it('continues past auth with valid credentials and applies payload validation', async () => {
    const app = await createApp();
    ingestRouteMocks.resolveIngestAuthFromRequest.mockResolvedValueOnce({
      token: 'ingest-token-1',
      client: {
        guildId: 'guild-1',
        defaultAuthorName: 'Extension User',
        defaultAuthorImage: null,
      },
    });

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/ingest/',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: 'invalid_payload',
      });
      expect(ingestRouteMocks.isIngestApiEnabled).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});

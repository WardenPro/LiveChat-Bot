import type { FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { hashOverlayToken } from '../../../src/services/overlayAuth';
import {
  createIngestClientToken,
  isIngestApiEnabled,
  resolveIngestAuthFromRequest,
  resolveIngestClientFromRequest,
  revokeIngestClientsForGuildLabel,
} from '../../../src/services/ingestAuth';

const createRequest = (authorization?: string): FastifyRequest => {
  return {
    headers: authorization
      ? {
          authorization,
        }
      : {},
    query: {},
  } as unknown as FastifyRequest;
};

const createIngestClient = (overrides: Record<string, unknown> = {}) => {
  return {
    id: 'ingest-client-1',
    guildId: 'guild-1',
    label: 'Ingest Device',
    tokenHash: 'ingest-token-hash',
    defaultAuthorName: 'Ingest Author',
    defaultAuthorImage: 'https://cdn.example/ingest-author.png',
    createdByDiscordUserId: 'discord-ingest-user',
    lastSeenAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    revokedAt: null,
    ...overrides,
  };
};

describe('services/ingestAuth', () => {
  beforeEach(() => {
    global.prisma = {} as any;
  });

  afterEach(() => {
    global.prisma = {} as any;
    vi.clearAllMocks();
  });

  it('creates ingest client token and stores a hash derived from returned raw token', async () => {
    const createSpy = vi.fn().mockImplementation(async (args: { data: { tokenHash: string } }) => {
      return createIngestClient({
        tokenHash: args.data.tokenHash,
      });
    });

    global.prisma = {
      ingestClient: {
        create: createSpy,
        findFirst: vi.fn(),
        updateMany: vi.fn(),
      },
    } as any;

    const result = await createIngestClientToken({
      guildId: 'guild-1',
      label: 'Ingest Device',
      defaultAuthorName: 'Ingest Author',
      defaultAuthorImage: 'https://cdn.example/ingest-author.png',
      createdByDiscordUserId: 'discord-ingest-user',
    });

    const expectedTokenHash = hashOverlayToken(result.rawToken);

    expect(result.rawToken).toMatch(/^[a-f0-9]{64}$/);
    expect(createSpy).toHaveBeenCalledWith({
      data: {
        guildId: 'guild-1',
        label: 'Ingest Device',
        tokenHash: expectedTokenHash,
        defaultAuthorName: 'Ingest Author',
        defaultAuthorImage: 'https://cdn.example/ingest-author.png',
        createdByDiscordUserId: 'discord-ingest-user',
      },
    });
    expect(result.client.tokenHash).toBe(expectedTokenHash);
  });

  it('throws when ingest client model is unavailable', async () => {
    global.prisma = {} as any;

    await expect(
      createIngestClientToken({
        guildId: 'guild-1',
        label: 'Ingest Device',
        defaultAuthorName: 'Ingest Author',
        defaultAuthorImage: null,
        createdByDiscordUserId: 'discord-ingest-user',
      }),
    ).rejects.toThrow('ingest_client_model_unavailable');
  });

  it('resolves ingest auth for accepted bearer credentials and updates lastSeenAt', async () => {
    const validToken = 'ingest-valid-token';
    const validTokenHash = hashOverlayToken(validToken);
    const findFirstSpy = vi.fn().mockImplementation(async (args: { where: { tokenHash?: string } }) => {
      if (args.where.tokenHash !== validTokenHash) {
        return null;
      }

      return createIngestClient({
        tokenHash: validTokenHash,
      });
    });
    const updateManySpy = vi.fn().mockResolvedValue({ count: 1 });

    global.prisma = {
      ingestClient: {
        create: vi.fn(),
        findFirst: findFirstSpy,
        updateMany: updateManySpy,
      },
    } as any;

    const clientResult = await resolveIngestClientFromRequest(createRequest(`Bearer ${validToken}`));
    const authResult = await resolveIngestAuthFromRequest(createRequest(`Bearer ${validToken}`));

    expect(clientResult).toMatchObject({
      client: {
        id: 'ingest-client-1',
        guildId: 'guild-1',
      },
    });
    expect(authResult).toMatchObject({
      kind: 'client',
      client: {
        id: 'ingest-client-1',
      },
    });
    expect(findFirstSpy).toHaveBeenCalledWith({
      where: {
        tokenHash: validTokenHash,
        revokedAt: null,
      },
    });
    expect(updateManySpy).toHaveBeenCalledWith({
      where: {
        id: 'ingest-client-1',
        revokedAt: null,
      },
      data: {
        lastSeenAt: expect.any(Date),
      },
    });
  });

  it('returns null for rejected ingest credentials and avoids update side effects', async () => {
    const updateManySpy = vi.fn();
    global.prisma = {
      ingestClient: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: updateManySpy,
      },
    } as any;

    const invalidResult = await resolveIngestClientFromRequest(createRequest('Bearer invalid-token'));
    const malformedResult = await resolveIngestAuthFromRequest(createRequest('Basic abc'));

    expect(invalidResult).toBeNull();
    expect(malformedResult).toBeNull();
    expect(updateManySpy).not.toHaveBeenCalled();
  });

  it('revokes active ingest clients for guild label when delegate exists', async () => {
    const updateManySpy = vi.fn().mockResolvedValue({ count: 2 });
    global.prisma = {
      ingestClient: {
        create: vi.fn(),
        findFirst: vi.fn(),
        updateMany: updateManySpy,
      },
    } as any;

    await revokeIngestClientsForGuildLabel('guild-1', 'Ingest Device');

    expect(updateManySpy).toHaveBeenCalledWith({
      where: {
        guildId: 'guild-1',
        label: 'Ingest Device',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it('reports ingest API enabled only when an active client exists', async () => {
    global.prisma = {} as any;
    await expect(isIngestApiEnabled()).resolves.toBe(false);

    global.prisma = {
      ingestClient: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({ id: 'active-ingest-client' }),
        updateMany: vi.fn(),
      },
    } as any;

    await expect(isIngestApiEnabled()).resolves.toBe(true);
  });
});

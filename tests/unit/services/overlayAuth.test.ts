import type { FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createOverlayClientToken,
  hashOverlayToken,
  resolveOverlayAuthFromRequest,
  resolveOverlayAuthFromToken,
  resolveOverlayClientFromRequest,
} from '../../../src/services/overlayAuth';

const createRequest = (params: { authorization?: string; queryToken?: unknown }): FastifyRequest => {
  return {
    headers: params.authorization
      ? {
          authorization: params.authorization,
        }
      : {},
    query: params.queryToken === undefined ? {} : { token: params.queryToken },
  } as unknown as FastifyRequest;
};

const createOverlayClient = (overrides: Record<string, unknown> = {}) => {
  return {
    id: 'overlay-client-1',
    guildId: 'guild-1',
    label: 'Main Overlay',
    tokenHash: 'token-hash',
    sessionMode: 'NORMAL',
    defaultAuthorName: 'Overlay Author',
    defaultAuthorImage: 'https://cdn.example/author.png',
    createdByDiscordUserId: 'discord-user-1',
    lastSeenAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    revokedAt: null,
    ...overrides,
  };
};

describe('services/overlayAuth', () => {
  beforeEach(() => {
    global.prisma = {} as any;
  });

  afterEach(() => {
    global.prisma = {} as any;
    vi.clearAllMocks();
  });

  it('creates a client token and retries with legacy payload when prisma rejects new arguments', async () => {
    const createSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error('Unknown argument `sessionMode`'))
      .mockResolvedValueOnce(
        createOverlayClient({
          sessionMode: ' ',
          defaultAuthorName: '   ',
          defaultAuthorImage: 42,
          createdByDiscordUserId: null,
        }),
      );

    global.prisma = {
      overlayClient: {
        create: createSpy,
      },
    } as any;

    const result = await createOverlayClientToken({
      guildId: 'guild-1',
      label: 'Primary Device',
      sessionMode: 'INVITE_READ_ONLY',
      defaultAuthorName: '  Overlay Operator  ',
      defaultAuthorImage: ' https://cdn.example/custom.png ',
      createdByDiscordUserId: '  discord-42  ',
    });
    const expectedTokenHash = hashOverlayToken(result.rawToken);

    expect(createSpy).toHaveBeenCalledTimes(2);
    expect(createSpy).toHaveBeenNthCalledWith(1, {
      data: {
        guildId: 'guild-1',
        label: 'Primary Device',
        tokenHash: expectedTokenHash,
        sessionMode: 'INVITE_READ_ONLY',
        defaultAuthorName: 'Overlay Operator',
        defaultAuthorImage: 'https://cdn.example/custom.png',
        createdByDiscordUserId: 'discord-42',
      },
    });
    expect(createSpy).toHaveBeenNthCalledWith(2, {
      data: {
        guildId: 'guild-1',
        label: 'Primary Device',
        tokenHash: expectedTokenHash,
      },
    });

    expect(result.rawToken).toMatch(/^[a-f0-9]{64}$/);
    expect(result.client).toMatchObject({
      guildId: 'guild-1',
      label: 'Main Overlay',
      sessionMode: 'NORMAL',
      defaultAuthorName: null,
      defaultAuthorImage: null,
      createdByDiscordUserId: null,
    });
  });

  it('throws when overlay client model is unavailable', async () => {
    global.prisma = {} as any;

    await expect(
      createOverlayClientToken({
        guildId: 'guild-1',
        label: 'Primary Device',
      }),
    ).rejects.toThrow('overlay_client_model_unavailable');
  });

  it('authenticates valid bearer and query tokens and returns normalized client context', async () => {
    const validToken = 'overlay-valid-token';
    const validTokenHash = hashOverlayToken(validToken);
    const findFirstSpy = vi.fn().mockImplementation(async (args: { where: { tokenHash: string } }) => {
      if (args.where.tokenHash !== validTokenHash) {
        return null;
      }

      return createOverlayClient({
        tokenHash: validTokenHash,
        sessionMode: '  INVITE_READ_ONLY  ',
        defaultAuthorName: '  Stream Host  ',
        defaultAuthorImage: ' ',
        createdByDiscordUserId: 12345,
      });
    });

    global.prisma = {
      overlayClient: {
        findFirst: findFirstSpy,
      },
    } as any;

    const bearerResult = await resolveOverlayAuthFromRequest(
      createRequest({
        authorization: `Bearer ${validToken}`,
      }),
    );
    const queryResult = await resolveOverlayAuthFromRequest(
      createRequest({
        queryToken: validToken,
      }),
    );

    expect(bearerResult.kind).toBe('authenticated');
    if (bearerResult.kind !== 'authenticated') {
      throw new Error('Expected bearer authentication to succeed');
    }
    expect(bearerResult.tokenSource).toBe('authorization_header');
    expect(bearerResult.client).toMatchObject({
      guildId: 'guild-1',
      sessionMode: 'INVITE_READ_ONLY',
      defaultAuthorName: 'Stream Host',
      defaultAuthorImage: null,
      createdByDiscordUserId: null,
    });

    expect(queryResult.kind).toBe('authenticated');
    if (queryResult.kind !== 'authenticated') {
      throw new Error('Expected query authentication to succeed');
    }
    expect(queryResult.tokenSource).toBe('query_string');
    expect(findFirstSpy).toHaveBeenCalledTimes(2);
  });

  it('returns invalid token without leaking internal details for rejected credentials', async () => {
    global.prisma = {
      overlayClient: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as any;

    const authResult = await resolveOverlayAuthFromToken('bad-token', 'socket_handshake');

    expect(authResult).toEqual({
      kind: 'invalid_token',
      tokenSource: 'socket_handshake',
    });
    expect(authResult).not.toHaveProperty('token');
    expect(authResult).not.toHaveProperty('client');
  });

  it('returns missing token for absent or malformed request credentials', async () => {
    const missingResult = await resolveOverlayAuthFromRequest(createRequest({}));
    const malformedResult = await resolveOverlayAuthFromRequest(
      createRequest({
        authorization: 'Basic abc123',
      }),
    );

    expect(missingResult).toEqual({
      kind: 'missing_token',
    });
    expect(malformedResult).toEqual({
      kind: 'missing_token',
    });
  });

  it('returns authenticated client wrapper for valid token and null otherwise', async () => {
    const validToken = 'overlay-client-token';
    const validTokenHash = hashOverlayToken(validToken);

    global.prisma = {
      overlayClient: {
        findFirst: vi.fn().mockImplementation(async (args: { where: { tokenHash: string } }) => {
          if (args.where.tokenHash === validTokenHash) {
            return createOverlayClient({
              tokenHash: validTokenHash,
            });
          }

          return null;
        }),
      },
    } as any;

    const resolvedClient = await resolveOverlayClientFromRequest(
      createRequest({
        authorization: `Bearer ${validToken}`,
      }),
    );
    const rejectedClient = await resolveOverlayClientFromRequest(
      createRequest({
        authorization: 'Bearer invalid-token',
      }),
    );

    expect(resolvedClient).toMatchObject({
      token: validToken,
      client: {
        guildId: 'guild-1',
        label: 'Main Overlay',
      },
    });
    expect(rejectedClient).toBeNull();
  });
});

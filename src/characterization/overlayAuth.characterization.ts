import assert from 'assert';
import type { FastifyRequest } from 'fastify';

import {
  hashOverlayToken,
  resolveOverlayAuthFromRequest,
  resolveOverlayAuthFromToken,
  resolveOverlayClientFromRequest,
} from '../services/overlayAuth';
import { ensureCharacterizationGlobals, toValueShape } from './utils';

interface OverlayAuthCharacterizationClient {
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

const createAuthRequest = (params: { authorization?: string; queryToken?: unknown }): FastifyRequest => {
  return {
    headers: params.authorization
      ? {
          authorization: params.authorization,
        }
      : {},
    query: params.queryToken === undefined ? {} : { token: params.queryToken },
  } as unknown as FastifyRequest;
};

export const runOverlayAuthCharacterization = async () => {
  ensureCharacterizationGlobals();

  const validToken = 'overlay-auth-valid-token';
  const validTokenHash = hashOverlayToken(validToken);
  const lookupTokenHashes: string[] = [];

  const overlayClient: OverlayAuthCharacterizationClient = {
    id: 'overlay-client-auth-1',
    guildId: 'guild-auth-1',
    label: 'Auth Device',
    tokenHash: validTokenHash,
    sessionMode: 'NORMAL',
    defaultAuthorName: 'Auth Author',
    defaultAuthorImage: 'https://cdn.example/auth.png',
    createdByDiscordUserId: 'discord-author-1',
    lastSeenAt: null,
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    revokedAt: null,
  };

  global.prisma = {
    overlayClient: {
      findFirst: async (args: { where: { tokenHash: string; revokedAt: null } }) => {
        lookupTokenHashes.push(args.where.tokenHash);

        if (args.where.tokenHash !== overlayClient.tokenHash) {
          return null;
        }

        return {
          ...overlayClient,
        };
      },
    },
  } as any;

  const bearerAuth = await resolveOverlayAuthFromRequest(
    createAuthRequest({
      authorization: `Bearer ${validToken}`,
    }),
  );
  const queryAuth = await resolveOverlayAuthFromRequest(
    createAuthRequest({
      queryToken: validToken,
    }),
  );
  const missingAuth = await resolveOverlayAuthFromRequest(createAuthRequest({}));
  const invalidAuth = await resolveOverlayAuthFromRequest(
    createAuthRequest({
      authorization: 'Bearer overlay-auth-invalid-token',
    }),
  );
  const socketAuth = await resolveOverlayAuthFromToken(validToken, 'socket_handshake');
  const legacyAuth = await resolveOverlayClientFromRequest(
    createAuthRequest({
      authorization: `Bearer ${validToken}`,
    }),
  );
  const legacyMissing = await resolveOverlayClientFromRequest(createAuthRequest({}));

  assert.strictEqual(bearerAuth.kind, 'authenticated', 'bearer token should authenticate');
  assert.strictEqual(queryAuth.kind, 'authenticated', 'query token should authenticate');
  assert.strictEqual(missingAuth.kind, 'missing_token', 'missing credentials should be detected');
  assert.strictEqual(invalidAuth.kind, 'invalid_token', 'invalid credentials should be detected');
  assert.strictEqual(socketAuth.kind, 'authenticated', 'socket token should authenticate');
  assert(legacyAuth, 'legacy resolver should still return authenticated client');
  assert.strictEqual(legacyMissing, null, 'legacy resolver should still return null for missing auth');

  return {
    bearerAuth: {
      kind: bearerAuth.kind,
      tokenSource: bearerAuth.kind === 'authenticated' ? bearerAuth.tokenSource : null,
      clientShape: bearerAuth.kind === 'authenticated' ? toValueShape(bearerAuth.client) : null,
    },
    queryAuth: {
      kind: queryAuth.kind,
      tokenSource: queryAuth.kind === 'authenticated' ? queryAuth.tokenSource : null,
    },
    missingAuth: {
      kind: missingAuth.kind,
    },
    invalidAuth: {
      kind: invalidAuth.kind,
      tokenSource: invalidAuth.kind === 'invalid_token' ? invalidAuth.tokenSource : null,
    },
    socketAuth: {
      kind: socketAuth.kind,
      tokenSource: socketAuth.kind === 'authenticated' ? socketAuth.tokenSource : null,
    },
    legacyWrapper: {
      resolved: !!legacyAuth,
      guildId: legacyAuth?.client.guildId || null,
      missingReturnsNull: legacyMissing === null,
    },
    lookupTokenHashes,
  };
};
